"""Заказы, заявки и отзывы."""

import csv
import io
from math import ceil
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_session
from app.core.security import CurrentUser
from app.models import Lead, LeadStatus, LeadType, Order, OrderItem, OrderStatus, Product, Review
from app.schemas import (
    LeadOut,
    LeadUpdate,
    OrderListItem,
    OrderOut,
    OrderUpdate,
    Page,
    ReviewAdminOut,
    ReviewUpdate,
)

router = APIRouter(tags=["admin:sales"])
Session = Annotated[AsyncSession, Depends(get_session)]


def _orders_query(q: str | None, status: OrderStatus | None):
    stmt = select(Order)
    if status:
        stmt = stmt.where(Order.status == status)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                Order.number.ilike(like),
                Order.name.ilike(like),
                Order.phone.ilike(like),
                Order.email.ilike(like),
                Order.company.ilike(like),
            )
        )
    return stmt


@router.get("/orders", response_model=Page[OrderListItem])
async def list_orders(
    session: Session,
    _: CurrentUser,
    q: str | None = None,
    status: OrderStatus | None = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(30, ge=1, le=200),
) -> Page[OrderListItem]:
    stmt = _orders_query(q, status)
    total = (await session.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    orders = (
        await session.execute(
            stmt.order_by(Order.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
        )
    ).scalars().all()
    counts = dict(
        (
            await session.execute(
                select(OrderItem.order_id, func.sum(OrderItem.quantity))
                .where(OrderItem.order_id.in_([o.id for o in orders]))
                .group_by(OrderItem.order_id)
            )
        ).all()
    )
    items = []
    for o in orders:
        item = OrderListItem.model_validate(o)
        item.items_count = int(counts.get(o.id) or 0)
        items.append(item)
    return Page(
        items=items, total=total, page=page, per_page=per_page, pages=max(1, ceil(total / per_page))
    )


@router.get("/orders/export.csv")
async def export_orders(
    session: Session, _: CurrentUser, q: str | None = None, status: OrderStatus | None = None
) -> StreamingResponse:
    orders = (
        await session.execute(_orders_query(q, status).order_by(Order.created_at.desc()))
    ).scalars().all()
    buf = io.StringIO()
    buf.write("﻿")
    w = csv.writer(buf, delimiter=";")
    w.writerow(["Номер", "Дата", "Статус", "Тип", "Имя", "Телефон", "Email", "Компания", "ИНН", "Город", "Адрес", "Сумма"])
    for o in orders:
        w.writerow([
            o.number, o.created_at.strftime("%d.%m.%Y %H:%M"), o.status.value, o.customer_type.value,
            o.name, o.phone, o.email or "", o.company or "", o.inn or "", o.city or "", o.address or "",
            str(o.total).replace(".", ","),
        ])  # fmt: skip
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="orders.csv"'},
    )


async def _load_order(session: AsyncSession, order_id: int) -> Order:
    order = (
        await session.execute(
            select(Order)
            .options(selectinload(Order.items))
            .where(Order.id == order_id)
            .execution_options(populate_existing=True)
        )
    ).scalar_one_or_none()
    if not order:
        raise HTTPException(404, "Заказ не найден")
    return order


@router.get("/orders/{order_id}", response_model=OrderOut)
async def get_order(order_id: int, session: Session, _: CurrentUser) -> Order:
    return await _load_order(session, order_id)


@router.patch("/orders/{order_id}", response_model=OrderOut)
async def update_order(
    order_id: int, data: OrderUpdate, session: Session, _: CurrentUser
) -> Order:
    order = await _load_order(session, order_id)
    values = data.model_dump(exclude_unset=True)
    for k, v in values.items():
        setattr(order, k, v)
    if "discount" in values:
        order.total = max(order.subtotal - order.discount, 0)
    await session.commit()
    return await _load_order(session, order_id)


@router.delete("/orders/{order_id}", status_code=204)
async def delete_order(order_id: int, session: Session, _: CurrentUser) -> None:
    order = await _load_order(session, order_id)
    await session.delete(order)
    await session.commit()


# ---------- Заявки ----------


@router.get("/leads", response_model=Page[LeadOut])
async def list_leads(
    session: Session,
    _: CurrentUser,
    type: LeadType | None = None,
    status: LeadStatus | None = None,
    q: str | None = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(30, ge=1, le=200),
) -> Page[LeadOut]:
    stmt = select(Lead)
    if type:
        stmt = stmt.where(Lead.type == type)
    if status:
        stmt = stmt.where(Lead.status == status)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Lead.name.ilike(like), Lead.phone.ilike(like), Lead.company.ilike(like)))
    total = (await session.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    rows = (
        await session.execute(
            stmt.order_by(Lead.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
        )
    ).scalars().all()
    return Page(
        items=[LeadOut.model_validate(r) for r in rows],
        total=total,
        page=page,
        per_page=per_page,
        pages=max(1, ceil(total / per_page)),
    )


@router.patch("/leads/{lead_id}", response_model=LeadOut)
async def update_lead(lead_id: int, data: LeadUpdate, session: Session, _: CurrentUser) -> Lead:
    lead = await session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "Заявка не найдена")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(lead, k, v)
    await session.commit()
    await session.refresh(lead)
    return lead


@router.delete("/leads/{lead_id}", status_code=204)
async def delete_lead(lead_id: int, session: Session, _: CurrentUser) -> None:
    lead = await session.get(Lead, lead_id)
    if lead:
        await session.delete(lead)
        await session.commit()


# ---------- Отзывы ----------


@router.get("/reviews", response_model=list[ReviewAdminOut])
async def list_reviews(
    session: Session, _: CurrentUser, pending: bool = False
) -> list[ReviewAdminOut]:
    stmt = select(Review, Product.name).join(Product, Product.id == Review.product_id)
    if pending:
        stmt = stmt.where(Review.is_published.is_(False))
    rows = (await session.execute(stmt.order_by(Review.created_at.desc()).limit(500))).all()
    result = []
    for review, name in rows:
        item = ReviewAdminOut.model_validate(review)
        item.product_name = name
        result.append(item)
    return result


@router.patch("/reviews/{review_id}", response_model=ReviewAdminOut)
async def update_review(
    review_id: int, data: ReviewUpdate, session: Session, _: CurrentUser
) -> ReviewAdminOut:
    review = await session.get(Review, review_id)
    if not review:
        raise HTTPException(404, "Отзыв не найден")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(review, k, v)
    await session.commit()
    await session.refresh(review)
    return ReviewAdminOut.model_validate(review)


@router.delete("/reviews/{review_id}", status_code=204)
async def delete_review(review_id: int, session: Session, _: CurrentUser) -> None:
    review = await session.get(Review, review_id)
    if review:
        await session.delete(review)
        await session.commit()
