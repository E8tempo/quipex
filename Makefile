# Команды для разработки. Конфиг — .env.dev (см. .env.dev.example).
ENV_FILE ?= .env.dev
export ENV_FILE
PY := backend/.venv/bin/python

.PHONY: help setup dev-db dev-api dev-web migrate migration import admin lint check up down logs

help:
	@echo "make setup      — установить зависимости (venv + npm)"
	@echo "make dev-db     — поднять Postgres для разработки (docker)"
	@echo "make migrate    — применить миграции"
	@echo "make dev-api    — бэкенд с автоперезагрузкой  http://localhost:8000/api/docs"
	@echo "make dev-web    — фронтенд                     http://localhost:3000"
	@echo "make import     — импорт каталога с e8.ru из консоли"
	@echo "make migration m='описание' — новая миграция по изменениям моделей"
	@echo "make check      — линтеры и проверка типов"
	@echo "make up / down / logs — продакшен-стек (docker compose, конфиг .env)"

setup:
	@test -f .env.dev || cp .env.dev.example .env.dev
	python3 -m venv backend/.venv && backend/.venv/bin/pip install -q -r backend/requirements.txt
	cd frontend && npm install

dev-db:
	docker compose -f docker-compose.dev.yml up -d

migrate:
	cd backend && ../$(PY) -m alembic upgrade head

migration:
	cd backend && ../$(PY) -m alembic revision --autogenerate -m "$(m)"

dev-api: migrate
	cd backend && ../$(PY) -m uvicorn app.main:app --reload --port 8000

dev-web:
	cd frontend && npm run dev

import:
	cd backend && ../$(PY) -m app.cli import

admin:
	cd backend && ../$(PY) -m app.cli create-admin "$(email)" "$(password)"

lint check:
	cd frontend && npx tsc --noEmit && npx eslint .
	cd backend && ../$(PY) -m compileall -q app alembic

up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f --tail=100
