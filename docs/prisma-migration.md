# 🚀 Чек-лист по миграциям (Prisma + Docker Compose)

⚡️ Золотое правило:
После любых правок schema.prisma всегда выполняем:

npx prisma generate

→ чтобы обновить Prisma Client и видеть новые типы в коде.

⸻

🔹 Локальная разработка
	1.	Правим схему

backend/prisma/schema.prisma


	2.	Создаём новую миграцию и генерим клиента (через контейнер с bind-mount):

docker compose run --rm --entrypoint "" \
  -v "$PWD/backend":/app \
  -e DATABASE_URL="postgresql://postgres:postgres@db:5432/yachtpricer" \
  backend bash -lc 'npx prisma migrate dev -n "<migration_name>" && npx prisma generate'

📂 Результат:
появляется backend/prisma/migrations/<timestamp>_<name>/migration.sql

	3.	Внутри backend/ (VS Code терминал):

npm ci
npx prisma migrate dev
npx prisma generate
npm run start:dev


	4.	Проверяем статус:

docker compose exec backend npx prisma migrate status

Ждём: Database schema is up to date!.

	5.	Фиксируем в Git:

git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "db: <описание изменений>"
git push



⸻

🔹 На сервере (VPS / sandbox)
	1.	Обновляем код и собираем:

git pull origin main
docker compose build backend
docker compose up -d backend


	2.	Применяем миграции:

docker compose exec backend npx prisma migrate deploy


	3.	Проверяем статус:

docker compose exec backend npx prisma migrate status



⸻

🔹 В случае проблем (drift)
	1.	Дропаем схему и пересоздаём:

docker compose exec -T db psql -U postgres -d yachtpricer \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"


	2.	Применяем все миграции заново:

docker compose run --rm --entrypoint "" \
  -v "$PWD/backend":/app \
  -e DATABASE_URL="postgresql://postgres:postgres@db:5432/yachtpricer" \
  backend npx prisma migrate deploy



⸻

🔹 Кратко
	•	migrate dev → локально, создаёт новые миграции.
	•	migrate deploy → на сервере, применяет существующие миграции.
	•	migrate status → проверка состояния.
	•	generate → обновляет Prisma Client.

⸻
