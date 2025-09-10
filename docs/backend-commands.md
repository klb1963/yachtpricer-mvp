Конечно 👍 Вот полный текст файла backend_commands.md, можно скопировать целиком:

# Backend: команды и их назначение

## Запуск и остановка

- **Из корня проекта (host):**
  ```bash
docker compose up backend

## Запуск контейнера backend.
•	Из корня проекта (host):

docker compose stop backend - Остановка контейнера backend.

•	Из корня проекта (host):

docker compose build backend - Пересборка контейнера backend после изменений в коде.

⸻

## Prisma и база данных
•	Из контейнера backend:

npx prisma generate - Генерация клиента Prisma (после изменений в схеме).

•	Из контейнера backend:

npx prisma migrate dev - Применение миграций в dev-режиме.

•	Из контейнера backend:

npx prisma studio

Визуальный интерфейс для работы с БД.

•	Из контейнера backend:

npx ts-node prisma/seed.ts - Заполнение базы тестовыми данными (сид).

### Запуск Prisma Studio на локале (MacBook):
docker compose --profile tools up -d prisma-studio

⸻

## Подключение к БД (PostgreSQL)
•	Из host:

docker compose exec db psql -U postgres -d yachtpricer - Подключение к Postgres в контейнере db.

•	Внутри psql:

\dt - Список таблиц.

•	Внутри psql:

SELECT * FROM yachts LIMIT 10; - Пример запроса.

⸻

## Scraper: запуск и проверка
•	Из host:

curl -s -X POST 'http://localhost:8000/api/scrape/start' \
  -H 'Content-Type: application/json' \
  -d '{"yachtId":"<YACHT_ID>","weekStart":"2025-08-16"}' | jq
- Запуск скрейпа для лодки.

•	Из host:

curl -s "http://localhost:8000/api/scrape/status?jobId=<JOB_ID>" | jq
- Проверка статуса job.

•	Из host:

curl -s "http://localhost:8000/api/scrape/competitors-prices?yachtId=<YACHT_ID>&week=2025-08-16" | jq
- Получение сохранённых конкурентов.

•	Из host:

curl -s -X POST 'http://localhost:8000/api/scrape/aggregate' \
  -H 'Content-Type: application/json' \
  -d '{"yachtId":"<YACHT_ID>","week":"2025-08-16","source":"BOATAROUND"}' | jq
- Агрегация конкурентов в snapshot.

⸻

## Логи backend
•	Из корня проекта (host):
docker compose -f docker-compose.yml logs -f backend
- Потоковые логи backend.

•	С фильтром по скрейперу:
docker compose -f docker-compose.yml logs -f backend | grep -E 'Scraper(Service|Filter)|candidates=|DROP|KEEP'
- Логи только по ScraperService и фильтрам.

