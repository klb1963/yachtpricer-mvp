# Cхема для backend с полным циклом работы и командами

⸻

📦 Архитектура + Цикл работы с Backend

                ┌────────────────────────────────────┐
                │   /frontend (React/Vite/Next)      │
                │   Логика UI и API-запросов         │
                └──────────────┬─────────────────────┘
                               │
             HTTP-запросы      │   (пример: fetch('/yachts'))
                               ▼
┌───────────────────────────────────────────────────────────┐
│                  /backend (NestJS)                         │
│  ┌───────────── app.controller.ts ──────────────┐          │
│  │  @Get('/')  →  Hello World!                  │          │
│  │  @Get('/health') → {status: 'ok'}            │          │
│  └─────────────────────────────────────────────┘          │
│             │                                  ▲           │
│             │ Prisma ORM                       │           │
│             ▼                                  │           │
│  ┌─────────────────────────────────────────┐  │           │
│  │ schema.prisma → npx prisma generate      │  │           │
│  │ Models: Yacht, Owner, WeekSlot, ...      │  │           │
│  └─────────────────────────────────────────┘  │           │
│             │                                  │           │
│             ▼                                  │           │
│       PostgreSQL (в контейнере `db`)           │           │
└───────────────────────────────────────────────────────────┘


⸻

🔄 Полный цикл работы с backend

1. Остановить backend (если он запущен)

docker compose stop backend
docker compose rm -f backend

2. Пересобрать backend

docker compose build backend
# или, если нужно полностью без кеша
docker compose build --no-cache backend

3. Запустить backend

docker compose up backend

4. Проверить, что он жив

curl http://localhost:8000/health

Ожидаем:

{"status":"ok"}

5. Остановить backend (после работы)
	•	Если запущен в форграунде: Ctrl + C
	•	Если в фоне:

docker compose stop backend
