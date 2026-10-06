import asyncio
import logging
from contextlib import asynccontextmanager, suppress

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import account, auth, exchange_1c, public
from app.api.admin import categories, customers, products, sales, system
from app.bootstrap import bootstrap
from app.core.config import settings
from app.services.importer import ImportRunner, auto_sync_loop
from app.services.media import media_root

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
for noisy in ("aiosqlite", "httpx", "httpcore"):
    logging.getLogger(noisy).setLevel(logging.WARNING)


@asynccontextmanager
async def lifespan(_: FastAPI):
    if not settings.debug and settings.secret_key in ("change-me", "changeme", "secret"):
        raise RuntimeError("Задайте уникальный SECRET_KEY в .env (openssl rand -hex 32)")
    await bootstrap()
    await ImportRunner.mark_stale_jobs()
    sync_task = asyncio.create_task(auto_sync_loop())
    yield
    sync_task.cancel()
    with suppress(asyncio.CancelledError):
        await sync_task


app = FastAPI(
    title=f"{settings.site_name} API",
    lifespan=lifespan,
    docs_url=f"{settings.api_prefix}/docs" if settings.debug else None,
    redoc_url=None,
    openapi_url=f"{settings.api_prefix}/openapi.json" if settings.debug else None,
)

app.add_middleware(GZipMiddleware, minimum_size=1024)
if settings.cors_origin_list:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

admin = APIRouter(prefix="/admin")
for r in (products.router, categories.router, sales.router, system.router, customers.router):
    admin.include_router(r)

api = APIRouter(prefix=settings.api_prefix)
api.include_router(public.router, tags=["public"])
api.include_router(auth.router)
api.include_router(account.router)
api.include_router(exchange_1c.router)
api.include_router(admin)
app.include_router(api)

app.mount(settings.media_url, StaticFiles(directory=media_root()), name="media")
