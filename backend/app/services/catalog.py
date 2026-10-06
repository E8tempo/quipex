from collections import defaultdict
from decimal import Decimal

from sqlalchemy import Select, and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Category, Product, ProductAttribute, ProductImage, Review
from app.schemas import (
    AttributeOut,
    CategoryBrief,
    CategoryNode,
    DocumentOut,
    Facet,
    FacetValue,
    ImageOut,
    ProductCard,
    ProductDetail,
    SpecGroup,
)

# Характеристики, которые не имеет смысла выводить в фильтрах
FACET_EXCLUDE = {"артикул", "комплектация", "особенности", "гарантия", "страна производства"}
FACET_EXCLUDE_PARTS = ("вес", "габарит", "размер", "высота", "ширина", "глубина", "длина", "упаковк", "штрих")
FACET_MAX_VALUES = 30
FACET_MAX_COUNT = 10


async def load_categories(session: AsyncSession, only_active: bool = True) -> list[Category]:
    stmt = select(Category).order_by(Category.sort_order, Category.name)
    if only_active:
        stmt = stmt.where(Category.is_active.is_(True))
    return list((await session.execute(stmt)).scalars().all())


async def direct_counts(session: AsyncSession) -> dict[int, int]:
    rows = await session.execute(
        select(Product.category_id, func.count(Product.id))
        .where(Product.is_active.is_(True))
        .group_by(Product.category_id)
    )
    return {cid: cnt for cid, cnt in rows.all() if cid is not None}


async def category_covers(session: AsyncSession) -> dict[int, str]:
    """Обложка категории — главное фото самого популярного товара в наличии."""
    rows = await session.execute(
        select(Product.category_id, ProductImage.url)
        .join(ProductImage, ProductImage.product_id == Product.id)
        .where(Product.is_active.is_(True), ProductImage.sort_order == 0)
        .order_by(
            Product.name.ilike("%комплект%").asc(),
            Product.name.ilike("%+%").asc(),
            Product.name.ilike("основа%").asc(),
            Product.old_price.is_(None).desc(),
            Product.in_stock.desc(),
            Product.views.desc(),
            Product.id,
        )
    )
    covers: dict[int, str] = {}
    for cid, url in rows.all():
        if cid is not None and cid not in covers:
            covers[cid] = url
    return covers


def build_tree(
    categories: list[Category],
    counts: dict[int, int],
    hide_empty: bool = True,
    covers: dict[int, str] | None = None,
) -> list[CategoryNode]:
    covers = covers or {}
    nodes = {
        c.id: CategoryNode(
            id=c.id,
            name=c.name,
            slug=c.slug,
            parent_id=c.parent_id,
            image=c.image,
            cover=c.cover,
            sort_order=c.sort_order,
            is_active=c.is_active,
            product_count=counts.get(c.id, 0),
        )
        for c in categories
    }
    roots: list[CategoryNode] = []
    for c in categories:
        node = nodes[c.id]
        if c.parent_id and c.parent_id in nodes:
            nodes[c.parent_id].children.append(node)
        else:
            roots.append(node)

    def total(node: CategoryNode) -> int:
        node.product_count += sum(total(ch) for ch in node.children)
        if not node.cover:  # обложка, загруженная вручную, важнее автоматической
            child_cover = next((ch.cover for ch in node.children if ch.cover), None)
            node.cover = child_cover or covers.get(node.id)
        if hide_empty:
            node.children = [ch for ch in node.children if ch.product_count > 0]
        return node.product_count

    for r in roots:
        total(r)
    if hide_empty:
        roots = [r for r in roots if r.product_count > 0]
    return roots


def descendant_ids(categories: list[Category], root_id: int) -> list[int]:
    children: dict[int | None, list[int]] = defaultdict(list)
    for c in categories:
        children[c.parent_id].append(c.id)
    result, stack = [], [root_id]
    while stack:
        cid = stack.pop()
        result.append(cid)
        stack.extend(children.get(cid, []))
    return result


def breadcrumbs(categories: list[Category], category_id: int | None) -> list[CategoryBrief]:
    by_id = {c.id: c for c in categories}
    chain: list[CategoryBrief] = []
    seen: set[int] = set()
    current = by_id.get(category_id) if category_id else None
    while current and current.id not in seen:
        seen.add(current.id)
        chain.append(CategoryBrief.model_validate(current))
        current = by_id.get(current.parent_id) if current.parent_id else None
    return list(reversed(chain))


def base_product_query() -> Select:
    return select(Product).options(
        selectinload(Product.images), selectinload(Product.category)
    )


def search_condition(q: str):
    terms = [t for t in q.strip().split() if t][:6]
    conds = []
    for term in terms:
        like = f"%{term}%"
        conds.append(
            or_(
                Product.name.ilike(like),
                Product.sku.ilike(like),
                Product.brand.ilike(like),
            )
        )
    return and_(*conds) if conds else None


async def ratings_for(session: AsyncSession, ids: list[int]) -> dict[int, tuple[float, int]]:
    if not ids:
        return {}
    rows = await session.execute(
        select(Review.product_id, func.avg(Review.rating), func.count(Review.id))
        .where(Review.product_id.in_(ids), Review.is_published.is_(True))
        .group_by(Review.product_id)
    )
    return {pid: (round(float(avg), 1), cnt) for pid, avg, cnt in rows.all()}


def to_card(p: Product, rating: tuple[float, int] | None = None) -> ProductCard:
    images = [img.url for img in p.images]
    return ProductCard(
        id=p.id,
        name=p.name,
        slug=p.slug,
        sku=p.sku,
        brand=p.brand,
        price=p.price,
        old_price=p.old_price if p.old_price and p.old_price > p.price else None,
        wholesale_price=p.wholesale_price,
        in_stock=p.in_stock,
        is_new=p.is_new,
        is_featured=p.is_featured,
        image=images[0] if images else None,
        images=images[:4],
        category=CategoryBrief.model_validate(p.category) if p.category else None,
        highlights=[AttributeOut(**h) for h in (p.highlights or [])][:4],
        rating=rating[0] if rating else None,
        reviews_count=rating[1] if rating else 0,
    )


async def to_cards(session: AsyncSession, products: list[Product]) -> list[ProductCard]:
    ratings = await ratings_for(session, [p.id for p in products])
    return [to_card(p, ratings.get(p.id)) for p in products]


def to_detail(
    p: Product,
    categories: list[Category],
    rating: tuple[float, int] | None,
) -> ProductDetail:
    card = to_card(p, rating)
    groups: dict[str | None, list[AttributeOut]] = {}
    for a in p.attributes:
        groups.setdefault(a.group, []).append(AttributeOut.model_validate(a))
    return ProductDetail(
        **card.model_dump(),
        description=p.description,
        short_description=p.short_description,
        stock_qty=p.stock_qty,
        gallery=[ImageOut.model_validate(i) for i in p.images],
        specs=[SpecGroup(name=g, items=items) for g, items in groups.items()],
        documents=[DocumentOut(**d) for d in (p.documents or [])],
        breadcrumbs=breadcrumbs(categories, p.category_id),
        meta_title=p.meta_title,
        meta_description=p.meta_description,
    )


async def compute_facets(
    session: AsyncSession, product_ids_stmt: Select
) -> list[Facet]:
    """Строит фасеты по характеристикам для набора товаров (без учёта фильтров по атрибутам)."""
    ids_sub = product_ids_stmt.subquery()
    rows = await session.execute(
        select(ProductAttribute.name, ProductAttribute.value, func.count(ProductAttribute.id))
        .where(ProductAttribute.product_id.in_(select(ids_sub.c.id)))
        .group_by(ProductAttribute.name, ProductAttribute.value)
    )
    raw: dict[str, list[FacetValue]] = defaultdict(list)
    total_products = (
        await session.execute(select(func.count()).select_from(ids_sub))
    ).scalar_one()
    for name, value, cnt in rows.all():
        lname = name.lower()
        if lname in FACET_EXCLUDE or any(p in lname for p in FACET_EXCLUDE_PARTS) or len(value) > 80:
            continue
        raw[name].append(FacetValue(value=value, count=cnt))

    facets: list[tuple[int, Facet]] = []
    for name, values in raw.items():
        if not 2 <= len(values) <= FACET_MAX_VALUES:
            continue
        coverage = sum(v.count for v in values)
        if total_products and coverage < total_products * 0.4:
            continue
        values.sort(key=lambda v: _natural_key(v.value))
        facets.append((coverage, Facet(name=name, values=values)))
    facets.sort(key=lambda x: -x[0])
    return [f for _, f in facets[:FACET_MAX_COUNT]]


def _natural_key(value: str):
    import re

    m = re.search(r"\d+(?:[.,]\d+)?", value)
    if m:
        return (0, float(m.group().replace(",", ".")), value)
    return (1, 0.0, value)


async def price_range(session: AsyncSession, product_ids_stmt: Select) -> tuple[Decimal | None, Decimal | None]:
    ids_sub = product_ids_stmt.subquery()
    row = (
        await session.execute(
            select(func.min(Product.price), func.max(Product.price)).where(
                Product.id.in_(select(ids_sub.c.id))
            )
        )
    ).one()
    return row[0], row[1]
