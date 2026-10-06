"""Личный кабинет клиента: регистрация, вход, профиль, заказы, партнёрство, персональные цены."""

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_session
from app.core.security import (
    CUSTOMER,
    CurrentCustomer,
    client_ip,
    hash_password,
    login_limiter,
    logout_endpoint,
    refresh_endpoint,
    revoke_subject,
    set_auth_cookies,
    start_session,
    verify_password,
)
from app.core.utils import normalize_phone
from app.models import ClientKind, Customer, Order, PartnerStatus, PriceType, Product
from app.schemas import (
    CustomerLogin,
    CustomerOut,
    CustomerRegister,
    CustomerUpdate,
    OrderOut,
    PartnerRequest,
    PasswordChange,
    PersonalPrice,
)
from app.services.notify import notify
from app.services.pricing import load_partner_pricing, partner_price

router = APIRouter(prefix="/account", tags=["account"])
Session = Annotated[AsyncSession, Depends(get_session)]


async def customer_out(db: AsyncSession, c: Customer) -> CustomerOut:
    out = CustomerOut.model_validate(c)
    if c.is_partner:
        from app.services.pricing import partner_price_type_id

        type_id = await partner_price_type_id(db, c)
        pt = await db.get(PriceType, type_id) if type_id else None
        out.price_type_name = pt.name if pt else None
    else:
        out.discount_percent = None
    return out


# ---------- вход и сессии ----------


@router.post("/auth/register", response_model=CustomerOut, status_code=201)
async def register(
    data: CustomerRegister, request: Request, response: Response, db: Session, bg: BackgroundTasks
) -> CustomerOut:
    if data.website:
        raise HTTPException(400, "Ошибка отправки формы")
    email = data.email.lower()
    if (await db.execute(select(Customer.id).where(func.lower(Customer.email) == email))).first():
        raise HTTPException(409, "Пользователь с таким email уже зарегистрирован")
    if data.as_partner and not (data.company and data.inn):
        raise HTTPException(422, "Для партнёрской регистрации укажите организацию и ИНН")
    customer = Customer(
        email=email,
        hashed_password=hash_password(data.password),
        name=data.name.strip(),
        phone=normalize_phone(data.phone),
        kind=ClientKind.partner if data.as_partner else ClientKind.retail,
        partner_status=PartnerStatus.pending if data.as_partner else PartnerStatus.none,
        company=data.company,
        inn=data.inn,
        last_login_at=datetime.now(UTC),
    )
    db.add(customer)
    await db.flush()
    access, refresh = await start_session(db, CUSTOMER, customer.id, request)
    await db.commit()
    set_auth_cookies(response, CUSTOMER, access, refresh)
    if data.as_partner:
        bg.add_task(
            notify,
            "Заявка на партнёрство",
            [f"{customer.company}, ИНН {customer.inn}", f"{customer.name}, {customer.phone}, {customer.email}"],
        )
    return await customer_out(db, customer)


@router.post("/auth/login", response_model=CustomerOut)
async def login(data: CustomerLogin, request: Request, response: Response, db: Session) -> CustomerOut:
    key = f"customer:{client_ip(request)}"
    login_limiter.check(key)
    customer = (
        await db.execute(select(Customer).where(func.lower(Customer.email) == data.email.strip().lower()))
    ).scalar_one_or_none()
    if not customer or not verify_password(data.password, customer.hashed_password):
        login_limiter.fail(key)
        raise HTTPException(401, "Неверный email или пароль")
    if not customer.is_active:
        raise HTTPException(403, "Учётная запись заблокирована. Свяжитесь с менеджером.")
    login_limiter.reset(key)
    customer.last_login_at = datetime.now(UTC)
    access, refresh = await start_session(db, CUSTOMER, customer.id, request)
    await db.commit()
    set_auth_cookies(response, CUSTOMER, access, refresh)
    return await customer_out(db, customer)


@router.post("/auth/refresh")
async def refresh(request: Request, db: Session) -> Response:
    return await refresh_endpoint(db, CUSTOMER, request, lambda cid: db.get(Customer, cid))


@router.post("/auth/logout")
async def logout(request: Request, db: Session) -> Response:
    return await logout_endpoint(db, CUSTOMER, request)


# ---------- профиль ----------


@router.get("/me", response_model=CustomerOut)
async def me(customer: CurrentCustomer, db: Session) -> CustomerOut:
    return await customer_out(db, customer)


@router.patch("/me", response_model=CustomerOut)
async def update_me(data: CustomerUpdate, customer: CurrentCustomer, db: Session) -> CustomerOut:
    values = data.model_dump(exclude_unset=True)
    # реквизиты одобренного партнёра меняет только менеджер (они синхронизируются с 1С)
    if customer.is_partner:
        for locked in ("company", "inn", "kpp"):
            values.pop(locked, None)
    if "phone" in values and values["phone"]:
        values["phone"] = normalize_phone(values["phone"])
    for k, v in values.items():
        setattr(customer, k, v)
    await db.commit()
    return await customer_out(db, customer)


@router.post("/password")
async def change_password(
    data: PasswordChange, request: Request, customer: CurrentCustomer, db: Session
) -> Response:
    if not verify_password(data.current_password, customer.hashed_password):
        raise HTTPException(422, "Текущий пароль указан неверно")
    customer.hashed_password = hash_password(data.new_password)
    # завершаем все сессии и выдаём новую текущей
    await revoke_subject(db, CUSTOMER, customer.id)
    access, refresh = await start_session(db, CUSTOMER, customer.id, request)
    await db.commit()
    from fastapi.responses import JSONResponse

    resp = JSONResponse({"ok": True})
    set_auth_cookies(resp, CUSTOMER, access, refresh)
    return resp


@router.post("/partner-request", response_model=CustomerOut)
async def partner_request(
    data: PartnerRequest, customer: CurrentCustomer, db: Session, bg: BackgroundTasks
) -> CustomerOut:
    if customer.is_partner:
        raise HTTPException(409, "Вы уже партнёр")
    customer.kind = ClientKind.partner
    customer.partner_status = PartnerStatus.pending
    customer.company = data.company
    customer.inn = data.inn
    customer.kpp = data.kpp
    customer.legal_address = data.legal_address
    await db.commit()
    lines = [f"{data.company}, ИНН {data.inn}", f"{customer.name}, {customer.phone}, {customer.email}"]
    if data.message:
        lines.append(data.message)
    bg.add_task(notify, "Заявка на партнёрство", lines)
    return await customer_out(db, customer)


# ---------- заказы ----------


@router.get("/orders", response_model=list[OrderOut])
async def my_orders(customer: CurrentCustomer, db: Session) -> list[Order]:
    rows = await db.execute(
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.customer_id == customer.id)
        .order_by(Order.created_at.desc())
        .limit(200)
    )
    return list(rows.scalars().all())


@router.get("/orders/{number}", response_model=OrderOut)
async def my_order(number: str, customer: CurrentCustomer, db: Session) -> Order:
    order = (
        await db.execute(
            select(Order)
            .options(selectinload(Order.items))
            .where(Order.number == number, Order.customer_id == customer.id)
        )
    ).scalar_one_or_none()
    if not order:
        raise HTTPException(404, "Заказ не найден")
    return order


# ---------- персональные цены ----------


@router.get("/prices", response_model=dict[int, PersonalPrice])
async def my_prices(
    customer: CurrentCustomer, db: Session, ids: str = Query(max_length=3000)
) -> dict[int, PersonalPrice]:
    """Цены партнёра для набора товаров (витрина кешируется без учёта пользователя,
    поэтому персональные цены подгружаются отдельно)."""
    id_list = [int(x) for x in ids.split(",") if x.strip().isdigit()][:200]
    pp = await load_partner_pricing(db, customer, id_list)
    if not pp or not id_list:
        return {}
    products = (await db.execute(select(Product).where(Product.id.in_(id_list)))).scalars().all()
    return {p.id: PersonalPrice(price=partner_price(p, pp), kind="partner") for p in products}
