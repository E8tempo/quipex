"""Дашборд, настройки, импорт, пользователи, страницы."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import ADMIN, CurrentUser, SuperUser, hash_password, revoke_subject
from app.models import (
    Customer,
    ImportJob,
    PartnerStatus,
    Lead,
    LeadStatus,
    Order,
    OrderItem,
    OrderStatus,
    Page,
    Product,
    Review,
    User,
)
from app.schemas import (
    DashboardOut,
    DayPoint,
    ImportJobOut,
    ImportStart,
    OrderListItem,
    PageIn,
    PageOut,
    UserCreate,
    UserOut,
    UserUpdate,
)
from app.services import media
from app.services.importer import ImportRunner
from app.services.site_settings import DEFAULTS, get_all_settings, update_settings

router = APIRouter(tags=["admin:system"])
Session = Annotated[AsyncSession, Depends(get_session)]


@router.get("/dashboard", response_model=DashboardOut)
async def dashboard(session: Session, _: CurrentUser) -> DashboardOut:
    now = datetime.now(UTC)
    since = (now - timedelta(days=29)).replace(hour=0, minute=0, second=0, microsecond=0)

    async def scalar(stmt) -> Any:
        return (await session.execute(stmt)).scalar_one()

    orders_total = await scalar(select(func.count(Order.id)))
    orders_new = await scalar(select(func.count(Order.id)).where(Order.status == OrderStatus.new))
    recent_rows = (
        await session.execute(
            select(Order.created_at, Order.total).where(
                Order.created_at >= since, Order.status != OrderStatus.cancelled
            )
        )
    ).all()
    by_day: dict[str, list] = {
        (since + timedelta(days=i)).strftime("%Y-%m-%d"): [0, Decimal(0)] for i in range(30)
    }
    for created, total in recent_rows:
        key = created.strftime("%Y-%m-%d")
        if key in by_day:
            by_day[key][0] += 1
            by_day[key][1] += total or 0
    revenue = sum((v[1] for v in by_day.values()), Decimal(0))
    orders_30 = sum(v[0] for v in by_day.values())

    recent = (
        await session.execute(select(Order).order_by(Order.created_at.desc()).limit(8))
    ).scalars().all()
    top = (
        await session.execute(
            select(OrderItem.product_id, OrderItem.name, func.sum(OrderItem.quantity).label("qty"), func.sum(OrderItem.total).label("sum"))
            .join(Order, Order.id == OrderItem.order_id)
            .where(Order.created_at >= since, Order.status != OrderStatus.cancelled)
            .group_by(OrderItem.product_id, OrderItem.name)
            .order_by(func.sum(OrderItem.total).desc())
            .limit(5)
        )
    ).all()
    last_job = (
        await session.execute(select(ImportJob).order_by(ImportJob.id.desc()).limit(1))
    ).scalar_one_or_none()

    return DashboardOut(
        orders_total=orders_total,
        orders_new=orders_new,
        revenue_30d=revenue,
        orders_30d=orders_30,
        avg_check_30d=(revenue / orders_30).quantize(Decimal("1")) if orders_30 else Decimal(0),
        products_total=await scalar(select(func.count(Product.id))),
        products_active=await scalar(select(func.count(Product.id)).where(Product.is_active.is_(True))),
        products_out_of_stock=await scalar(
            select(func.count(Product.id)).where(Product.is_active.is_(True), Product.in_stock.is_(False))
        ),
        leads_new=await scalar(select(func.count(Lead.id)).where(Lead.status == LeadStatus.new)),
        reviews_pending=await scalar(select(func.count(Review.id)).where(Review.is_published.is_(False))),
        chart=[DayPoint(date=d, orders=v[0], revenue=v[1]) for d, v in by_day.items()],
        recent_orders=[OrderListItem.model_validate(o) for o in recent],
        top_products=[
            {"product_id": pid, "name": name, "qty": int(qty or 0), "sum": float(s or 0)}
            for pid, name, qty, s in top
        ],
        last_import=ImportJobOut.model_validate(last_job) if last_job else None,
    )


@router.get("/counters")
async def counters(session: Session, _: CurrentUser) -> dict:
    """Бейджи для бокового меню админки."""
    return {
        "orders": (await session.execute(select(func.count(Order.id)).where(Order.status == OrderStatus.new))).scalar_one(),
        "leads": (await session.execute(select(func.count(Lead.id)).where(Lead.status == LeadStatus.new))).scalar_one(),
        "reviews": (await session.execute(select(func.count(Review.id)).where(Review.is_published.is_(False)))).scalar_one(),
        "partners": (await session.execute(select(func.count(Customer.id)).where(Customer.partner_status == PartnerStatus.pending))).scalar_one(),
        "import_running": ImportRunner.is_running(),
    }


# ---------- Настройки ----------


@router.get("/settings")
async def get_settings(session: Session, _: CurrentUser) -> dict:
    return await get_all_settings(session)


@router.put("/settings")
async def put_settings(data: dict[str, Any], session: Session, _: SuperUser) -> dict:
    unknown = set(data) - set(DEFAULTS)
    if unknown:
        raise HTTPException(422, f"Неизвестные настройки: {', '.join(sorted(unknown))}")
    return await update_settings(session, data)


@router.post("/upload")
async def upload_file(_: CurrentUser, file: UploadFile = File(...)) -> dict:
    try:
        url = media.save_upload(await file.read(), "uploads", file.filename)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    return {"url": url}


# ---------- Импорт ----------


@router.get("/import/jobs", response_model=list[ImportJobOut])
async def import_jobs(session: Session, _: CurrentUser) -> list[ImportJob]:
    return list(
        (await session.execute(select(ImportJob).order_by(ImportJob.id.desc()).limit(20))).scalars().all()
    )


@router.get("/import/jobs/{job_id}", response_model=ImportJobOut)
async def import_job(job_id: int, session: Session, _: CurrentUser) -> ImportJob:
    job = await session.get(ImportJob, job_id, populate_existing=True)
    if not job:
        raise HTTPException(404, "Задача не найдена")
    return job


@router.post("/import/start", response_model=ImportJobOut, status_code=202)
async def import_start(data: ImportStart, _: CurrentUser) -> ImportJob:
    try:
        return await ImportRunner.start(mode=data.mode, download_images=data.download_images)
    except RuntimeError as exc:
        raise HTTPException(409, str(exc)) from exc


@router.post("/import/jobs/{job_id}/cancel")
async def import_cancel(job_id: int, _: CurrentUser) -> dict:
    ImportRunner.request_cancel(job_id)
    return {"ok": True}


# ---------- Пользователи ----------


@router.get("/users", response_model=list[UserOut])
async def list_users(session: Session, _: SuperUser) -> list[User]:
    return list((await session.execute(select(User).order_by(User.id))).scalars().all())


@router.post("/users", response_model=UserOut, status_code=201)
async def create_user(data: UserCreate, session: Session, _: SuperUser) -> User:
    exists = (
        await session.execute(select(User).where(func.lower(User.email) == data.email.lower()))
    ).scalar_one_or_none()
    if exists:
        raise HTTPException(409, "Пользователь с таким email уже существует")
    user = User(
        email=data.email.lower(),
        hashed_password=hash_password(data.password),
        full_name=data.full_name,
        is_superuser=data.is_superuser,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


@router.patch("/users/{user_id}", response_model=UserOut)
async def update_user(user_id: int, data: UserUpdate, session: Session, me: CurrentUser) -> User:
    if user_id != me.id and not me.is_superuser:
        raise HTTPException(403, "Недостаточно прав")
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(404, "Пользователь не найден")
    values = data.model_dump(exclude_unset=True)
    if not me.is_superuser:
        values = {k: v for k, v in values.items() if k in {"full_name", "password"}}
    if user_id == me.id and (values.get("is_active") is False or values.get("is_superuser") is False):
        raise HTTPException(422, "Нельзя отключить или понизить самого себя")
    revoke = False
    if values.get("password"):
        user.hashed_password = hash_password(values.pop("password"))
        revoke = user_id != me.id
    values.pop("password", None)
    if values.get("is_active") is False:
        revoke = True
    for k, v in values.items():
        setattr(user, k, v)
    if revoke:
        await revoke_subject(session, ADMIN, user.id)
    await session.commit()
    await session.refresh(user)
    return user


@router.delete("/users/{user_id}", status_code=204)
async def delete_user(user_id: int, session: Session, me: SuperUser) -> None:
    if user_id == me.id:
        raise HTTPException(422, "Нельзя удалить самого себя")
    user = await session.get(User, user_id)
    if user:
        await session.delete(user)
        await session.commit()


# ---------- Страницы ----------


@router.get("/pages", response_model=list[PageOut])
async def list_pages(session: Session, _: CurrentUser) -> list[Page]:
    return list((await session.execute(select(Page).order_by(Page.sort_order, Page.title))).scalars().all())


@router.post("/pages", response_model=PageOut, status_code=201)
async def create_page(data: PageIn, session: Session, _: CurrentUser) -> Page:
    if (await session.execute(select(Page).where(Page.slug == data.slug))).first():
        raise HTTPException(409, "Страница с таким адресом уже существует")
    page = Page(**data.model_dump())
    session.add(page)
    await session.commit()
    await session.refresh(page)
    return page


@router.put("/pages/{page_id}", response_model=PageOut)
async def update_page(page_id: int, data: PageIn, session: Session, _: CurrentUser) -> Page:
    page = await session.get(Page, page_id)
    if not page:
        raise HTTPException(404, "Страница не найдена")
    clash = (
        await session.execute(select(Page.id).where(Page.slug == data.slug, Page.id != page_id))
    ).first()
    if clash:
        raise HTTPException(409, "Страница с таким адресом уже существует")
    for k, v in data.model_dump().items():
        setattr(page, k, v)
    await session.commit()
    await session.refresh(page)
    return page


@router.delete("/pages/{page_id}", status_code=204)
async def delete_page(page_id: int, session: Session, _: CurrentUser) -> None:
    page = await session.get(Page, page_id)
    if page:
        await session.delete(page)
        await session.commit()
