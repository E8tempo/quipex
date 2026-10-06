"""Клиенты (покупатели и партнёры), типы цен и цены товаров по типам."""

from math import ceil
from typing import Annotated, Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import CUSTOMER, CurrentUser, revoke_subject
from app.models import ClientKind, Customer, Order, OrderStatus, PartnerStatus, PriceType, Product, ProductPrice
from app.schemas import (
    CustomerAdminOut,
    CustomerAdminUpdate,
    OrderListItem,
    Page,
    PriceTypeIn,
    PriceTypeOut,
    ProductPriceIn,
    ProductPriceOut,
)
from app.services.notify import send_email

router = APIRouter(tags=["admin:customers"])
Session = Annotated[AsyncSession, Depends(get_session)]


async def _admin_out(db: AsyncSession, c: Customer) -> CustomerAdminOut:
    out = CustomerAdminOut.model_validate(c)
    if c.price_type_id:
        pt = await db.get(PriceType, c.price_type_id)
        out.price_type_name = pt.name if pt else None
    cnt, total = (
        await db.execute(
            select(func.count(Order.id), func.coalesce(func.sum(Order.total), 0)).where(
                Order.customer_id == c.id, Order.status != OrderStatus.cancelled
            )
        )
    ).one()
    out.orders_count, out.orders_total = cnt, total
    return out


@router.get("/customers", response_model=Page[CustomerAdminOut])
async def list_customers(
    db: Session,
    _: CurrentUser,
    q: str | None = None,
    kind: Literal["all", "retail", "partner", "pending"] = "all",
    page: int = Query(1, ge=1),
    per_page: int = Query(30, ge=1, le=200),
) -> Page[CustomerAdminOut]:
    stmt = select(Customer)
    if kind == "retail":
        stmt = stmt.where(Customer.kind == ClientKind.retail)
    elif kind == "partner":
        stmt = stmt.where(Customer.kind == ClientKind.partner, Customer.partner_status == PartnerStatus.approved)
    elif kind == "pending":
        stmt = stmt.where(Customer.partner_status == PartnerStatus.pending)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(Customer.name.ilike(like), Customer.email.ilike(like), Customer.phone.ilike(like),
                Customer.company.ilike(like), Customer.inn.ilike(like))
        )  # fmt: skip
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    rows = (
        await db.execute(stmt.order_by(Customer.created_at.desc()).offset((page - 1) * per_page).limit(per_page))
    ).scalars().all()
    return Page(
        items=[await _admin_out(db, c) for c in rows],
        total=total,
        page=page,
        per_page=per_page,
        pages=max(1, ceil(total / per_page)),
    )


@router.get("/customers/{customer_id}", response_model=CustomerAdminOut)
async def get_customer(customer_id: int, db: Session, _: CurrentUser) -> CustomerAdminOut:
    c = await db.get(Customer, customer_id)
    if not c:
        raise HTTPException(404, "Клиент не найден")
    return await _admin_out(db, c)


@router.get("/customers/{customer_id}/orders", response_model=list[OrderListItem])
async def customer_orders(customer_id: int, db: Session, _: CurrentUser) -> list[Order]:
    rows = await db.execute(
        select(Order).where(Order.customer_id == customer_id).order_by(Order.created_at.desc()).limit(100)
    )
    return list(rows.scalars().all())


@router.patch("/customers/{customer_id}", response_model=CustomerAdminOut)
async def update_customer(
    customer_id: int, data: CustomerAdminUpdate, db: Session, _: CurrentUser, bg: BackgroundTasks
) -> CustomerAdminOut:
    c = await db.get(Customer, customer_id)
    if not c:
        raise HTTPException(404, "Клиент не найден")
    values = data.model_dump(exclude_unset=True)
    if values.get("price_type_id") is not None and not await db.get(PriceType, values["price_type_id"]):
        raise HTTPException(422, "Тип цен не найден")
    was_partner = c.is_partner
    for k, v in values.items():
        setattr(c, k, v)
    if c.partner_status == PartnerStatus.approved:
        c.kind = ClientKind.partner
    if values.get("is_active") is False:
        await revoke_subject(db, CUSTOMER, c.id)  # блокировка действует сразу
    await db.commit()
    if not was_partner and c.is_partner:
        bg.add_task(
            send_email,
            "Партнёрский доступ открыт",
            f"Здравствуйте, {c.name}!\n\nВаша заявка на партнёрство одобрена. "
            "Войдите в личный кабинет на сайте — вам доступны партнёрские цены.",
            c.email,
        )
    return await _admin_out(db, c)


@router.post("/customers/{customer_id}/logout-all")
async def logout_customer(customer_id: int, db: Session, _: CurrentUser) -> dict:
    await revoke_subject(db, CUSTOMER, customer_id)
    await db.commit()
    return {"ok": True}


# ---------- типы цен ----------


@router.get("/price-types", response_model=list[PriceTypeOut])
async def list_price_types(db: Session, _: CurrentUser) -> list[PriceTypeOut]:
    types = (await db.execute(select(PriceType).order_by(PriceType.name))).scalars().all()
    prices = dict(
        (await db.execute(select(ProductPrice.price_type_id, func.count()).group_by(ProductPrice.price_type_id))).all()
    )
    customers = dict(
        (await db.execute(select(Customer.price_type_id, func.count()).group_by(Customer.price_type_id))).all()
    )
    out = []
    for t in types:
        o = PriceTypeOut.model_validate(t)
        o.prices_count = prices.get(t.id, 0)
        o.customers_count = customers.get(t.id, 0)
        out.append(o)
    return out


async def _save_type(db: AsyncSession, t: PriceType, data: PriceTypeIn) -> PriceTypeOut:
    if data.external_id:
        clash = (
            await db.execute(select(PriceType.id).where(PriceType.external_id == data.external_id, PriceType.id != t.id))
        ).first()
        if clash:
            raise HTTPException(409, "Тип цен с таким Ид 1С уже есть")
    for k, v in data.model_dump().items():
        setattr(t, k, v)
    t.external_id = data.external_id or None
    db.add(t)
    await db.flush()
    if data.is_default_partner:
        await db.execute(update(PriceType).where(PriceType.id != t.id).values(is_default_partner=False))
    await db.commit()
    return PriceTypeOut.model_validate(t)


@router.post("/price-types", response_model=PriceTypeOut, status_code=201)
async def create_price_type(data: PriceTypeIn, db: Session, _: CurrentUser) -> PriceTypeOut:
    return await _save_type(db, PriceType(name=data.name), data)


@router.put("/price-types/{type_id}", response_model=PriceTypeOut)
async def update_price_type(type_id: int, data: PriceTypeIn, db: Session, _: CurrentUser) -> PriceTypeOut:
    t = await db.get(PriceType, type_id)
    if not t:
        raise HTTPException(404, "Тип цен не найден")
    return await _save_type(db, t, data)


@router.delete("/price-types/{type_id}", status_code=204)
async def delete_price_type(type_id: int, db: Session, _: CurrentUser) -> None:
    t = await db.get(PriceType, type_id)
    if t:
        await db.delete(t)
        await db.commit()


# ---------- цены товара по типам ----------


@router.get("/products/{product_id}/prices", response_model=list[ProductPriceOut])
async def product_prices(product_id: int, db: Session, _: CurrentUser) -> list[ProductPriceOut]:
    types = (await db.execute(select(PriceType).order_by(PriceType.name))).scalars().all()
    prices = dict(
        (
            await db.execute(
                select(ProductPrice.price_type_id, ProductPrice.price).where(ProductPrice.product_id == product_id)
            )
        ).all()
    )
    return [ProductPriceOut(price_type_id=t.id, price_type_name=t.name, price=prices.get(t.id)) for t in types]


@router.put("/products/{product_id}/prices", response_model=list[ProductPriceOut])
async def set_product_prices(
    product_id: int, data: list[ProductPriceIn], db: Session, user: CurrentUser
) -> list[ProductPriceOut]:
    if not await db.get(Product, product_id):
        raise HTTPException(404, "Товар не найден")
    for item in data:
        await db.execute(
            delete(ProductPrice).where(
                ProductPrice.product_id == product_id, ProductPrice.price_type_id == item.price_type_id
            )
        )
        if item.price is not None and item.price > 0:
            db.add(ProductPrice(product_id=product_id, price_type_id=item.price_type_id, price=item.price))
    await db.commit()
    return await product_prices(product_id, db, user)
