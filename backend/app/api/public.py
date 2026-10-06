from datetime import UTC, datetime
from decimal import Decimal
from math import ceil
from typing import Annotated, Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.security import OptionalCustomer
from app.core.database import get_session
from app.core.utils import normalize_phone
from app.models import (
    Category,
    CustomerType,
    Lead,
    LeadType,
    Order,
    OrderItem,
    Page,
    Product,
    ProductAttribute,
    Review,
)
from app.schemas import (
    CartQuote,
    CategoryBrief,
    CategoryNode,
    CategoryOut,
    LeadCreate,
    OrderCreate,
    OrderPublicOut,
    PageBrief,
    PageOut,
    ProductCard,
    ProductDetail,
    ProductListOut,
    QuoteOut,
    ReviewCreate,
    ReviewOut,
    SearchSuggestion,
)
from app.services import catalog, pricing
from app.services.notify import notify
from app.services.site_settings import get_public_settings

router = APIRouter()
Session = Annotated[AsyncSession, Depends(get_session)]

SortKey = Literal["popular", "price_asc", "price_desc", "new", "name"]
LEAD_TITLES = {
    LeadType.callback: "Заказ обратного звонка",
    LeadType.wholesale: "Заявка на оптовое сотрудничество",
    LeadType.question: "Вопрос с сайта",
    LeadType.preorder: "Предзаказ товара",
}


@router.get("/health")
async def health(session: Session) -> dict:
    await session.execute(select(1))
    return {"status": "ok"}


@router.get("/settings")
async def public_settings(session: Session) -> dict:
    data = await get_public_settings(session)
    pages = (
        await session.execute(
            select(Page)
            .where(Page.is_published.is_(True), Page.show_in_footer.is_(True))
            .order_by(Page.sort_order, Page.title)
        )
    ).scalars()
    data["pages"] = [PageBrief.model_validate(p).model_dump() for p in pages]
    return data


# ---------- Категории ----------


@router.get("/categories", response_model=list[CategoryNode])
async def categories_tree(session: Session) -> list[CategoryNode]:
    cats = await catalog.load_categories(session)
    counts = await catalog.direct_counts(session)
    return catalog.build_tree(cats, counts, covers=await catalog.category_covers(session))


@router.get("/categories/{slug}", response_model=CategoryOut)
async def category_detail(slug: str, session: Session) -> CategoryOut:
    cats = await catalog.load_categories(session)
    cat = next((c for c in cats if c.slug == slug), None)
    if not cat:
        raise HTTPException(404, "Категория не найдена")
    counts = await catalog.direct_counts(session)
    tree = catalog.build_tree(cats, counts, covers=await catalog.category_covers(session))

    def find(nodes: list[CategoryNode]) -> CategoryNode | None:
        for n in nodes:
            if n.id == cat.id:
                return n
            found = find(n.children)
            if found:
                return found
        return None

    node = find(tree)
    return CategoryOut(
        id=cat.id,
        name=cat.name,
        slug=cat.slug,
        parent_id=cat.parent_id,
        image=cat.image,
        cover=node.cover if node else None,
        description=cat.description,
        meta_title=cat.meta_title,
        meta_description=cat.meta_description,
        product_count=node.product_count if node else 0,
        breadcrumbs=catalog.breadcrumbs(cats, cat.id),
        children=node.children if node else [],
    )


# ---------- Товары ----------


def _parse_attr_filters(raw: list[str]) -> dict[str, list[str]]:
    result: dict[str, list[str]] = {}
    for item in raw:
        if ":" not in item:
            continue
        name, value = item.split(":", 1)
        if name and value:
            result.setdefault(name, []).append(value)
    return result


@router.get("/products", response_model=ProductListOut)
async def list_products(
    session: Session,
    category: str | None = None,
    q: str | None = Query(default=None, max_length=200),
    price_min: Decimal | None = None,
    price_max: Decimal | None = None,
    in_stock: bool = False,
    sale: bool = False,
    featured: bool = False,
    new: bool = False,
    sort: SortKey = "popular",
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=24, ge=1, le=96),
    f: Annotated[list[str], Query()] = [],  # noqa: B006
    facets: bool = True,
) -> ProductListOut:
    cats = await catalog.load_categories(session)
    base = select(Product.id).where(Product.is_active.is_(True))

    if category:
        cat = next((c for c in cats if c.slug == category), None)
        if not cat:
            raise HTTPException(404, "Категория не найдена")
        base = base.where(Product.category_id.in_(catalog.descendant_ids(cats, cat.id)))
    if q:
        cond = catalog.search_condition(q)
        if cond is not None:
            base = base.where(cond)
    if featured:
        base = base.where(Product.is_featured.is_(True))
    if new:
        base = base.where(Product.is_new.is_(True))
    if sale:
        base = base.where(Product.old_price.is_not(None), Product.old_price > Product.price)

    # фасеты и диапазон цен считаем до применения фильтров по цене/характеристикам
    facet_list = await catalog.compute_facets(session, base) if facets else []
    pmin, pmax = await catalog.price_range(session, base)

    filtered = base
    if in_stock:
        filtered = filtered.where(Product.in_stock.is_(True))
    if price_min is not None:
        filtered = filtered.where(Product.price >= price_min)
    if price_max is not None:
        filtered = filtered.where(Product.price <= price_max)
    for name, values in _parse_attr_filters(f).items():
        filtered = filtered.where(
            Product.id.in_(
                select(ProductAttribute.product_id).where(
                    ProductAttribute.name == name, ProductAttribute.value.in_(values)
                )
            )
        )

    total = (
        await session.execute(select(func.count()).select_from(filtered.subquery()))
    ).scalar_one()

    order = {
        "popular": [Product.in_stock.desc(), Product.is_featured.desc(), Product.views.desc(), Product.sort_order, Product.id],
        "price_asc": [Product.in_stock.desc(), Product.price.asc(), Product.id],
        "price_desc": [Product.in_stock.desc(), Product.price.desc(), Product.id],
        "new": [Product.created_at.desc(), Product.id.desc()],
        "name": [Product.name.asc()],
    }[sort]
    stmt = (
        catalog.base_product_query()
        .where(Product.id.in_(filtered))
        .order_by(*order)
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    products = list((await session.execute(stmt)).scalars().all())
    return ProductListOut(
        items=await catalog.to_cards(session, products),
        total=total,
        page=page,
        per_page=per_page,
        pages=max(1, ceil(total / per_page)),
        facets=facet_list,
        price_min=pmin,
        price_max=pmax,
    )


@router.get("/products/by-ids", response_model=list[ProductCard])
async def products_by_ids(
    session: Session, ids: str = Query(max_length=2000)
) -> list[ProductCard]:
    id_list = [int(x) for x in ids.split(",") if x.strip().isdigit()][:100]
    if not id_list:
        return []
    stmt = catalog.base_product_query().where(
        Product.id.in_(id_list), Product.is_active.is_(True)
    )
    products = {p.id: p for p in (await session.execute(stmt)).scalars().all()}
    ordered = [products[i] for i in id_list if i in products]
    return await catalog.to_cards(session, ordered)


@router.get("/products/compare")
async def compare_products(session: Session, ids: str = Query(max_length=500)) -> dict:
    id_list = [int(x) for x in ids.split(",") if x.strip().isdigit()][:8]
    stmt = (
        catalog.base_product_query()
        .options(selectinload(Product.attributes))
        .where(Product.id.in_(id_list), Product.is_active.is_(True))
    )
    products = {p.id: p for p in (await session.execute(stmt)).scalars().all()}
    ordered = [products[i] for i in id_list if i in products]
    cards = await catalog.to_cards(session, ordered)
    names: list[str] = []
    values: dict[int, dict[str, str]] = {}
    for p in ordered:
        values[p.id] = {}
        for a in p.attributes:
            if a.name not in names:
                names.append(a.name)
            values[p.id][a.name] = a.value
    return {
        "products": [c.model_dump(mode="json") for c in cards],
        "attributes": [
            {"name": n, "values": [values[p.id].get(n) for p in ordered]} for n in names
        ],
    }


@router.get("/products/{slug}", response_model=ProductDetail)
async def product_detail(slug: str, session: Session) -> ProductDetail:
    stmt = (
        catalog.base_product_query()
        .options(selectinload(Product.attributes))
        .where(Product.slug == slug, Product.is_active.is_(True))
    )
    product = (await session.execute(stmt)).scalar_one_or_none()
    if not product:
        raise HTTPException(404, "Товар не найден")
    await session.execute(
        update(Product).where(Product.id == product.id).values(views=Product.views + 1)
    )
    await session.commit()
    cats = await catalog.load_categories(session, only_active=False)
    ratings = await catalog.ratings_for(session, [product.id])
    return catalog.to_detail(product, cats, ratings.get(product.id))


@router.get("/products/{slug}/related", response_model=list[ProductCard])
async def related_products(slug: str, session: Session, limit: int = 8) -> list[ProductCard]:
    product = (
        await session.execute(select(Product).where(Product.slug == slug))
    ).scalar_one_or_none()
    if not product or not product.category_id:
        return []
    stmt = (
        catalog.base_product_query()
        .where(
            Product.category_id == product.category_id,
            Product.id != product.id,
            Product.is_active.is_(True),
        )
        .order_by(Product.in_stock.desc(), func.abs(Product.price - product.price))
        .limit(min(limit, 24))
    )
    return await catalog.to_cards(session, list((await session.execute(stmt)).scalars().all()))


@router.get("/products/{product_id}/reviews", response_model=list[ReviewOut])
async def product_reviews(product_id: int, session: Session) -> list[Review]:
    stmt = (
        select(Review)
        .where(Review.product_id == product_id, Review.is_published.is_(True))
        .order_by(Review.created_at.desc())
        .limit(100)
    )
    return list((await session.execute(stmt)).scalars().all())


@router.post("/products/{product_id}/reviews", status_code=201)
async def create_review(
    product_id: int, data: ReviewCreate, session: Session, bg: BackgroundTasks
) -> dict:
    product = await session.get(Product, product_id)
    if not product or not product.is_active:
        raise HTTPException(404, "Товар не найден")
    session.add(Review(product_id=product_id, **data.model_dump(), is_published=False))
    await session.commit()
    bg.add_task(
        notify,
        "Новый отзыв на модерации",
        [f"Товар: {product.name}", f"Автор: {data.author}", f"Оценка: {data.rating}/5", data.text],
    )
    return {"ok": True, "message": "Спасибо! Отзыв появится после модерации."}


@router.get("/search/suggest", response_model=SearchSuggestion)
async def search_suggest(session: Session, q: str = Query(min_length=1, max_length=100)) -> SearchSuggestion:
    cond = catalog.search_condition(q)
    products: list[Product] = []
    if cond is not None:
        stmt = (
            catalog.base_product_query()
            .where(cond, Product.is_active.is_(True))
            .order_by(Product.in_stock.desc(), Product.views.desc())
            .limit(8)
        )
        products = list((await session.execute(stmt)).scalars().all())
    cats = (
        await session.execute(
            select(Category)
            .where(Category.is_active.is_(True), Category.name.ilike(f"%{q.strip()}%"))
            .limit(5)
        )
    ).scalars()
    return SearchSuggestion(
        products=await catalog.to_cards(session, products),
        categories=[CategoryBrief.model_validate(c) for c in cats],
    )


# ---------- Корзина и заказы ----------


@router.post("/cart/quote", response_model=QuoteOut)
async def cart_quote(data: CartQuote, session: Session, customer: OptionalCustomer) -> QuoteOut:
    result, _ = await pricing.quote(session, data.items, customer)
    return result


@router.post("/orders", response_model=OrderPublicOut, status_code=201)
async def create_order(
    data: OrderCreate, session: Session, bg: BackgroundTasks, customer: OptionalCustomer
) -> Order:
    if data.website:  # бот заполнил скрытое поле
        raise HTTPException(400, "Ошибка отправки формы")
    if customer and customer.is_partner:
        # партнёр всегда оформляет на свою организацию
        data.customer_type = CustomerType.wholesale
        data.company = data.company or customer.company
        data.inn = data.inn or customer.inn
    if data.customer_type == CustomerType.wholesale and not data.company:
        raise HTTPException(422, "Для оптового заказа укажите название организации")

    q, products = await pricing.quote(session, data.items, customer)
    if not q.items:
        raise HTTPException(422, "В корзине нет доступных товаров")

    order = Order(
        number="tmp",
        customer_type=data.customer_type,
        name=data.name.strip(),
        phone=normalize_phone(data.phone),
        email=data.email,
        company=data.company,
        inn=data.inn,
        city=data.city,
        address=data.address,
        delivery_method=data.delivery_method,
        payment_method=data.payment_method,
        comment=data.comment,
        subtotal=q.subtotal,
        discount=Decimal(0),
        total=q.total,
        customer_id=customer.id if customer else None,
    )
    if customer and customer.is_partner:
        order.price_type_id = await pricing.partner_price_type_id(session, customer)
    session.add(order)
    await session.flush()
    order.number = f"{datetime.now(UTC):%y%m}-{order.id:05d}"
    for line in q.items:
        session.add(
            OrderItem(
                order_id=order.id,
                product_id=line.product.id,
                name=line.product.name,
                sku=line.product.sku,
                image=line.product.image,
                price=line.price,
                quantity=line.quantity,
                total=line.total,
                is_wholesale_price=line.is_wholesale_price,
                price_kind=line.price_kind,
            )
        )
    await session.commit()

    lines = [
        f"Заказ №{order.number} ("
        + ("партнёр" if customer and customer.is_partner else "опт" if order.customer_type == CustomerType.wholesale else "розница")
        + ")",
        f"Клиент: {order.name}, {order.phone}" + (f", {order.email}" if order.email else ""),
    ]
    if order.company:
        lines.append(f"Организация: {order.company}" + (f", ИНН {order.inn}" if order.inn else ""))
    if order.city or order.address:
        lines.append(f"Адрес: {', '.join(x for x in [order.city, order.address] if x)}")
    lines.append("")
    for line in q.items:
        lines.append(f"• {line.product.name} × {line.quantity} = {line.total:,.0f} ₽".replace(",", " "))
    lines.append("")
    lines.append(f"Итого: {order.total:,.0f} ₽".replace(",", " "))
    if order.comment:
        lines.append(f"Комментарий: {order.comment}")
    lines.append(f"{settings.site_url.rstrip('/')}/admin/orders/{order.id}")
    bg.add_task(notify, f"Новый заказ №{order.number}", lines)
    return order


@router.get("/orders/track", response_model=OrderPublicOut)
async def track_order(
    session: Session,
    number: str = Query(max_length=32),
    phone: str = Query(max_length=64),
) -> Order:
    order = (
        await session.execute(select(Order).where(Order.number == number.strip()))
    ).scalar_one_or_none()
    digits = lambda s: "".join(ch for ch in s if ch.isdigit())[-10:]  # noqa: E731
    if not order or digits(order.phone) != digits(phone):
        raise HTTPException(404, "Заказ не найден")
    return order


@router.post("/leads", status_code=201)
async def create_lead(data: LeadCreate, session: Session, bg: BackgroundTasks) -> dict:
    if data.website:
        raise HTTPException(400, "Ошибка отправки формы")
    payload = data.model_dump(exclude={"website"})
    payload["phone"] = normalize_phone(data.phone)
    product = await session.get(Product, data.product_id) if data.product_id else None
    if data.product_id and not product:
        payload["product_id"] = None
    lead = Lead(**payload)
    session.add(lead)
    await session.commit()
    lines = [f"Имя: {lead.name}", f"Телефон: {lead.phone}"]
    if lead.email:
        lines.append(f"Email: {lead.email}")
    if lead.company:
        lines.append(f"Компания: {lead.company}")
    if product:
        lines.append(f"Товар: {product.name}")
    if lead.message:
        lines.append(f"Сообщение: {lead.message}")
    bg.add_task(notify, LEAD_TITLES.get(lead.type, "Заявка с сайта"), lines)
    return {"ok": True}


# ---------- Страницы и SEO ----------


@router.get("/pages/{slug}", response_model=PageOut)
async def page_detail(slug: str, session: Session) -> Page:
    page = (
        await session.execute(select(Page).where(Page.slug == slug, Page.is_published.is_(True)))
    ).scalar_one_or_none()
    if not page:
        raise HTTPException(404, "Страница не найдена")
    return page


@router.get("/sitemap")
async def sitemap_data(session: Session) -> dict:
    products = await session.execute(
        select(Product.slug, Product.updated_at).where(Product.is_active.is_(True))
    )
    cats = await session.execute(
        select(Category.slug, Category.updated_at).where(Category.is_active.is_(True))
    )
    pages = await session.execute(
        select(Page.slug, Page.updated_at).where(Page.is_published.is_(True))
    )
    fmt = lambda rows: [{"slug": s, "updated_at": u.isoformat() if u else None} for s, u in rows]  # noqa: E731
    return {
        "products": fmt(products.all()),
        "categories": fmt(cats.all()),
        "pages": fmt(pages.all()),
    }
