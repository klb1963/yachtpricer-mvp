# 🚀 YachtPricer — Локальный запуск

## 📦 Сервисы и порты
| Сервис   | URL / Порт       | Описание               |
|----------|------------------|------------------------|
| Backend  | http://localhost:8000 | NestJS API            |
| Frontend | http://localhost:3000 | React + Vite          |
| DB       | localhost:5432        | PostgreSQL 14         |

---

## 1️⃣ Настройка окружения

### `frontend/.env`
```env
VITE_API_URL=http://localhost:8000
VITE_CLERK_PUBLISHABLE_KEY=sk_test_b2GEuGwtyyfcZ27SAA4ZSGLBsihQ9E5ipVQ4q0ureQ

2️⃣ Docker Compose (dev)

docker-compose.yml

services:
  frontend:
    build: ./frontend
    ports:
      - "3000:5173"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    networks: [yachtpricer-net]

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgres://postgres:postgres@db:5432/yachtpricer
    depends_on: [db]
    networks: [yachtpricer-net]

  db:
    image: postgres:14
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: yachtpricer
    volumes:
      - ./db-data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    networks: [yachtpricer-net]

networks:
  yachtpricer-net:
    driver: bridge

3️⃣ Backend Dockerfile

backend/Dockerfile

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build
RUN npm prune --omit=dev
EXPOSE 8000
CMD ["node", "dist/src/main.js"]

4️⃣ Frontend Dockerfile

frontend/Dockerfile

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

5️⃣ Запуск

## Backend

docker compose stop backend && docker compose rm -f backend
docker compose build --no-cache backend
docker compose up backend

Проверка:
curl http://localhost:8000/health
# {"status":"ok"}

## Frontend
docker compose stop frontend && docker compose rm -f frontend
docker compose build --no-cache frontend
docker compose up frontend

Открыть: http://localhost:3000


## Наглядная схема того, что у нас сейчас работает:

┌─────────────────────────────── Твой Mac (host) ────────────────────────────────┐
│                                                                               │
│  ▶ Браузер (Safari/Chrome/…)                                                  │
│      ├─ http://localhost:3000  ─────────────►  frontend контейнер (Vite)      │
│      └─ http://localhost:8000  ─────────────►  backend контейнер (NestJS)     │
│                                                                               │
│  ▶ VS Code (Reopen in Container)                                              │
│      └─ DevContainer = отдельный контейнер "workspace"                        │
│         • Внутри него работает твоя IDE, терминалы, npm, Prisma CLI и т.п.    │
│         • В него примонтирован код: /workspace/yachtpricer-mvp                │
│         • postCreate.sh ставит зависимости (frontend/backend)                 │
│                                                                               │
│  ▶ Docker Compose управляет сервисами:                                        │
│      ┌─────────────────────────────────────────────── docker network ─────────┐
│      │                                                                         │
│      │  frontend (порт 👉 3000:3000)                                           │
│      │     • читает переменные из frontend/.env                                │
│      │     • ходит к backend по VITE_API_URL (у нас http://localhost:8000)     │
│      │                                                                         │
│      │  backend  (порт 👉 8000:8000)                                           │
│      │     • NestJS/Prisma                                                     │
│      │     • подключается к БД по хосту "db" (внутреннее имя сервиса)          │
│      │       DATABASE_URL=postgres://postgres:postgres@db:5432/yachtpricer     │
│      │                                                                         │
│      │  db = PostgreSQL (порт 👉 5432:5432)                                    │
│      │     • том ./db-data → данные сохраняются между перезапусками            │
│      │                                                                         │
│      └─────────────────────────────────────────────────────────────────────────┘
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘

Куда что ходит
	•	Браузер → localhost:3000 → frontend
	•	Браузер → localhost:8000 → backend
	•	backend → db:5432 (внутреннее имя сервиса в сети Compose)

Где лежит код и зависимости
	•	Код: на твоём Mac, но примонтирован в DevContainer по пути /workspace/yachtpricer-mvp.
	•	node_modules:
	•	для работы IDE — ставим в DevContainer (postCreate.sh).
	•	для рантайма — свои внутри контейнеров frontend/backend (Compose собирает/запускает их отдельно).

Что запускает/останавливает сервисы
	•	Запуск/перезапуск с Mac (не внутри DevContainer):
	•	docker compose up -d backend frontend — поднять
	•	docker compose restart frontend — перезапустить фронт
	•	docker compose logs -f backend — логи бэка
	•	docker compose down — всё остановить

Где живут переменные
	•	frontend: frontend/.env (например, VITE_CLERK_PUBLISHABLE_KEY, VITE_API_URL)
	•	backend: в docker-compose.yml (DATABASE_URL) и/или backend/.env (если добавим)

Что делает DevContainer
	•	Даёт одинаковую среду для разработки (Node 20 и т.п.).
	•	Запускает postCreate.sh → ставит зависимости → IDE без красных подчёркиваний.
	•	Не управляет сервисами Docker (это делает Compose на хосте).
