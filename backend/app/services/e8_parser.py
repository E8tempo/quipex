"""Парсер каталога e8.ru (1С-Битрикс).

Работает только с HTML-страницами, без авторизации:
  1. Главная страница каталога → дерево категорий из меню.
  2. Страница категории → карточки товаров (с пагинацией PAGEN_1).
  3. Страница товара → название, артикул, цены, фото, характеристики, описание, документы.
"""

import asyncio
import json
import logging
import re
from dataclasses import dataclass, field
from decimal import Decimal
from html import unescape
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup, Tag

from app.core.config import settings
from app.core.utils import parse_price

log = logging.getLogger(__name__)

RETRY_STATUSES = {429, 502, 503, 504}
BLOCK_THRESHOLD = 15


def describe_error(exc: BaseException | None) -> str:
    """Таймауты httpx приходят с пустым текстом — добавляем тип и HTTP-код."""
    if isinstance(exc, httpx.HTTPStatusError):
        return f"HTTP {exc.response.status_code}"
    if exc is None:
        return "неизвестная ошибка"
    text = str(exc)
    return f"{type(exc).__name__}: {text}" if text else type(exc).__name__


@dataclass
class ParsedCategory:
    url: str
    name: str
    slug: str
    parent_url: str | None = None
    image: str | None = None
    sort_order: int = 500


@dataclass
class ParsedListItem:
    url: str
    source_id: str | None
    name: str
    price: Decimal | None
    old_price: Decimal | None
    highlights: list[dict]
    category_url: str


@dataclass
class ParsedProduct:
    url: str
    source_id: str | None
    name: str
    sku: str | None
    brand: str | None
    price: Decimal | None
    old_price: Decimal | None
    in_stock: bool
    description: str | None
    images: list[str] = field(default_factory=list)
    attributes: list[dict] = field(default_factory=list)
    documents: list[dict] = field(default_factory=list)
    breadcrumb_urls: list[str] = field(default_factory=list)
    meta_description: str | None = None


class E8Parser:
    def __init__(self) -> None:
        self.base = settings.parser_base_url.rstrip("/")
        self.catalog_path = settings.parser_catalog_path
        self._sem = asyncio.Semaphore(max(1, settings.parser_concurrency))
        self.consecutive_failures = 0
        self.client = httpx.AsyncClient(
            headers={
                "User-Agent": settings.parser_user_agent,
                "Accept-Language": "ru-RU,ru;q=0.9",
                "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
            },
            timeout=settings.parser_timeout_seconds,
            follow_redirects=True,
        )

    async def close(self) -> None:
        await self.client.aclose()

    async def __aenter__(self) -> "E8Parser":
        return self

    async def __aexit__(self, *exc) -> None:
        await self.close()

    # ---------- HTTP ----------

    def abs_url(self, href: str) -> str:
        return urljoin(self.base + "/", href)

    def is_catalog_url(self, url: str) -> bool:
        parsed = urlparse(url)
        return parsed.netloc == urlparse(self.base).netloc and parsed.path.startswith(
            self.catalog_path
        )

    async def _get(self, url: str, retries: int = 4) -> httpx.Response:
        """GET с паузой между запросами и отступлением при ограничении частоты (429/503)."""
        last_exc: Exception | None = None
        for attempt in range(retries):
            wait = 2.0 * 2**attempt
            async with self._sem:
                try:
                    resp = await self.client.get(url)
                    if settings.parser_delay_seconds:
                        await asyncio.sleep(settings.parser_delay_seconds)
                    if resp.status_code == 404:
                        raise FileNotFoundError(url)
                    if resp.status_code in RETRY_STATUSES:
                        wait = max(wait, self._retry_after(resp))
                    resp.raise_for_status()
                    self.consecutive_failures = 0
                    return resp
                except FileNotFoundError:
                    raise
                except (httpx.HTTPError, httpx.StreamError) as exc:
                    last_exc = exc
            await asyncio.sleep(min(wait, 120))
        self.consecutive_failures += 1
        raise RuntimeError(f"Не удалось загрузить {url}: {describe_error(last_exc)}")

    @staticmethod
    def _retry_after(resp: httpx.Response) -> float:
        try:
            return float(resp.headers.get("retry-after", 0))
        except ValueError:
            return 0

    @property
    def blocked(self) -> bool:
        """Подряд много неудач — источник, скорее всего, ограничил доступ."""
        return self.consecutive_failures >= BLOCK_THRESHOLD

    async def fetch(self, url: str) -> str:
        return (await self._get(url)).text

    async def fetch_bytes(self, url: str) -> tuple[bytes, str | None]:
        resp = await self._get(url, retries=2)
        return resp.content, resp.headers.get("content-type")

    # ---------- Категории ----------

    async def parse_categories(self) -> list[ParsedCategory]:
        html = await self.fetch(self.abs_url(self.catalog_path))
        soup = BeautifulSoup(html, "lxml")
        result: dict[str, ParsedCategory] = {}
        skip = settings.skip_category_slugs

        # Меню каталога: .section > a.section-name + a.subsection-name
        order = 0
        for section in soup.select("div.section"):
            top = section.select_one("a.section-name")
            if not top or not top.get("href"):
                continue
            url = self.abs_url(top["href"])
            if not self.is_catalog_url(url):
                continue
            slug = self._slug_from_url(url)
            if not slug or slug in skip or url in result:
                continue
            order += 10
            result[url] = ParsedCategory(
                url=url,
                name=self._clean(top.get_text()),
                slug=slug,
                image=self._img_src(section.select_one("img")),
                sort_order=order,
            )
            sub_order = 0
            for sub in section.select("a.subsection-name"):
                if not sub.get("href"):
                    continue
                sub_url = self.abs_url(sub["href"])
                sub_slug = self._slug_from_url(sub_url)
                if not sub_slug or sub_slug in skip or sub_url in result:
                    continue
                sub_order += 10
                result[sub_url] = ParsedCategory(
                    url=sub_url,
                    name=re.sub(r"\s*\(\d+\)\s*$", "", self._clean(sub.get_text())),
                    slug=sub_slug,
                    parent_url=url,
                    sort_order=sub_order,
                )

        # Плитка разделов на странице каталога (иконки)
        for a in soup.select(".sections a[href]"):
            url = self.abs_url(a["href"])
            src = self._img_src(a.select_one("img"))
            if url in result and src and not result[url].image:
                result[url].image = src

        return list(result.values())

    # ---------- Списки товаров ----------

    async def parse_category_items(self, category_url: str, max_pages: int = 50) -> list[ParsedListItem]:
        items: dict[str, ParsedListItem] = {}
        for page in range(1, max_pages + 1):
            url = category_url if page == 1 else f"{category_url}?PAGEN_1={page}"
            try:
                html = await self.fetch(url)
            except FileNotFoundError:
                break
            soup = BeautifulSoup(html, "lxml")
            new = 0
            for block in soup.select('[data-entity="item"]'):
                item = self._parse_list_item(block, category_url)
                if item and item.url not in items:
                    items[item.url] = item
                    new += 1
            has_next = bool(soup.select_one(f'a[href*="PAGEN_1={page + 1}"]'))
            if not new or not has_next:
                break
        return list(items.values())

    def _parse_list_item(self, block: Tag, category_url: str) -> ParsedListItem | None:
        link = block.select_one("a.js-product-link[href]")
        if not link:
            return None
        url = self.abs_url(link["href"])
        if not self.is_catalog_url(url):
            return None
        name = link.get("data-name") or link.get("title") or self._clean(link.get_text())
        price = parse_price(link.get("data-price"))
        old_price = None
        old = block.select_one(".__price-old")
        if old and "display: none" not in (old.get("style") or "").replace("display:none", "display: none"):
            old_price = parse_price(old.get_text())
        highlights = []
        for row in block.select(".__details table tr"):
            cells = row.find_all("td")
            if len(cells) >= 2:
                n = self._clean(cells[0].get_text()).rstrip(":")
                v = self._clean(cells[-1].get_text())
                if n and v:
                    highlights.append({"name": n, "value": v})
        return ParsedListItem(
            url=url,
            source_id=link.get("data-id"),
            name=self._clean(name),
            price=price,
            old_price=old_price if old_price and price and old_price > price else None,
            highlights=highlights,
            category_url=category_url,
        )

    # ---------- Карточка товара ----------

    async def parse_product(self, url: str) -> ParsedProduct:
        html = await self.fetch(url)
        soup = BeautifulSoup(html, "lxml")

        ld = self._product_ld(soup)
        h1 = soup.select_one("h1")
        name = self._clean(h1.get_text()) if h1 else (ld.get("name") or "")

        sku = ld.get("sku")
        if not sku:
            art = soup.select_one(".article")
            if art:
                sku = self._clean(art.get_text()).replace("Артикул", "").strip() or None

        offers = ld.get("offers") or {}
        if isinstance(offers, list):
            offers = offers[0] if offers else {}
        price = parse_price(str(offers.get("price") or ""))
        if price is None:
            cur = soup.select_one(".current-price")
            price = parse_price(cur.get_text()) if cur else None
        in_stock = "InStock" in str(offers.get("availability", "InStock"))

        old_price = None
        old = soup.select_one(".__line--price .old-price .__price-old, .old-price .__price-old")
        if old:
            style = (old.get("style") or "").replace(" ", "")
            if "display:none" not in style:
                old_price = parse_price(old.get_text())
        if old_price and price and old_price <= price:
            old_price = None

        source_id = None
        m = re.search(r'"detail".*?"id"\s*:\s*"(\d+)"', html, re.S)
        if m:
            source_id = m.group(1)

        brand = None
        bm = re.search(r'"brand"\s*:\s*"([^"]+)"', html)
        if bm:
            brand = bm.group(1)

        images: list[str] = []
        for a in soup.select('a[data-fancybox="__gallery_new"][href]'):
            src = self.abs_url(a["href"])
            if src not in images and not src.lower().endswith((".mp4", ".webm")):
                images.append(src)
        if not images:
            og = soup.select_one('meta[property="og:image"]')
            if og and og.get("content"):
                images.append(self.abs_url(og["content"]))

        description = None
        desc = soup.select_one("#description .product-description-text")
        if desc:
            description = self._clean_html(desc)

        attributes: list[dict] = []
        order = 0
        for group in soup.select("#characteristic .group"):
            gname_el = group.select_one(".group-name span")
            gname = self._clean(gname_el.get_text()) if gname_el else None
            for opt in group.select(".option"):
                n_el = opt.select_one(".name")
                v_el = opt.select_one(".value")
                if not n_el or not v_el:
                    continue
                n = self._clean(n_el.get_text())
                v = self._clean(v_el.get_text(" "))
                if n and v:
                    order += 1
                    attributes.append({"group": gname, "name": n, "value": v, "sort_order": order})

        documents: list[dict] = []
        for a in soup.select("#documentation a.__document[href]"):
            title_el = a.select_one(".cell span")
            size_el = a.select_one("em")
            documents.append(
                {
                    "title": self._clean(title_el.get_text()) if title_el else "Документ",
                    "url": self.abs_url(a["href"]),
                    "size": self._clean(size_el.get_text()) if size_el else None,
                }
            )

        crumbs = [
            self.abs_url(a["href"])
            for a in soup.select('.breadcrumbs a[itemprop="item"][href]')
            if self.is_catalog_url(self.abs_url(a["href"]))
        ]
        meta = soup.select_one('meta[name="description"]')

        return ParsedProduct(
            url=url,
            source_id=source_id,
            name=name,
            sku=sku,
            brand=brand,
            price=price,
            old_price=old_price,
            in_stock=in_stock,
            description=description,
            images=images,
            attributes=attributes,
            documents=documents,
            breadcrumb_urls=crumbs,
            meta_description=meta.get("content") if meta else None,
        )

    # ---------- helpers ----------

    def _product_ld(self, soup: BeautifulSoup) -> dict:
        for script in soup.select('script[type="application/ld+json"]'):
            try:
                data = json.loads(script.string or "")
            except (json.JSONDecodeError, TypeError):
                continue
            candidates = data if isinstance(data, list) else [data]
            for c in candidates:
                if isinstance(c, dict) and c.get("@type") == "Product":
                    return c
        return {}

    def _img_src(self, img: Tag | None) -> str | None:
        if not img:
            return None
        for attr in ("data-src", "data-lazyload-src", "src"):
            src = img.get(attr)
            if src and "1px" not in src and not src.startswith("data:"):
                return self.abs_url(src)
        return None

    def _slug_from_url(self, url: str) -> str:
        path = urlparse(url).path.strip("/").split("/")
        return path[-1] if len(path) > 1 else ""

    @staticmethod
    def _clean(text: str | None) -> str:
        return re.sub(r"\s+", " ", unescape(text or "").replace("\xa0", " ")).strip()

    ALLOWED_TAGS = {"p", "br", "ul", "ol", "li", "strong", "b", "em", "i", "h2", "h3", "h4", "table", "thead", "tbody", "tr", "td", "th"}

    def _clean_html(self, el: Tag) -> str:
        """Оставляет только безопасную разметку (без ссылок, скриптов, стилей и картинок)."""
        for bad in el.select("script, style, iframe, img, video, noscript, form"):
            bad.decompose()
        for tag in el.find_all(True):
            if tag.name not in self.ALLOWED_TAGS:
                tag.unwrap()
            else:
                tag.attrs = {}
        html = el.decode_contents().replace("\xa0", " ").replace("\t", " ")
        html = re.sub(r"[ ]{2,}", " ", html)
        html = re.sub(r"\n\s*\n+", "\n", html).strip()
        # Голый текст вне <p> — оборачиваем абзацами
        if "<p>" not in html and "<li>" not in html:
            parts = [p.strip() for p in re.split(r"<br\s*/?>|\n", html) if p.strip()]
            html = "".join(f"<p>{p}</p>" for p in parts)
        return html
