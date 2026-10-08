import os
from functools import lru_cache
from pathlib import Path

from pydantic import Field, computed_field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent
ROOT_DIR = BASE_DIR.parent


def _env_files() -> tuple[Path, ...]:
    """По умолчанию — .env в корне проекта. ENV_FILE=.env.dev позволяет держать отдельный конфиг разработки."""
    custom = os.environ.get("ENV_FILE")
    if custom:
        path = Path(custom)
        return (path if path.is_absolute() else ROOT_DIR / path,)
    return (ROOT_DIR / ".env", BASE_DIR / ".env")


class Settings(BaseSettings):
    """Все настройки читаются из переменных окружения / файла .env."""

    model_config = SettingsConfigDict(
        env_file=_env_files(),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- Общие ---
    environment: str = "production"
    debug: bool = False
    site_url: str = "http://localhost"
    site_name: str = "Квипекс"
    api_prefix: str = "/api"
    cors_origins: str = ""

    # --- База данных ---
    database_url: str | None = None
    postgres_user: str = "quipex"
    postgres_password: str = "quipex"
    postgres_db: str = "quipex"
    postgres_host: str = "db"
    postgres_port: int = 5432
    db_echo: bool = False
    db_pool_size: int = 10

    # --- Безопасность ---
    secret_key: str = Field(default="change-me", min_length=8)
    # access-токен короткий, refresh-токен длинный и ротируется при каждом обновлении
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30
    admin_access_cookie: str = "quipex_admin_at"
    admin_refresh_cookie: str = "quipex_admin_rt"
    customer_access_cookie: str = "quipex_at"
    customer_refresh_cookie: str = "quipex_rt"
    admin_email: str | None = None
    admin_password: str | None = None
    login_max_attempts: int = 10
    login_lockout_minutes: int = 15

    # --- Медиа ---
    media_dir: Path = BASE_DIR / "media"
    media_url: str = "/media"
    max_upload_mb: int = 15

    # --- Парсер ---
    parser_base_url: str = "https://e8.ru"
    parser_catalog_path: str = "/catalog/"
    parser_user_agent: str = (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/130.0 Safari/537.36"
    )
    parser_concurrency: int = 2
    parser_delay_seconds: float = 0.7
    parser_timeout_seconds: float = 30
    parser_download_images: bool = True
    parser_auto_sync_hours: float = 0
    parser_skip_categories: str = ""

    # --- Обмен с 1С (CommerceML, «Обмен с сайтом») ---
    exchange_1c_enabled: bool = False
    exchange_1c_login: str | None = None
    exchange_1c_password: str | None = None
    exchange_1c_file_limit_mb: int = 50

    # --- Уведомления ---
    telegram_bot_token: str | None = None
    telegram_chat_id: str | None = None
    smtp_host: str | None = None
    smtp_port: int = 465
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_from: str | None = None
    smtp_use_tls: bool = True
    notify_email: str | None = None

    @field_validator("media_dir")
    @classmethod
    def _media_abs(cls, v: Path) -> Path:
        return v if v.is_absolute() else (ROOT_DIR / v).resolve()

    @computed_field  # type: ignore[prop-decorator]
    @property
    def sqlalchemy_url(self) -> str:
        if self.database_url:
            url = self.database_url
            if url.startswith("postgres://"):
                url = "postgresql+asyncpg://" + url[len("postgres://") :]
            elif url.startswith("postgresql://"):
                url = "postgresql+asyncpg://" + url[len("postgresql://") :]
            return url
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def is_sqlite(self) -> bool:
        return self.sqlalchemy_url.startswith("sqlite")

    @property
    def cookie_secure(self) -> bool:
        return self.site_url.startswith("https://")

    @property
    def cors_origin_list(self) -> list[str]:
        origins = [o.strip().rstrip("/") for o in self.cors_origins.split(",") if o.strip()]
        site = self.site_url.rstrip("/")
        if site and site not in origins:
            origins.append(site)
        return origins

    @property
    def skip_category_slugs(self) -> set[str]:
        return {s.strip() for s in self.parser_skip_categories.split(",") if s.strip()}


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
