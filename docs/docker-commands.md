# 🔑 Шпаргалка Docker Compose для YachtPricer

## ▶ Запуск и остановка

### Запустить проект в фоне
docker compose up -d

### Остановить проект
docker compose down

## 🔍 Статус и список контейнеров

### Показать все контейнеры проекта
docker compose ps

## 📜 Логи

### Логи backend
docker compose logs -f backend

### Логи frontend
docker compose logs -f frontend

### Логи базы (Postgres)
docker compose logs -f db

## 🐚 Войти внутрь контейнера

### Войти в shell backend
docker compose exec backend sh

### Войти в Postgres (psql)
docker compose exec db psql -U postgres -d yachtpricer

## 🔄 Сборка и миграции

### Пересобрать контейнеры после изменений в Dockerfile или зависимостях
docker compose build --no-cache

### Запустить миграции Prisma
docker compose run --rm backend npx prisma migrate deploy

## 🧹 Очистка

### Полностью остановить и удалить контейнеры, сети, тома
docker compose down -v


⸻

## 📌 Самое важное:
	•	Запуск: docker compose up -d
	•	Логи: docker compose logs -f backend
	•	Вход в БД: docker compose exec db psql -U postgres -d yachtpricer

⸻
