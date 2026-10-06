"""Служебные команды.

  docker compose exec backend python -m app.cli create-admin email@example.com 'пароль'
  docker compose exec backend python -m app.cli import [full|prices]
"""

import asyncio
import sys

from sqlalchemy import func, select

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models import ImportJob, User


async def create_admin(email: str, password: str) -> None:
    async with SessionLocal() as session:
        user = (
            await session.execute(select(User).where(func.lower(User.email) == email.lower()))
        ).scalar_one_or_none()
        if user:
            user.hashed_password = hash_password(password)
            user.is_active = True
            user.is_superuser = True
            print(f"Пароль пользователя {email} обновлён")
        else:
            session.add(
                User(email=email.lower(), hashed_password=hash_password(password), is_superuser=True)
            )
            print(f"Создан администратор {email}")
        await session.commit()


async def run_import(mode: str) -> None:
    from app.services.importer import ImportRunner

    job = await ImportRunner.start(mode=mode, trigger="cli")
    if ImportRunner._current_task:
        await ImportRunner._current_task
    async with SessionLocal() as session:
        job = await session.get(ImportJob, job.id)
        print(job.log)
        print(f"Статус: {job.status.value}")


def main() -> None:
    args = sys.argv[1:]
    if len(args) == 3 and args[0] == "create-admin":
        asyncio.run(create_admin(args[1], args[2]))
    elif args and args[0] == "import":
        asyncio.run(run_import(args[1] if len(args) > 1 else "full"))
    else:
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
