"""Расчёт цен.

Обычный покупатель: розничная цена; оптовая — при заказе от N шт. позиции или от суммы корзины.
Партнёр (одобренный): цена его типа цен (из 1С) → персональная скидка от розницы →
оптовая цена товара → розница.
"""

from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.utils import round_money
from app.models import Customer, PriceType, Product, ProductPrice
from app.schemas import CartLine, QuoteLine, QuoteOut
from app.services import catalog
from app.services.site_settings import get_all_settings


@dataclass
class PartnerPricing:
    price_type_id: int | None
    discount: Decimal | None
    prices: dict[int, Decimal]  # product_id -> цена по типу


async def partner_price_type_id(session: AsyncSession, customer: Customer) -> int | None:
    if customer.price_type_id:
        return customer.price_type_id
    return (
        await session.execute(
            select(PriceType.id).where(PriceType.is_default_partner.is_(True), PriceType.is_active.is_(True)).limit(1)
        )
    ).scalar_one_or_none()


async def load_partner_pricing(
    session: AsyncSession, customer: Customer | None, product_ids: list[int]
) -> PartnerPricing | None:
    if not customer or not customer.is_partner:
        return None
    type_id = await partner_price_type_id(session, customer)
    prices: dict[int, Decimal] = {}
    if type_id and product_ids:
        rows = await session.execute(
            select(ProductPrice.product_id, ProductPrice.price).where(
                ProductPrice.price_type_id == type_id, ProductPrice.product_id.in_(product_ids)
            )
        )
        prices = {pid: price for pid, price in rows.all() if price and price > 0}
    disc = customer.discount_percent if customer.discount_percent and customer.discount_percent > 0 else None
    return PartnerPricing(type_id, disc, prices)


def partner_price(p: Product, pp: PartnerPricing) -> Decimal:
    if p.id in pp.prices:
        return pp.prices[p.id]
    if pp.discount:
        return round_money(p.price * (1 - pp.discount / 100))
    if p.wholesale_price and p.wholesale_price < p.price:
        return p.wholesale_price
    return p.price


async def quote(
    session: AsyncSession, lines: list[CartLine], customer: Customer | None = None
) -> tuple[QuoteOut, dict[int, Product]]:
    """Считает корзину на сервере: розничные/оптовые/партнёрские цены, итог, экономию."""
    qty_by_id: dict[int, int] = {}
    for line in lines:
        qty_by_id[line.product_id] = qty_by_id.get(line.product_id, 0) + line.quantity

    stmt = catalog.base_product_query().where(
        Product.id.in_(list(qty_by_id)), Product.is_active.is_(True)
    )
    products = {p.id: p for p in (await session.execute(stmt)).scalars().all()}
    cfg = await get_all_settings(session)
    min_qty = int(cfg.get("wholesale_min_qty") or 0)
    min_sum = Decimal(str(cfg.get("wholesale_min_order_sum") or 0))
    pp = await load_partner_pricing(session, customer, list(products))

    retail_total = sum(
        (products[pid].price * qty for pid, qty in qty_by_id.items() if pid in products),
        Decimal(0),
    )
    whole_cart_wholesale = min_sum > 0 and retail_total >= min_sum

    cards = {c.id: c for c in await catalog.to_cards(session, list(products.values()))}
    items: list[QuoteLine] = []
    subtotal = Decimal(0)
    count = 0
    for pid, qty in qty_by_id.items():
        p = products.get(pid)
        if not p:
            continue
        if pp:
            price, kind = partner_price(p, pp), "partner"
        elif (
            p.wholesale_price
            and p.wholesale_price < p.price
            and ((min_qty > 0 and qty >= min_qty) or whole_cart_wholesale)
        ):
            price, kind = p.wholesale_price, "wholesale"
        else:
            price, kind = p.price, "retail"
        total = price * qty
        subtotal += total
        count += qty
        items.append(
            QuoteLine(
                product=cards[pid],
                quantity=qty,
                price=price,
                total=total,
                is_wholesale_price=kind != "retail",
                price_kind=kind,
            )
        )

    out = QuoteOut(
        items=items,
        subtotal=subtotal,
        retail_total=retail_total,
        savings=retail_total - subtotal,
        total=subtotal,
        count=count,
        missing=[pid for pid in qty_by_id if pid not in products],
        is_partner=pp is not None,
    )
    return out, products
