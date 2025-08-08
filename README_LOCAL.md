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


