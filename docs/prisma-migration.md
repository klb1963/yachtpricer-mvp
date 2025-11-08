# 🚀 Чек-лист по миграциям (Prisma + Docker Compose)

2 ноября 2025 г.

0. Предпосылки
	•	Все миграции живут в: backend/prisma/migrations.
	•	Новые миграции создаём только из workspace-контейнера.
(или локально с хоста — но давай придерживаться одного варианта, чтобы вообще не путаться)
	•	backend-контейнер никогда не создаёт миграции, только использует уже созданные.

⸻

1. Правим схему БД

Редактируем:
backend/prisma/schema.prisma

⸻

2. Поднимаем БД и workspace

cd ~/projects/yachtpricer-mvp
docker compose up -d db backend

⸻

3. Делаем миграцию и генерим Prisma Client (локально)

cd backend
export DATABASE_URL="postgresql://postgres:postgres@localhost:5440/yachtpricer"

# создаём и применяем миграцию
npx prisma migrate dev -n "имя_миграции"

пример:
npx prisma migrate dev -n add_is_active_to_user

# на всякий случай отдельно генерим клиент
npx prisma generate

4. Пересобираем и перезапускаем backend-контейнер
cd ..
docker compose up -d --build backend
⸻

4. Проверяем и коммитим

На хосте:

cd backend
git status

Должно быть:
	•	изменён prisma/schema.prisma,
	•	добавлены новые миграции в prisma/migrations/**.

Коммитим:

git add prisma/schema.prisma prisma/migrations
git commit -m "Add competitor_price FK dimensions to CompetitorPrice"

⸻

5. Перезапуск бэкенда

Если backend уже поднят:

docker compose up -d --build backend
# или, если не менялся Dockerfile/зависимости, достаточно:
# docker compose restart backend

⸻

Старую команду можно официально “похоронить”

Ту длинную команду через backend:

docker compose run --rm --entrypoint "" \
  -v "$PWD/backend":/app \
  -e DATABASE_URL="postgresql://postgres:postgres@db:5432/yachtpricer" \
  backend bash -lc 'npx prisma migrate dev -n "<migration_name>" && npx prisma generate'

предлагаю просто выкинуть из арсенала.
Она теоретически может работать, но:
	•	зависит от того, какие dev-зависимости есть в образе backend,
	•	легко ломается при любом обновлении Prisma или стека.

workspace как “dev-контейнер” эту проблему решает: там у нас обычный Node + монтированная монорепа, и все dev-зависимости ставятся так же, как у тебя локально.

⸻

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

	3. Перезапуск бекэнда:
docker compose down && docker compose build backend && docker compose up -d backend
или
docker compose up -d --build backend



Внутри backend/ (VS Code терминал):

cd /workspace/backend

# 1) Полная переустановка зависимостей бекэнда
rm -rf node_modules
npm ci

# 2) Сгенерить Prisma Client (иначе @prisma/client будет "красным")
npx prisma generate

# 3) (Опционально) миграции — только если меняли schema.prisma
# npx prisma migrate dev

# 4) Проверка сборки
npm run build

# 5) Локальный запуск дев-сервера (если нужен)
npm run start:dev

Затем в локальном терминале:
cd frontend
nvm use            # у тебя .nvmrc = 22
npm ci             # поставить node_modules по lock-файлу

и перезапустить TS-сервер в VS Code

запуск фронтенда Vite локально:
npm run dev -- --config vite.config.local.ts

cd frontend

# 1) Убедись, что активен Node 20 из nvm
nvm use 20
node -v    # должно показать v20.x

# 2) Полная очистка
rm -rf node_modules package-lock.json
npm cache clean --force

# 3) Свежая установка (без --no-optional!)
npm install

# 4) На всякий случай перестроить бинарники Rollup
npm rebuild rollup

# 5) Запуск Vite (одного --config достаточно)
npm run dev -- --config vite.config.local.ts

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
