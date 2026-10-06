from decimal import Decimal
from math import ceil
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_session
from app.core.security import CurrentUser
from app.core.utils import round_money, slugify
from app.models import Category, Product, ProductAttribute, ProductImage
from app.schemas import (
    AttributeOut,
    BulkAction,
    CategoryBrief,
    ImageOrder,
    ImageOut,
    Page,
    ProductAdminListItem,
    ProductAdminOut,
    ProductIn,
    ProductPatch,
)
from app.services import catalog, media

router = APIRouter(prefix="/products", tags=["admin:products"])
Session = Annotated[AsyncSession, Depends(get_session)]


def _list_item(p: Product) -> ProductAdminListItem:
    return ProductAdminListItem(
        id=p.id,
        name=p.name,
        slug=p.slug,
        sku=p.sku,
        price=p.price,
        old_price=p.old_price,
        wholesale_price=p.wholesale_price,
        in_stock=p.in_stock,
        is_active=p.is_active,
        is_featured=p.is_featured,
        price_locked=p.price_locked,
        content_locked=p.content_locked,
        image=p.images[0].url if p.images else None,
        category=CategoryBrief.model_validate(p.category) if p.category else None,
        updated_at=p.updated_at,
        synced_at=p.synced_at,
    )


def _detail(p: Product) -> ProductAdminOut:
    base = _list_item(p).model_dump()
    return ProductAdminOut(
        **base,
        category_id=p.category_id,
        brand=p.brand,
        short_description=p.short_description,
        description=p.description,
        source_price=p.source_price,
        stock_qty=p.stock_qty,
        is_new=p.is_new,
        sort_order=p.sort_order,
        views=p.views,
        documents=p.documents,
        meta_title=p.meta_title,
        meta_description=p.meta_description,
        source_url=p.source_url,
        gallery=[ImageOut.model_validate(i) for i in p.images],
        attributes=[AttributeOut.model_validate(a) for a in p.attributes],
        highlights=[AttributeOut(**h) for h in (p.highlights or [])],
    )


async def _load(session: AsyncSession, product_id: int) -> Product:
    p = (
        await session.execute(
            select(Product)
            .options(
                selectinload(Product.images),
                selectinload(Product.attributes),
                selectinload(Product.category),
            )
            .where(Product.id == product_id)
            .execution_options(populate_existing=True)
        )
    ).scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Товар не найден")
    return p


async def _unique_slug(session: AsyncSession, base: str, exclude_id: int | None = None) -> str:
    base = slugify(base)
    slug, n = base, 2
    while True:
        stmt = select(Product.id).where(Product.slug == slug)
        if exclude_id:
            stmt = stmt.where(Product.id != exclude_id)
        if not (await session.execute(stmt)).first():
            return slug
        slug, n = f"{base}-{n}", n + 1


@router.get("", response_model=Page[ProductAdminListItem])
async def list_products(
    session: Session,
    _: CurrentUser,
    q: str | None = None,
    category_id: int | None = None,
    status: Literal["all", "active", "inactive", "out_of_stock", "featured", "sale", "locked"] = "all",
    sort: Literal["updated", "name", "price_asc", "price_desc", "views", "id"] = "updated",
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
) -> Page[ProductAdminListItem]:
    stmt = select(Product)
    if q:
        like = f"%{q.strip()}%"
        conds = [Product.name.ilike(like), Product.sku.ilike(like), Product.slug.ilike(like)]
        if q.strip().isdigit():
            conds.append(Product.id == int(q.strip()))
        stmt = stmt.where(or_(*conds))
    if category_id:
        cats = await catalog.load_categories(session, only_active=False)
        stmt = stmt.where(Product.category_id.in_(catalog.descendant_ids(cats, category_id)))
    match status:
        case "active":
            stmt = stmt.where(Product.is_active.is_(True))
        case "inactive":
            stmt = stmt.where(Product.is_active.is_(False))
        case "out_of_stock":
            stmt = stmt.where(Product.in_stock.is_(False))
        case "featured":
            stmt = stmt.where(Product.is_featured.is_(True))
        case "sale":
            stmt = stmt.where(Product.old_price.is_not(None))
        case "locked":
            stmt = stmt.where(or_(Product.price_locked.is_(True), Product.content_locked.is_(True)))
    total = (await session.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    order = {
        "updated": Product.updated_at.desc(),
        "name": Product.name.asc(),
        "price_asc": Product.price.asc(),
        "price_desc": Product.price.desc(),
        "views": Product.views.desc(),
        "id": Product.id.desc(),
    }[sort]
    rows = (
        await session.execute(
            stmt.options(selectinload(Product.images), selectinload(Product.category))
            .order_by(order, Product.id.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
        )
    ).scalars().all()
    return Page(
        items=[_list_item(p) for p in rows],
        total=total,
        page=page,
        per_page=per_page,
        pages=max(1, ceil(total / per_page)),
    )


@router.get("/{product_id}", response_model=ProductAdminOut)
async def get_product(product_id: int, session: Session, _: CurrentUser) -> ProductAdminOut:
    return _detail(await _load(session, product_id))


def _apply(p: Product, data: ProductIn) -> None:
    fields = data.model_dump(exclude={"slug", "attributes", "highlights", "documents"})
    for k, v in fields.items():
        setattr(p, k, v)
    p.documents = [d.model_dump() for d in data.documents] if data.documents else None
    if data.highlights is not None:
        p.highlights = [h.model_dump(exclude={"group"}) for h in data.highlights] or None
    if data.attributes is not None:
        p.attributes.clear()
        for idx, a in enumerate(data.attributes):
            p.attributes.append(
                ProductAttribute(group=a.group or None, name=a.name, value=a.value, sort_order=idx)
            )


async def _check_category(session: AsyncSession, category_id: int | None) -> None:
    if category_id is not None and not await session.get(Category, category_id):
        raise HTTPException(422, "Категория не найдена")


@router.post("", response_model=ProductAdminOut, status_code=201)
async def create_product(data: ProductIn, session: Session, _: CurrentUser) -> ProductAdminOut:
    await _check_category(session, data.category_id)
    p = Product(
        slug=await _unique_slug(session, data.slug or data.name),
        name=data.name,
        price=data.price,
        images=[],
        attributes=[],
    )
    _apply(p, data)
    session.add(p)
    await session.commit()
    return _detail(await _load(session, p.id))


@router.put("/{product_id}", response_model=ProductAdminOut)
async def update_product(
    product_id: int, data: ProductIn, session: Session, _: CurrentUser
) -> ProductAdminOut:
    await _check_category(session, data.category_id)
    p = await _load(session, product_id)
    _apply(p, data)
    if data.slug and data.slug != p.slug:
        p.slug = await _unique_slug(session, data.slug, exclude_id=p.id)
    await session.commit()
    return _detail(await _load(session, p.id))


@router.patch("/{product_id}", response_model=ProductAdminListItem)
async def patch_product(
    product_id: int, data: ProductPatch, session: Session, _: CurrentUser
) -> ProductAdminListItem:
    p = await _load(session, product_id)
    values = data.model_dump(exclude_unset=True)
    if "category_id" in values:
        await _check_category(session, values["category_id"])
    for k, v in values.items():
        setattr(p, k, v)
    # ручное изменение цены фиксирует её от перезаписи при синхронизации
    if "price" in values and "price_locked" not in values and p.source_url:
        p.price_locked = True
    await session.commit()
    return _list_item(await _load(session, p.id))


@router.delete("/{product_id}", status_code=204)
async def delete_product(product_id: int, session: Session, _: CurrentUser) -> None:
    p = await _load(session, product_id)
    for img in p.images:
        if not img.source_url or img.url != img.source_url:
            media.delete_by_url(img.url)
    await session.delete(p)
    await session.commit()


@router.post("/bulk")
async def bulk_action(data: BulkAction, session: Session, _: CurrentUser) -> dict:
    products = (
        await session.execute(
            select(Product).options(selectinload(Product.images)).where(Product.id.in_(data.ids))
        )
    ).scalars().all()
    flags = {
        "activate": ("is_active", True),
        "deactivate": ("is_active", False),
        "feature": ("is_featured", True),
        "unfeature": ("is_featured", False),
        "in_stock": ("in_stock", True),
        "out_of_stock": ("in_stock", False),
        "lock_price": ("price_locked", True),
        "unlock_price": ("price_locked", False),
    }
    if data.action == "move":
        await _check_category(session, int(data.value) if data.value else None)
    for p in products:
        if data.action in flags:
            attr, val = flags[data.action]
            setattr(p, attr, val)
        elif data.action == "delete":
            for img in p.images:
                if not img.source_url or img.url != img.source_url:
                    media.delete_by_url(img.url)
            await session.delete(p)
        elif data.action == "price_percent" and data.value is not None:
            k = Decimal(1) + Decimal(str(data.value)) / 100
            p.price = round_money(p.price * k)
            if p.old_price:
                p.old_price = round_money(p.old_price * k)
            p.price_locked = True
        elif data.action == "wholesale_percent" and data.value is not None:
            disc = Decimal(str(data.value))
            p.wholesale_price = round_money(p.price * (1 - disc / 100)) if disc > 0 else None
        elif data.action == "move":
            p.category_id = int(data.value) if data.value else None
    await session.commit()
    return {"ok": True, "affected": len(products)}


# ---------- Изображения ----------


@router.post("/{product_id}/images", response_model=list[ImageOut])
async def upload_images(
    product_id: int,
    session: Session,
    _: CurrentUser,
    files: list[UploadFile] = File(...),
) -> list[ImageOut]:
    p = await _load(session, product_id)
    start = len(p.images)
    for idx, f in enumerate(files):
        try:
            url = media.save_upload(await f.read(), f"products/manual/{p.id}", f.filename)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
        p.images.append(ProductImage(url=url, alt=p.name[:500], sort_order=start + idx))
    await session.commit()
    p = await _load(session, product_id)
    return [ImageOut.model_validate(i) for i in p.images]


@router.put("/{product_id}/images/order", response_model=list[ImageOut])
async def reorder_images(
    product_id: int, data: ImageOrder, session: Session, _: CurrentUser
) -> list[ImageOut]:
    p = await _load(session, product_id)
    pos = {img_id: i for i, img_id in enumerate(data.ids)}
    for img in p.images:
        img.sort_order = pos.get(img.id, len(pos) + img.sort_order)
    await session.commit()
    p = await _load(session, product_id)
    return [ImageOut.model_validate(i) for i in p.images]


@router.delete("/{product_id}/images/{image_id}", status_code=204)
async def delete_image(product_id: int, image_id: int, session: Session, _: CurrentUser) -> None:
    img = await session.get(ProductImage, image_id)
    if not img or img.product_id != product_id:
        raise HTTPException(404, "Изображение не найдено")
    p = await session.get(Product, product_id)
    if img.source_url and p:
        # иначе при следующей синхронизации фото вернётся
        p.content_locked = True
    if not img.source_url or img.url != img.source_url:
        media.delete_by_url(img.url)
    await session.execute(delete(ProductImage).where(ProductImage.id == image_id))
    await session.commit()
