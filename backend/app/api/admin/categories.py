from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import CurrentUser
from app.core.utils import slugify
from app.models import Category, Product
from app.schemas import CategoryAdminOut, CategoryIn
from app.services import catalog, media

router = APIRouter(prefix="/categories", tags=["admin:categories"])
Session = Annotated[AsyncSession, Depends(get_session)]


async def _counts(session: AsyncSession) -> dict[int, int]:
    rows = await session.execute(
        select(Product.category_id, func.count(Product.id)).group_by(Product.category_id)
    )
    return {cid: n for cid, n in rows.all() if cid}


def _out(c: Category, counts: dict[int, int]) -> CategoryAdminOut:
    out = CategoryAdminOut.model_validate(c)
    out.product_count = counts.get(c.id, 0)
    return out


async def _unique_slug(session: AsyncSession, base: str, exclude_id: int | None = None) -> str:
    base = slugify(base)
    slug, n = base, 2
    while True:
        stmt = select(Category.id).where(Category.slug == slug)
        if exclude_id:
            stmt = stmt.where(Category.id != exclude_id)
        if not (await session.execute(stmt)).first():
            return slug
        slug, n = f"{base}-{n}", n + 1


async def _validate_parent(session: AsyncSession, cat_id: int | None, parent_id: int | None) -> None:
    if parent_id is None:
        return
    cats = await catalog.load_categories(session, only_active=False)
    if not any(c.id == parent_id for c in cats):
        raise HTTPException(422, "Родительская категория не найдена")
    if cat_id and parent_id in catalog.descendant_ids(cats, cat_id):
        raise HTTPException(422, "Нельзя вложить категорию саму в себя")


@router.get("", response_model=list[CategoryAdminOut])
async def list_categories(session: Session, _: CurrentUser) -> list[CategoryAdminOut]:
    cats = await catalog.load_categories(session, only_active=False)
    counts = await _counts(session)
    return [_out(c, counts) for c in cats]


@router.post("", response_model=CategoryAdminOut, status_code=201)
async def create_category(data: CategoryIn, session: Session, _: CurrentUser) -> CategoryAdminOut:
    await _validate_parent(session, None, data.parent_id)
    cat = Category(**data.model_dump(exclude={"slug"}))
    cat.slug = await _unique_slug(session, data.slug or data.name)
    session.add(cat)
    await session.commit()
    return _out(cat, {})


@router.put("/{cat_id}", response_model=CategoryAdminOut)
async def update_category(
    cat_id: int, data: CategoryIn, session: Session, _: CurrentUser
) -> CategoryAdminOut:
    cat = await session.get(Category, cat_id)
    if not cat:
        raise HTTPException(404, "Категория не найдена")
    await _validate_parent(session, cat_id, data.parent_id)
    if cat.image and cat.image != data.image:
        media.delete_by_url(cat.image)
    if cat.cover and cat.cover != data.cover:
        media.delete_by_url(cat.cover)
    for k, v in data.model_dump(exclude={"slug"}).items():
        setattr(cat, k, v)
    if data.slug and data.slug != cat.slug:
        cat.slug = await _unique_slug(session, data.slug, exclude_id=cat.id)
    await session.commit()
    return _out(cat, await _counts(session))


@router.delete("/{cat_id}", status_code=204)
async def delete_category(cat_id: int, session: Session, _: CurrentUser) -> None:
    cat = await session.get(Category, cat_id)
    if not cat:
        raise HTTPException(404, "Категория не найдена")
    # товары и подкатегории переносим к родителю
    await session.execute(
        update(Product).where(Product.category_id == cat_id).values(category_id=cat.parent_id)
    )
    await session.execute(
        update(Category).where(Category.parent_id == cat_id).values(parent_id=cat.parent_id)
    )
    media.delete_by_url(cat.image)
    media.delete_by_url(cat.cover)
    await session.delete(cat)
    await session.commit()


@router.post("/upload-image")
async def upload_category_image(_: CurrentUser, file: UploadFile = File(...)) -> dict:
    try:
        url = media.save_upload(await file.read(), "categories", file.filename)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    return {"url": url}
