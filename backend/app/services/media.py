import hashlib
import io
import mimetypes
import uuid
from pathlib import Path

from PIL import Image, UnidentifiedImageError

from app.core.config import settings

MAX_SIDE = 1600
EXT_BY_TYPE = {
    "image/webp": ".webp",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/svg+xml": ".svg",
    "image/gif": ".gif",
}


def media_root() -> Path:
    root = Path(settings.media_dir)
    root.mkdir(parents=True, exist_ok=True)
    return root


def public_url(rel_path: str) -> str:
    return f"{settings.media_url.rstrip('/')}/{rel_path.lstrip('/')}"


def rel_from_url(url: str) -> str | None:
    prefix = settings.media_url.rstrip("/") + "/"
    return url[len(prefix) :] if url.startswith(prefix) else None


def delete_by_url(url: str | None) -> None:
    if not url:
        return
    rel = rel_from_url(url)
    if not rel:
        return
    path = (media_root() / rel).resolve()
    if media_root().resolve() in path.parents and path.is_file():
        path.unlink(missing_ok=True)


def save_remote(content: bytes, source_url: str, folder: str, content_type: str | None) -> str:
    """Сохраняет скачанный файл с детерминированным именем (повторный импорт не плодит копии)."""
    ext = Path(source_url.split("?")[0]).suffix.lower()
    if not ext or len(ext) > 5:
        ext = EXT_BY_TYPE.get((content_type or "").split(";")[0].strip(), ".bin")
    name = hashlib.sha1(source_url.encode()).hexdigest()[:20] + ext
    rel = f"{folder}/{name}"
    path = media_root() / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)
    return public_url(rel)


def save_upload(content: bytes, folder: str, filename: str | None = None) -> str:
    """Сохраняет загруженное из админки изображение, сжимая его в WebP."""
    if len(content) > settings.max_upload_mb * 1024 * 1024:
        raise ValueError(f"Файл больше {settings.max_upload_mb} МБ")
    ext = Path(filename or "").suffix.lower()
    if ext == ".svg" or (mimetypes.guess_type(filename or "")[0] == "image/svg+xml"):
        if b"<script" in content.lower():
            raise ValueError("SVG содержит недопустимый код")
        rel = f"{folder}/{uuid.uuid4().hex}.svg"
        out = content
    else:
        try:
            img = Image.open(io.BytesIO(content))
            img.load()
        except (UnidentifiedImageError, OSError) as exc:
            raise ValueError("Файл не является изображением") from exc
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGBA")
        img.thumbnail((MAX_SIDE, MAX_SIDE))
        buf = io.BytesIO()
        img.save(buf, "WEBP", quality=86, method=5)
        out = buf.getvalue()
        rel = f"{folder}/{uuid.uuid4().hex}.webp"
    path = media_root() / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(out)
    return public_url(rel)
