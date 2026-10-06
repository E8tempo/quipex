"""Вход сотрудников в админ-панель."""

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import (
    ADMIN,
    CurrentUser,
    client_ip,
    login_limiter,
    logout_endpoint,
    refresh_endpoint,
    set_auth_cookies,
    start_session,
    verify_password,
)
from app.models import User
from app.schemas import LoginIn, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])
Session = Annotated[AsyncSession, Depends(get_session)]


@router.post("/login", response_model=UserOut)
async def login(data: LoginIn, request: Request, response: Response, db: Session) -> User:
    key = f"admin:{client_ip(request)}"
    login_limiter.check(key)
    user = (
        await db.execute(select(User).where(func.lower(User.email) == data.email.strip().lower()))
    ).scalar_one_or_none()
    if not user or not user.is_active or not verify_password(data.password, user.hashed_password):
        login_limiter.fail(key)
        raise HTTPException(401, "Неверный email или пароль")
    login_limiter.reset(key)
    user.last_login_at = datetime.now(UTC)
    access, refresh = await start_session(db, ADMIN, user.id, request)
    await db.commit()
    set_auth_cookies(response, ADMIN, access, refresh)
    return user


@router.post("/refresh")
async def refresh(request: Request, db: Session) -> Response:
    return await refresh_endpoint(db, ADMIN, request, lambda uid: db.get(User, uid))


@router.post("/logout")
async def logout(request: Request, db: Session) -> Response:
    return await logout_endpoint(db, ADMIN, request)


@router.get("/me", response_model=UserOut)
async def me(user: CurrentUser) -> User:
    return user
