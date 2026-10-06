"""Точка обмена для 1С: URL в настройках узла обмена — https://сайт/api/1c/exchange"""

import base64
import secrets

from fastapi import APIRouter, Request
from fastapi.responses import PlainTextResponse

from app.core.config import settings
from app.exchange import commerceml

router = APIRouter(prefix="/1c", tags=["1c-exchange"])

SESSION_COOKIE = "cvipex_1c"
_sessions: set[str] = set()


def _text(body: str, status: int = 200) -> PlainTextResponse:
    # 1С ожидает ответ в windows-1251 или UTF-8 с BOM; UTF-8 поддерживается современными конфигурациями
    return PlainTextResponse(body, status_code=status, media_type="text/plain; charset=utf-8")


def _check_basic(request: Request) -> bool:
    header = request.headers.get("authorization", "")
    if not header.lower().startswith("basic ") or not settings.exchange_1c_login:
        return False
    try:
        login, _, password = base64.b64decode(header[6:]).decode("utf-8").partition(":")
    except ValueError:
        return False
    return secrets.compare_digest(login, settings.exchange_1c_login) and secrets.compare_digest(
        password, settings.exchange_1c_password or ""
    )


@router.api_route("/exchange", methods=["GET", "POST"])
async def exchange(request: Request, type: str = "", mode: str = "", filename: str = "") -> PlainTextResponse:
    if not settings.exchange_1c_enabled:
        return _text("failure\nОбмен с 1С отключён (EXCHANGE_1C_ENABLED=false)")

    if mode == "checkauth":
        if not _check_basic(request):
            return _text("failure\nНеверный логин или пароль", 401)
        token = secrets.token_urlsafe(24)
        if len(_sessions) > 100:  # обмен — редкий процесс, старые сеансы не нужны
            _sessions.clear()
        _sessions.add(token)
        return _text(f"success\n{SESSION_COOKIE}\n{token}")

    if request.cookies.get(SESSION_COOKIE) not in _sessions:
        return _text("failure\nТребуется авторизация (checkauth)", 401)

    if mode == "init":
        # новый сеанс обмена — удаляем файлы прошлого сеанса этого типа
        import shutil

        shutil.rmtree(commerceml.exchange_dir() / commerceml.safe_filename(type or "catalog"), ignore_errors=True)
        return _text(f"zip=no\nfile_limit={settings.exchange_1c_file_limit_mb * 1024 * 1024}")

    if mode == "file":
        name = commerceml.safe_filename(filename)
        if not name:
            return _text("failure\nНе указано имя файла")
        kind = commerceml.safe_filename(type) or "catalog"
        path = (commerceml.exchange_dir() / kind / name).resolve()
        if commerceml.exchange_dir().resolve() not in path.parents:
            return _text("failure\nНедопустимое имя файла")
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("ab") as fh:  # 1С может присылать файл частями
            async for chunk in request.stream():
                fh.write(chunk)
        return _text("success")

    if type == "catalog" and mode == "import":
        try:
            if filename.startswith("offers"):
                await commerceml.import_offers_file(filename)
            else:
                await commerceml.import_catalog_file(filename)
        except NotImplementedError as exc:
            return _text(f"failure\n{exc}")
        return _text("success")

    if type == "sale" and mode == "query":
        try:
            return PlainTextResponse(await commerceml.export_orders_xml(), media_type="application/xml")
        except NotImplementedError as exc:
            return _text(f"failure\n{exc}")

    if type == "sale" and mode == "success":
        return _text("success")

    return _text(f"failure\nНеизвестный режим: type={type} mode={mode}")
