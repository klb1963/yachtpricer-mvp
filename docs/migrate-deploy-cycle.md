Хорошо 👍 Давай зафиксируем тот же чек-лист, только на русском языке, и я предложу вариант для meaningful_name.

⸻

🔄 Полный цикл работы с миграциями и деплоем

1) Локально: меняем схему и создаём миграцию

# редактируем backend/prisma/schema.prisma

# создаём миграцию (пишется в backend/prisma/migrations/*)
docker compose exec backend npx prisma migrate dev --name <meaningful_name>

# генерируем клиент и проверяем типы/сборку
docker compose exec backend npx prisma generate
docker compose exec backend npm run typecheck
docker compose exec backend npm run build

2) Локально: проверяем работу

docker compose up -d
# проверяем таблицы
docker compose exec db psql -U postgres -d yachtpricer -c "\dt"
docker compose exec backend npx prisma migrate status
# проверяем эндпоинты
curl -sS "http://localhost:8000/api/geo/countries" | head

3) Локально: сидинг (если нужен)

# запускаем сиды
docker compose exec backend npm run seed:geo

# проверяем
docker compose exec db psql -U postgres -d yachtpricer \
  -c "SELECT COUNT(*) FROM countries;"
docker compose exec db psql -U postgres -d yachtpricer \
  -c "SELECT COUNT(*) FROM locations WHERE source='NAUSYS';"

4) Коммит и пуш

git add backend/prisma/schema.prisma backend/prisma/migrations \
        backend/package.json backend/package-lock.json \
        backend/prisma/seed/*.ts \
        backend/Dockerfile docker-compose.yml
git commit -m "feat: <описание> (+ migrations + seeds)"
git push -u origin <branch>
# открываем PR → ревью → merge в main

5) На VPS: подтягиваем код и пересобираем

(Если деплой идёт через GitHub Actions — это автоматом. Если вручную:)

cd /home/<user>/yachtpricer/yachtpricer-mvp
git fetch --all && git checkout main && git pull
docker compose build backend
docker compose up -d

6) На VPS: применяем миграции

docker compose exec backend npx prisma migrate deploy
docker compose exec backend npx prisma migrate status

7) На VPS: сидинг (если нужно)

docker compose exec backend npm run seed:geo

8) Проверка после деплоя

docker compose exec db psql -U postgres -d yachtpricer -c "\dt"

curl -sS https://sandbox.leonidk.de/api/health
curl -sS "https://sandbox.leonidk.de/api/geo/countries" | head
curl -sS "https://sandbox.leonidk.de/api/geo/locations?countryCode=TR&take=50" | head


⸻

✅ Meaningful name для миграции

Судя по тому, что мы сделали: добавили таблицы countries, locations, location_aliases и всё для гео-фильтров.
Хорошее имя будет:

add_geo_tables

или более подробно:

20250920_add_geo_countries_locations


⸻