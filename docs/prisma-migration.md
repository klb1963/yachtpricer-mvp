# 🚀 Чек-лист по миграциям (Prisma + Docker Compose)

🔹 Локальная разработка
	1.	Правим схему

vim backend/prisma/schema.prisma
или в VS Code редактируем файл 

	2.	Создаём новую миграцию (через контейнер, с bind-mount)

docker compose run --rm --entrypoint "" \
  -v "$PWD/backend":/app \
  -e DATABASE_URL="postgresql://postgres:postgres@db:5432/yachtpricer" \
  backend bash -lc 'npx prisma migrate dev -n "<migration_name>" && npx prisma generate'

📂 Результат: появляется папка backend/prisma/migrations/<timestamp>_<name>/migration.sql

	3.	Проверяем статус

docker compose exec backend npx prisma migrate status

Ждём Database schema is up to date!.

	4.	Фиксируем в Git

git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "db: <описание изменений>"
git push

⸻

🔹 На сервере (VPS / sandbox)
	1.	Обновляем код

git pull origin main
docker compose build backend
docker compose up -d backend


	2.	Применяем миграции

docker compose exec backend npx prisma migrate deploy


	3.	Проверяем статус

docker compose exec backend npx prisma migrate status

⸻

🔹 В случае проблем (drift)

Если migrate status показывает drift:
	1.	Дропаем схему и пересоздаём:

docker compose exec -T db psql -U postgres -d yachtpricer -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"


	2.	Применяем все миграции заново:

docker compose run --rm --entrypoint "" \
  -v "$PWD/backend":/app \
  -e DATABASE_URL="postgresql://postgres:postgres@db:5432/yachtpricer" \
  backend npx prisma migrate deploy

⸻

🔹 Кратко
	•	migrate dev → для локальной разработки, создаёт новые миграции.
	•	migrate deploy → для сервера, применяет уже существующие миграции.
	•	migrate status → проверка состояния.
	•	generate → обновляет Prisma Client.

⸻
