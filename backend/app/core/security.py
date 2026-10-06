"""Аутентификация: пароли, короткие access-токены (JWT) и ротируемые refresh-токены.

Схема:
  * access-токен (JWT, ~15 мин) — в httpOnly-cookie, отправляется со всеми запросами;
  * refresh-токен (случайная строка, ~30 дней) — в httpOnly-cookie, доступной только
    эндпоинту обновления; в БД хранится лишь его SHA-256;
  * при каждом обновлении refresh-токен заменяется новым (ротация). Повторное
    предъявление уже заменённого токена = признак кражи → отзывается вся цепочка входа;
  * access-токен содержит id цепочки (sid) — выход/блокировка действуют сразу.

Сотрудники (админка) и клиенты сайта имеют раздельные cookie и сессии.
"""

import hashlib
import secrets
import time
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Annotated

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_session
from app.models import AuthSession, Customer, User

ALGORITHM = "HS256"
REUSE_GRACE_SECONDS = 30  # параллельные обновления из нескольких вкладок не считаются кражей


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode()[:72], bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode()[:72], hashed.encode())
    except ValueError:
        return False


@dataclass(frozen=True)
class AuthScope:
    subject_type: str
    access_cookie: str
    refresh_cookie: str
    refresh_path: str


ADMIN = AuthScope("user", settings.admin_access_cookie, settings.admin_refresh_cookie, f"{settings.api_prefix}/auth")
CUSTOMER = AuthScope(
    "customer", settings.customer_access_cookie, settings.customer_refresh_cookie, f"{settings.api_prefix}/account/auth"
)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_access_token(scope: AuthScope, subject_id: int, family_id: str) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": str(subject_id),
        "typ": scope.subject_type,
        "sid": family_id,
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def decode_access_token(token: str, scope: AuthScope) -> tuple[int, str] | None:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        if payload.get("typ") != scope.subject_type:
            return None
        return int(payload["sub"]), str(payload["sid"])
    except (jwt.PyJWTError, KeyError, ValueError):
        return None


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real = request.headers.get("x-real-ip")
    if real:
        return real
    return request.client.host if request.client else "unknown"


# ---------- сессии ----------


class RefreshError(Exception):
    pass


async def start_session(
    db: AsyncSession, scope: AuthScope, subject_id: int, request: Request, family_id: str | None = None
) -> tuple[str, str]:
    """Создаёт запись refresh-токена; возвращает (access, refresh)."""
    family = family_id or secrets.token_urlsafe(24)
    raw = secrets.token_urlsafe(48)
    db.add(
        AuthSession(
            family_id=family,
            subject_type=scope.subject_type,
            subject_id=subject_id,
            token_hash=hash_token(raw),
            expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_expire_days),
            user_agent=(request.headers.get("user-agent") or "")[:500],
            ip=client_ip(request)[:64],
        )
    )
    await db.flush()
    return create_access_token(scope, subject_id, family), raw


async def rotate_session(db: AsyncSession, scope: AuthScope, raw: str, request: Request) -> tuple[int, str, str]:
    """Меняет refresh-токен на новый. Возвращает (subject_id, access, refresh)."""
    now = datetime.now(UTC)
    row = (
        await db.execute(select(AuthSession).where(AuthSession.token_hash == hash_token(raw)).with_for_update())
    ).scalar_one_or_none()
    if not row or row.subject_type != scope.subject_type:
        raise RefreshError("unknown")
    if row.revoked_at is not None:
        rotated = row.rotated_at
        if rotated and (now - _aware(rotated)).total_seconds() < REUSE_GRACE_SECONDS:
            raise RefreshError("race")  # соседняя вкладка уже обновила токен
        await revoke_family(db, row.family_id)  # повторное использование — отзываем всё
        raise RefreshError("reuse")
    if _aware(row.expires_at) <= now:
        raise RefreshError("expired")
    row.revoked_at = now
    row.rotated_at = now
    access, new_raw = await start_session(db, scope, row.subject_id, request, family_id=row.family_id)
    return row.subject_id, access, new_raw


async def revoke_family(db: AsyncSession, family_id: str) -> None:
    await db.execute(
        update(AuthSession)
        .where(AuthSession.family_id == family_id, AuthSession.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )


async def revoke_subject(db: AsyncSession, scope: AuthScope, subject_id: int) -> None:
    """Завершает все сессии пользователя/клиента (смена пароля, блокировка)."""
    await db.execute(
        update(AuthSession)
        .where(
            AuthSession.subject_type == scope.subject_type,
            AuthSession.subject_id == subject_id,
            AuthSession.revoked_at.is_(None),
        )
        .values(revoked_at=datetime.now(UTC))
    )


async def family_active(db: AsyncSession, family_id: str) -> bool:
    row = (
        await db.execute(
            select(AuthSession.id)
            .where(
                AuthSession.family_id == family_id,
                AuthSession.revoked_at.is_(None),
                AuthSession.expires_at > datetime.now(UTC),
            )
            .limit(1)
        )
    ).first()
    return row is not None


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


def set_auth_cookies(response: Response, scope: AuthScope, access: str, refresh: str) -> None:
    max_age = settings.refresh_token_expire_days * 86400
    common = {"httponly": True, "secure": settings.cookie_secure, "samesite": "lax"}
    # cookie живёт столько же, сколько refresh: просроченный JWT внутри → 401 → клиент обновляет сессию
    response.set_cookie(scope.access_cookie, access, max_age=max_age, path="/", **common)
    response.set_cookie(scope.refresh_cookie, refresh, max_age=max_age, path=scope.refresh_path, **common)
    # признак «вошёл» без секретов — фронтенд по нему решает, запрашивать ли профиль
    response.set_cookie(
        f"{scope.access_cookie}_in", "1", max_age=max_age, path="/", secure=settings.cookie_secure, samesite="lax"
    )


def clear_auth_cookies(response: Response, scope: AuthScope) -> None:
    response.delete_cookie(scope.access_cookie, path="/")
    response.delete_cookie(scope.refresh_cookie, path=scope.refresh_path)
    response.delete_cookie(f"{scope.access_cookie}_in", path="/")


def auth_error(scope: AuthScope, status_code: int, detail: str, clear: bool = True) -> JSONResponse:
    """Ошибка авторизации, которая заодно стирает cookie (HTTPException их бы потерял)."""
    resp = JSONResponse({"detail": detail}, status_code=status_code)
    if clear:
        clear_auth_cookies(resp, scope)
    return resp


async def refresh_endpoint(db: AsyncSession, scope: AuthScope, request: Request, load_subject) -> Response:
    """Общая логика POST .../refresh для сотрудников и клиентов."""
    raw = request.cookies.get(scope.refresh_cookie)
    if not raw:
        return auth_error(scope, 401, "Сессия истекла")
    try:
        subject_id, access, new_raw = await rotate_session(db, scope, raw, request)
    except RefreshError as exc:
        await db.commit()  # отзыв цепочки при повторном использовании должен сохраниться
        if str(exc) == "race":
            return auth_error(scope, 409, "Сессия уже обновлена", clear=False)
        return auth_error(scope, 401, "Сессия истекла")
    subject = await load_subject(subject_id)
    if not subject or not subject.is_active:
        await db.rollback()
        return auth_error(scope, 401, "Сессия истекла")
    await db.commit()
    resp = JSONResponse({"ok": True})
    set_auth_cookies(resp, scope, access, new_raw)
    return resp


async def logout_endpoint(db: AsyncSession, scope: AuthScope, request: Request) -> Response:
    token = request.cookies.get(scope.access_cookie)
    decoded = decode_access_token(token, scope) if token else None
    if decoded:
        await revoke_family(db, decoded[1])
    raw = request.cookies.get(scope.refresh_cookie)
    if raw:
        row = (
            await db.execute(select(AuthSession).where(AuthSession.token_hash == hash_token(raw)))
        ).scalar_one_or_none()
        if row:
            await revoke_family(db, row.family_id)
    await db.commit()
    resp = JSONResponse({"ok": True})
    clear_auth_cookies(resp, scope)
    return resp


# ---------- зависимости ----------


def _token(request: Request, scope: AuthScope) -> str | None:
    auth = request.headers.get("authorization")
    if auth and auth.lower().startswith("bearer ") and scope is ADMIN:
        return auth[7:].strip()
    return request.cookies.get(scope.access_cookie)


UNAUTHORIZED = HTTPException(status.HTTP_401_UNAUTHORIZED, "Требуется авторизация")


async def get_current_user(request: Request, db: Annotated[AsyncSession, Depends(get_session)]) -> User:
    token = _token(request, ADMIN)
    decoded = decode_access_token(token, ADMIN) if token else None
    if not decoded or not await family_active(db, decoded[1]):
        raise UNAUTHORIZED
    user = await db.get(User, decoded[0])
    if not user or not user.is_active:
        raise UNAUTHORIZED
    return user


async def get_superuser(user: Annotated[User, Depends(get_current_user)]) -> User:
    if not user.is_superuser:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Недостаточно прав")
    return user


async def get_optional_customer(
    request: Request, db: Annotated[AsyncSession, Depends(get_session)]
) -> Customer | None:
    """Клиент, если вошёл. Нет cookie — аноним. Cookie есть, но токен просрочен — 401,
    чтобы фронтенд обновил сессию и повторил запрос (иначе партнёр увидел бы розничные цены)."""
    token = request.cookies.get(CUSTOMER.access_cookie)
    if not token:
        return None
    decoded = decode_access_token(token, CUSTOMER)
    if not decoded or not await family_active(db, decoded[1]):
        raise UNAUTHORIZED
    customer = await db.get(Customer, decoded[0])
    if not customer or not customer.is_active:
        raise UNAUTHORIZED
    return customer


async def get_current_customer(
    customer: Annotated[Customer | None, Depends(get_optional_customer)],
) -> Customer:
    if not customer:
        raise UNAUTHORIZED
    return customer


CurrentUser = Annotated[User, Depends(get_current_user)]
SuperUser = Annotated[User, Depends(get_superuser)]
OptionalCustomer = Annotated[Customer | None, Depends(get_optional_customer)]
CurrentCustomer = Annotated[Customer, Depends(get_current_customer)]


class LoginRateLimiter:
    """Простая защита от перебора паролей (в памяти процесса)."""

    def __init__(self) -> None:
        self._attempts: dict[str, list[float]] = defaultdict(list)

    def _window(self) -> float:
        return settings.login_lockout_minutes * 60

    def check(self, key: str) -> None:
        now = time.monotonic()
        attempts = [t for t in self._attempts[key] if now - t < self._window()]
        self._attempts[key] = attempts
        if len(attempts) >= settings.login_max_attempts:
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                "Слишком много попыток входа. Попробуйте позже.",
            )

    def fail(self, key: str) -> None:
        self._attempts[key].append(time.monotonic())

    def reset(self, key: str) -> None:
        self._attempts.pop(key, None)


login_limiter = LoginRateLimiter()
