from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import SiteSetting

# Значения по умолчанию — меняются в админке (раздел «Настройки»).
DEFAULTS: dict[str, Any] = {
    "site_name": settings.site_name,
    "tagline": "Оптовые и розничные поставки систем отопления",
    "phone": "",
    "phone_secondary": "",
    "email": "",
    "address": "",
    "work_hours": "Пн–Пт 9:00–19:00, Сб 10:00–16:00",
    "inn": "",
    "legal_name": "",
    "telegram": "",
    "whatsapp": "",
    "vk": "",
    "map_embed_url": "",
    "hero_title": "Системы отопления для дома и бизнеса",
    "hero_subtitle": "Котлы, водонагреватели, бойлеры и комплектующие с доставкой по России. Розница и опт.",
    "announcement": "",
    "free_delivery_from": 0,
    "wholesale_min_qty": 5,
    "wholesale_min_order_sum": 100000,
    "wholesale_default_discount_percent": 10,
    "import_price_markup_percent": 0,
    "import_wholesale_from_retail": True,
    "delivery_methods": [
        {"id": "pickup", "title": "Самовывоз со склада", "price": 0},
        {"id": "courier", "title": "Доставка по городу", "price": 0},
        {"id": "tk", "title": "Транспортная компания", "price": 0},
    ],
    "payment_methods": [
        {"id": "cash", "title": "Наличными или картой при получении"},
        {"id": "invoice", "title": "Безналичный расчёт по счёту (для юр. лиц)"},
        {"id": "online", "title": "Онлайн-оплата после подтверждения заказа"},
    ],
    "seo_title": "",
    "seo_description": "",
}

PUBLIC_KEYS = [k for k in DEFAULTS if not k.startswith("import_")]


async def get_all_settings(session: AsyncSession) -> dict[str, Any]:
    rows = (await session.execute(select(SiteSetting))).scalars().all()
    data = dict(DEFAULTS)
    for row in rows:
        data[row.key] = row.value
    return data


async def get_public_settings(session: AsyncSession) -> dict[str, Any]:
    data = await get_all_settings(session)
    return {k: data.get(k) for k in PUBLIC_KEYS}


async def get_setting(session: AsyncSession, key: str) -> Any:
    row = await session.get(SiteSetting, key)
    return row.value if row else DEFAULTS.get(key)


async def update_settings(session: AsyncSession, values: dict[str, Any]) -> dict[str, Any]:
    for key, value in values.items():
        if key not in DEFAULTS:
            continue
        row = await session.get(SiteSetting, key)
        if row:
            row.value = value
        else:
            session.add(SiteSetting(key=key, value=value))
    await session.commit()
    return await get_all_settings(session)
