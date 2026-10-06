#!/bin/sh
set -e

echo "Применение миграций БД..."
alembic upgrade head

# Один процесс: фоновый импорт и расписание синхронизации работают внутри приложения.
exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port "${PORT:-8000}" \
  --proxy-headers \
  --forwarded-allow-ips="*"
