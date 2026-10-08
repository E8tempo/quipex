"""Импорт / синхронизация каталога с e8.ru с отслеживанием прогресса в таблице import_jobs."""

import asyncio
import logging
import random
from datetime import UTC, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.utils import round_money, slugify
from app.models import Category, ImportJob, ImportStatus, Product, ProductAttribute, ProductImage
from app.services import media
from app.services.e8_parser import E8Parser, ParsedListItem, ParsedProduct
from app.services.site_settings import get_all_settings

log = logging.getLogger(__name__)

MAX_LOG_CHARS = 60_000
MSK = timezone(timedelta(hours=3))
HIGHLIGHT_EXCLUDE = {"артикул", "комплектация", "цвет", "особенности"}


class ImportCancelled(Exception):
    pass


class ImportRunner:
    _lock = asyncio.Lock()
    _cancel_requested: set[int] = set()
    _current_task: asyncio.Task | None = None

    # ---------- управление ----------

    @classmethod
    def is_running(cls) -> bool:
        return cls._lock.locked()

    @classmethod
    def request_cancel(cls, job_id: int) -> None:
        cls._cancel_requested.add(job_id)

    @classmethod
    async def start(
        cls, mode: str = "full", trigger: str = "manual", download_images: bool | None = None
    ) -> ImportJob:
        if cls.is_running():
            raise RuntimeError("Импорт уже выполняется")
        last = await cls.last_started_at()
        cooldown = timedelta(minutes=settings.parser_min_interval_minutes)
        if last and datetime.now(UTC) - last < cooldown:
            left = int((last + cooldown - datetime.now(UTC)).total_seconds() // 60) + 1
            raise RuntimeError(
                f"Импорт запускался недавно — подождите ещё {left} мин, "
                "чтобы источник не заблокировал сервер за частые запросы"
            )
        async with SessionLocal() as session:
            job = ImportJob(status=ImportStatus.pending, mode=mode, trigger=trigger, log="")
            session.add(job)
            await session.commit()
            await session.refresh(job)
        dl = settings.parser_download_images if download_images is None else download_images
        cls._current_task = asyncio.create_task(cls(job.id, mode, dl).run())
        return job

    @staticmethod
    async def last_started_at() -> datetime | None:
        async with SessionLocal() as session:
            last = (await session.execute(select(func.max(ImportJob.started_at)))).scalar()
        if last and last.tzinfo is None:
            last = last.replace(tzinfo=UTC)
        return last

    @classmethod
    async def mark_stale_jobs(cls) -> None:
        """При рестарте процесса «running»-задачи уже не выполняются — помечаем их."""
        async with SessionLocal() as session:
            await session.execute(
                update(ImportJob)
                .where(ImportJob.status.in_([ImportStatus.running, ImportStatus.pending]))
                .values(status=ImportStatus.failed, error="Прервано перезапуском сервера")
            )
            await session.commit()

    # ---------- выполнение ----------

    def __init__(self, job_id: int, mode: str, download_images: bool) -> None:
        self.job_id = job_id
        self.mode = mode
        self.download_images = download_images
        self.stats = {
            "categories_created": 0,
            "products_created": 0,
            "products_updated": 0,
            "products_deactivated": 0,
            "images_downloaded": 0,
            "errors": 0,
        }
        self._log: list[str] = []
        self._last_flush = 0.0

    def log(self, msg: str) -> None:
        line = f"[{datetime.now():%H:%M:%S}] {msg}"
        log.info("import #%s: %s", self.job_id, msg)
        self._log.append(line)

    async def _save(self, session: AsyncSession, **fields) -> None:
        text = "\n".join(self._log)
        if len(text) > MAX_LOG_CHARS:
            text = "…\n" + text[-MAX_LOG_CHARS:]
        await session.execute(
            update(ImportJob)
            .where(ImportJob.id == self.job_id)
            .values(log=text, stats=dict(self.stats), **fields)
        )
        await session.commit()

    def _check_cancel(self) -> None:
        if self.job_id in self._cancel_requested:
            raise ImportCancelled()
        if self.parser.blocked:
            raise RuntimeError(
                "Источник перестал отвечать (много ошибок подряд) — похоже, ограничил доступ "
                "по частоте запросов. Импорт остановлен, товары не сняты с публикации. "
                "Повторите позже или уменьшите PARSER_CONCURRENCY / увеличьте PARSER_DELAY_SECONDS."
            )

    async def run(self) -> None:
        async with self._lock, SessionLocal() as session:
            await self._save(
                session, status=ImportStatus.running, started_at=datetime.now(UTC)
            )
            try:
                self.cfg = await get_all_settings(session)
                async with E8Parser() as parser:
                    self.parser = parser
                    if self.mode == "prices":
                        await self._run_prices(session)
                    else:
                        await self._run_full(session)
                self.log("Готово ✅")
                await self._save(
                    session, status=ImportStatus.success, finished_at=datetime.now(UTC)
                )
            except ImportCancelled:
                await session.rollback()
                self.log("Импорт остановлен пользователем")
                await self._save(
                    session, status=ImportStatus.cancelled, finished_at=datetime.now(UTC)
                )
            except Exception as exc:  # noqa: BLE001
                log.exception("Import failed")
                await session.rollback()
                self.log(f"Ошибка: {exc}")
                await self._save(
                    session,
                    status=ImportStatus.failed,
                    error=str(exc)[:2000],
                    finished_at=datetime.now(UTC),
                )
            finally:
                self._cancel_requested.discard(self.job_id)

    # ---------- цены ----------

    def _apply_prices(self, product: Product, price: Decimal | None, old_price: Decimal | None) -> None:
        if price is None:
            return
        product.source_price = price
        if product.price_locked:
            return
        markup = Decimal(str(self.cfg.get("import_price_markup_percent") or 0))
        k = 1 + markup / 100
        product.price = round_money(price * k)
        product.old_price = round_money(old_price * k) if old_price else None
        if self.cfg.get("import_wholesale_from_retail"):
            disc = Decimal(str(self.cfg.get("wholesale_default_discount_percent") or 0))
            product.wholesale_price = (
                round_money(product.price * (1 - disc / 100)) if disc > 0 else None
            )

    # ---------- режим «только цены» ----------

    async def _run_prices(self, session: AsyncSession) -> None:
        products = (
            await session.execute(select(Product).where(Product.source_url.is_not(None)))
        ).scalars().all()
        self.log(f"Обновление цен и наличия для {len(products)} товаров")
        await self._save(session, total=len(products), progress=0)

        async def fetch(p: Product):
            try:
                return p, await self.parser.parse_product(p.source_url), None
            except Exception as exc:  # noqa: BLE001
                return p, None, exc

        done = 0
        batch_size = max(2, settings.parser_concurrency * 2)
        for start in range(0, len(products), batch_size):
            self._check_cancel()
            results = await asyncio.gather(*(fetch(p) for p in products[start : start + batch_size]))
            done += len(results)
            await self._apply_price_results(results)
            await self._save(session, progress=done)

    async def _apply_price_results(self, results) -> None:
        for p, parsed, err in results:
            if err or not parsed:
                if isinstance(err, FileNotFoundError):
                    p.in_stock = False
                    self.log(f"Нет на сайте-источнике: {p.name}")
                else:
                    self.stats["errors"] += 1
                    self.log(f"Ошибка {p.source_url}: {err}")
            else:
                self._apply_prices(p, parsed.price, parsed.old_price)
                p.in_stock = parsed.in_stock
                p.synced_at = datetime.now(UTC)
                self.stats["products_updated"] += 1

    # ---------- полный импорт ----------

    async def _run_full(self, session: AsyncSession) -> None:
        self.log(f"Загрузка дерева категорий с {self.parser.base}")
        parsed_cats = await self.parser.parse_categories()
        if not parsed_cats:
            raise RuntimeError("Не найдено ни одной категории — изменилась вёрстка источника?")
        self.log(f"Найдено категорий: {len(parsed_cats)}")
        cat_by_url = await self._sync_categories(session, parsed_cats)
        await self._save(session)

        self.log("Сбор списка товаров по категориям…")
        listings = await asyncio.gather(
            *(self.parser.parse_category_items(c.url) for c in parsed_cats),
            return_exceptions=True,
        )
        items: dict[str, ParsedListItem] = {}
        listing_failed = False
        for cat, res in zip(parsed_cats, listings, strict=True):
            if isinstance(res, BaseException):
                listing_failed = True
                self.stats["errors"] += 1
                self.log(f"Ошибка загрузки категории {cat.name}: {res}")
                continue
            for item in res:
                items.setdefault(item.url, item)
        self._check_cancel()
        self.log(f"Найдено товаров: {len(items)}")
        await self._save(session, total=len(items), progress=0)

        existing_images: dict[str, str] = {
            src: url
            for src, url in (
                await session.execute(
                    select(ProductImage.source_url, ProductImage.url).where(
                        ProductImage.source_url.is_not(None)
                    )
                )
            ).all()
        }

        async def fetch(item: ParsedListItem):
            try:
                parsed = await self.parser.parse_product(item.url)
                images = await self._download_images(parsed, existing_images)
                return item, parsed, images, None
            except Exception as exc:  # noqa: BLE001
                return item, None, [], exc

        seen_urls: set[str] = set()
        failed_urls: set[str] = set()
        done = 0
        queue = list(items.values())
        batch_size = max(2, settings.parser_concurrency * 2)
        for start in range(0, len(queue), batch_size):
            self._check_cancel()
            results = await asyncio.gather(*(fetch(i) for i in queue[start : start + batch_size]))
            for item, parsed, images, err in results:
                done += 1
                if err or not parsed:
                    if not isinstance(err, FileNotFoundError):
                        failed_urls.add(item.url)
                    self.stats["errors"] += 1
                    self.log(f"Ошибка {item.url}: {err}")
                    continue
                seen_urls.add(item.url)
                try:
                    await self._upsert_product(session, item, parsed, images, cat_by_url)
                    await session.commit()
                except Exception as exc:  # noqa: BLE001
                    await session.rollback()
                    self.stats["errors"] += 1
                    self.log(f"Ошибка сохранения {parsed.name}: {exc}")
            self.log(f"Обработано {done} из {len(queue)}")
            await self._save(session, progress=done)

        if listing_failed:
            self.log("Часть категорий не загрузилась — снятие отсутствующих товаров пропущено")
        else:
            await self._deactivate_missing(session, seen_urls | failed_urls)
        self.log(
            "Итог: создано {products_created}, обновлено {products_updated}, "
            "снято с публикации {products_deactivated}, фото {images_downloaded}, ошибок {errors}".format(
                **self.stats
            )
        )

    async def _sync_categories(self, session: AsyncSession, parsed) -> dict[str, Category]:
        existing = {
            c.source_url: c
            for c in (await session.execute(select(Category))).scalars().all()
            if c.source_url
        }
        used_slugs = set((await session.execute(select(Category.slug))).scalars().all())
        result: dict[str, Category] = {}
        for pc in parsed:  # родители идут раньше детей
            cat = existing.get(pc.url)
            parent = result.get(pc.parent_url) if pc.parent_url else None
            if not cat:
                slug = pc.slug
                n = 2
                while slug in used_slugs:
                    slug, n = f"{pc.slug}-{n}", n + 1
                used_slugs.add(slug)
                cat = Category(
                    name=pc.name,
                    slug=slug,
                    source_url=pc.url,
                    sort_order=pc.sort_order,
                    parent_id=parent.id if parent else None,
                    is_active=True,
                )
                session.add(cat)
                await session.flush()
                self.stats["categories_created"] += 1
            elif parent and cat.parent_id is None:
                cat.parent_id = parent.id
            if pc.image and not cat.image and self.download_images:
                try:
                    content, ctype = await self.parser.fetch_bytes(pc.image)
                    cat.image = media.save_remote(content, pc.image, "categories", ctype)
                except Exception as exc:  # noqa: BLE001
                    self.log(f"Не удалось скачать иконку категории {pc.name}: {exc}")
            result[pc.url] = cat
        await session.commit()
        return result

    async def _download_images(
        self, parsed: ParsedProduct, existing: dict[str, str]
    ) -> list[tuple[str, str]]:
        """Возвращает [(source_url, local_url)]. Без скачивания — ссылки на источник."""
        result = []
        for src in parsed.images[:15]:
            if src in existing:
                result.append((src, existing[src]))
                continue
            if not self.download_images:
                result.append((src, src))
                continue
            try:
                content, ctype = await self.parser.fetch_bytes(src)
                folder = f"products/{parsed.source_id or slugify(parsed.name)[:40]}"
                local = media.save_remote(content, src, folder, ctype)
                existing[src] = local
                self.stats["images_downloaded"] += 1
                result.append((src, local))
            except Exception as exc:  # noqa: BLE001
                self.log(f"Фото не скачано {src}: {exc}")
        return result

    async def _upsert_product(
        self,
        session: AsyncSession,
        item: ParsedListItem,
        parsed: ParsedProduct,
        images: list[tuple[str, str]],
        cat_by_url: dict[str, Category],
    ) -> None:
        stmt = select(Product).options(
            selectinload(Product.images), selectinload(Product.attributes)
        )
        product = (
            await session.execute(stmt.where(Product.source_url == parsed.url))
        ).scalar_one_or_none()
        if not product and parsed.source_id:
            product = (
                await session.execute(stmt.where(Product.source_id == parsed.source_id))
            ).scalar_one_or_none()

        category = None
        for url in reversed(parsed.breadcrumb_urls):
            if url in cat_by_url:
                category = cat_by_url[url]
                break
        category = category or cat_by_url.get(item.category_url)

        is_new = product is None
        if is_new:
            base_slug = slugify(parsed.url.rstrip("/").rsplit("/", 1)[-1]) or slugify(parsed.name)
            slug, n = base_slug, 2
            while (
                await session.execute(select(Product.id).where(Product.slug == slug))
            ).first():
                slug, n = f"{base_slug}-{n}", n + 1
            product = Product(slug=slug, name=parsed.name, price=Decimal(0), images=[], attributes=[])
            session.add(product)
            self.stats["products_created"] += 1
        else:
            self.stats["products_updated"] += 1

        product.source_url = parsed.url
        product.source_id = parsed.source_id
        product.in_stock = parsed.in_stock
        product.synced_at = datetime.now(UTC)
        if is_new:
            product.is_active = True
        self._apply_prices(product, parsed.price or item.price, parsed.old_price)
        if product.category_id is None and category:
            product.category_id = category.id

        if is_new or not product.content_locked:
            product.name = parsed.name or item.name
            product.sku = parsed.sku
            product.brand = parsed.brand
            product.description = parsed.description
            product.documents = parsed.documents or None
            product.meta_description = (parsed.meta_description or "")[:500] or None
            highlights = item.highlights or [
                {"name": a["name"], "value": a["value"]}
                for a in parsed.attributes
                if a["name"].lower() not in HIGHLIGHT_EXCLUDE and len(a["value"]) < 40
            ][:3]
            product.highlights = highlights or None

            product.attributes.clear()
            for a in parsed.attributes:
                product.attributes.append(
                    ProductAttribute(
                        group=(a["group"] or None) and a["group"][:255],
                        name=a["name"][:255],
                        value=a["value"][:1000],
                        sort_order=a["sort_order"],
                    )
                )

            if images:
                keep_manual = [img for img in product.images if not img.source_url]
                by_src = {img.source_url: img for img in product.images if img.source_url}
                new_list: list[ProductImage] = []
                for idx, (src, local) in enumerate(images):
                    img = by_src.pop(src, None) or ProductImage(source_url=src, url=local)
                    img.url = local
                    img.alt = product.name[:500]
                    img.sort_order = idx
                    new_list.append(img)
                for idx, img in enumerate(keep_manual, start=len(new_list)):
                    img.sort_order = idx
                product.images[:] = new_list + keep_manual

    async def _deactivate_missing(self, session: AsyncSession, seen: set[str]) -> None:
        imported = (
            await session.execute(
                select(Product).where(Product.source_url.is_not(None), Product.is_active.is_(True))
            )
        ).scalars().all()
        missing = [p for p in imported if p.source_url not in seen]
        # защита: если источник отдал подозрительно мало товаров — ничего не снимаем
        if not missing or len(seen) < len(imported) * 0.5:
            if missing:
                self.log(
                    f"Пропущено снятие {len(missing)} товаров: источник вернул слишком мало позиций"
                )
            return
        for p in missing:
            p.in_stock = False
            p.is_active = False
        self.stats["products_deactivated"] = len(missing)
        await session.commit()


async def auto_sync_loop() -> None:
    """Периодическая синхронизация по расписанию (PARSER_AUTO_SYNC_HOURS > 0).

    Отсчёт идёт от последнего импорта в БД, а не от старта процесса: перезапуски и деплои
    не вызывают лишних проходов по источнику. Суточный импорт — ночью в PARSER_AUTO_SYNC_HOUR
    по Москве, со случайной задержкой, чтобы запросы не приходили минута в минуту.
    """
    hours = settings.parser_auto_sync_hours
    if hours <= 0:
        return
    while True:
        await asyncio.sleep(600)
        try:
            if ImportRunner.is_running():
                continue
            last = await ImportRunner.last_started_at()
            if last and datetime.now(UTC) - last < timedelta(hours=hours) - timedelta(hours=1):
                continue
            if hours >= 24 and datetime.now(MSK).hour != settings.parser_auto_sync_hour:
                continue
            await asyncio.sleep(random.uniform(0, 1800))
            await ImportRunner.start(mode="full", trigger="schedule")
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001
            log.exception("Scheduled import failed to start")
