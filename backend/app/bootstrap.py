"""Первичное наполнение: администратор из .env и базовые контентные страницы."""

import logging

from sqlalchemy import func, select

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models import Page, User

log = logging.getLogger(__name__)

DEFAULT_PAGES = [
    {
        "slug": "delivery",
        "title": "Доставка и оплата",
        "sort_order": 10,
        "content": (
            "<h2>Доставка</h2>"
            "<p>Отправляем заказы по всей России транспортными компаниями. По городу — собственной "
            "службой доставки. Возможен самовывоз со склада.</p>"
            "<h2>Оплата</h2>"
            "<ul><li>Наличными или картой при получении</li>"
            "<li>Безналичный расчёт по счёту для юридических лиц</li>"
            "<li>Онлайн-оплата после подтверждения заказа менеджером</li></ul>"
        ),
    },
    {
        "slug": "wholesale",
        "title": "Оптовым покупателям",
        "sort_order": 20,
        "content": (
            "<p>Работаем с монтажными организациями, строительными компаниями и магазинами. "
            "Специальные цены, отсрочка платежа для постоянных партнёров, помощь в подборе "
            "оборудования.</p>"
            "<p>Оставьте заявку — менеджер свяжется с вами и пришлёт индивидуальное предложение.</p>"
        ),
    },
    {
        "slug": "warranty",
        "title": "Гарантия и возврат",
        "sort_order": 30,
        "content": (
            "<p>На всё оборудование действует гарантия производителя. Сервисное обслуживание и "
            "гарантийный ремонт выполняются авторизованными сервисными центрами.</p>"
        ),
    },
    {
        "slug": "about",
        "title": "О компании",
        "sort_order": 40,
        "content": (
            "<p>Компания «Квипекс» — поставщик систем отопления и водоснабжения. Продаём оптом и в "
            "розницу котлы, водонагреватели, бойлеры, насосы и комплектующие.</p>"
        ),
    },
    {
        "slug": "privacy",
        "title": "Политика конфиденциальности",
        "sort_order": 90,
        "content": (
            "<p>Мы обрабатываем персональные данные, указанные в формах на сайте, исключительно для "
            "связи с вами и выполнения заказов. Данные не передаются третьим лицам, за исключением "
            "служб доставки в объёме, необходимом для доставки заказа.</p>"
        ),
    },
]


async def bootstrap() -> None:
    async with SessionLocal() as session:
        if settings.admin_email and settings.admin_password:
            email = settings.admin_email.strip().lower()
            exists = (
                await session.execute(select(User).where(func.lower(User.email) == email))
            ).scalar_one_or_none()
            if not exists:
                session.add(
                    User(
                        email=email,
                        hashed_password=hash_password(settings.admin_password),
                        full_name="Администратор",
                        is_superuser=True,
                    )
                )
                log.info("Создан администратор %s", email)

        has_pages = (await session.execute(select(func.count(Page.id)))).scalar_one()
        if not has_pages:
            for p in DEFAULT_PAGES:
                session.add(Page(**p))
        await session.commit()
