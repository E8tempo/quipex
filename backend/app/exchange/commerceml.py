"""Обмен с 1С по протоколу CommerceML 2 («Обмен с сайтом», 1c_exchange).

Готово:
  * модель данных: Product.external_id, PriceType (+external_id), ProductPrice,
    Customer.external_id (контрагент), Order.external_id / exported_at;
  * эндпоинт протокола: checkauth, init, приём файлов (mode=file).

Осталось реализовать (функции ниже):
  * import.xml  — Классификатор/Группы → Category, Каталог/Товары → Product (по Ид);
  * offers.xml  — ТипыЦен → PriceType, Предложения/Цены → ProductPrice, Количество → stock;
  * sale/query  — выгрузка новых заказов (Order.exported_at IS NULL) в orders.xml;
  * sale/file   — приём статусов заказов из 1С.

Сопоставление: товар по Product.external_id (Ид 1С), при первом обмене — по артикулу (sku);
тип цен по PriceType.external_id; контрагент по Customer.external_id или ИНН.
"""

from pathlib import Path

from app.core.config import settings


def exchange_dir() -> Path:
    path = Path(settings.media_dir).parent / "exchange_1c"
    path.mkdir(parents=True, exist_ok=True)
    return path


def safe_filename(name: str) -> str:
    # 1С присылает пути вида import_files/ab/abcd.jpg — сохраняем структуру, но без выхода за каталог
    parts = [p for p in name.replace("\\", "/").split("/") if p not in ("", ".", "..")]
    return "/".join(parts)


async def import_catalog_file(filename: str) -> None:
    raise NotImplementedError("Разбор import.xml ещё не реализован")


async def import_offers_file(filename: str) -> None:
    raise NotImplementedError("Разбор offers.xml ещё не реализован")


async def export_orders_xml() -> bytes:
    raise NotImplementedError("Выгрузка заказов в 1С ещё не реализована")
