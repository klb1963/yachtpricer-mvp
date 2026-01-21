Правильная схема для YachtPricer сейчас такая:
	•	VS Code открывает папку проекта локально (.../yachtpricer-mvp на Mac).
	•	Vite (frontend) запускается на хосте → быстрый HMR, никаких сюрпризов.
	•	Postgres + backend runtime остаются в Docker Compose → близко к прод-окружению.
	•	Prisma migrate/generate — тоже на хосте, но с DATABASE_URL на docker-db (localhost:5440).

Ниже обещанный README_DEV.md v2 (можешь положить в docs/ или в корень).

⸻

README_DEV.md v2 — YachtPricer (Local Dev)

Принципы
	1.	VS Code — только локально (НЕ Dev Container).
	2.	DB и backend runtime — в Docker Compose.
	3.	Frontend (Vite) — на хосте.
	4.	Prisma migrate/generate — только на хосте.
	5.	На VPS: только prisma migrate deploy, никаких migrate dev.

⸻

Быстрый старт (каждый раз)

1) Поднять DB + backend (Docker)

cd yachtpricer-mvp
docker compose up -d db backend
curl -sS http://localhost:8000/api/health

2) Запустить фронт (host)

cd yachtpricer-mvp
npm ci            # если после смены ветки/зависимостей
npm run -w frontend dev -- --config vite.config.local.ts
# http://localhost:3000


⸻

Prisma и миграции (ТОЛЬКО host)

0) ENV для Prisma (host → docker DB)

cd yachtpricer-mvp/backend
export DATABASE_URL="postgresql://postgres:postgres@localhost:5440/yachtpricer"

1) После правок schema.prisma — создать миграцию

npx prisma migrate dev -n <meaningful_name>
npx prisma generate

2) Перезапустить backend (если нужно)

cd ..
docker compose restart backend

3) Проверки

docker compose exec backend npx prisma migrate status
docker compose exec db psql -U postgres -d yachtpricer -c "\dt"


⸻

Prisma Studio (локально, временно)

(только для разработки, в прод закрыто)

Через compose tools-профиль:

cd yachtpricer-mvp
docker compose --profile tools up -d prisma-studio
# открывать: http://localhost:5557

Остановить:

docker compose --profile tools stop prisma-studio


⸻

Нормы/запреты (чтобы не ловить дрейф)
	•	❌ Не открывать проект в VS Code через Dev Container.
	•	❌ Не делать prisma migrate dev внутри backend-контейнера.
	•	✅ migrate dev — только на host.
	•	✅ На VPS: только migrate deploy.

⸻

Типовые проблемы

Vite “cannot find module vite/dist/…chunks”
→ переустановка зависимостей в корне:

rm -rf node_modules frontend/node_modules
npm ci

Красное в VS Code про react-router-dom и т.п.
→ убедись, что VS Code открыт локально в корне репо, затем:
	•	TypeScript: Restart TS Server
	•	Developer: Reload Window

⸻
