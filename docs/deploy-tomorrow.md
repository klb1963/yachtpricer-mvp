# Вот короткий, практичный чек-лист перед созданием PR в main — с командами для проверки миграций и сидов.

1) Обнови ветку и зафиксируй изменения

git status
git add -A
git commit -m "Geo: countries/locations + UI filters"
git fetch origin
git rebase origin/main   # или merge, если так принято у вас
git push -u origin feature/competitor-filters-page

2) Backend: локальная валидация схемы и сборка

cd backend
npm ci
npx prisma validate
npx prisma generate
npm run typecheck
npm run build
cd ..

3) Прогон в контейнерах (с нуля)

docker compose down
docker compose build --no-cache backend
docker compose up -d
docker compose ps

4) Миграции в контейнере

# Статус миграций (должно быть 'up to date' или показать ожидаемые)
docker compose exec backend npx prisma migrate status

# На всякий случай проверить валидность и клиент:
docker compose exec backend npx prisma validate
docker compose exec backend npx prisma generate

5) Сиды географии (страны + локации + алиасы)

Ты добавил npm-скрипты: seed:countries, seed:locations, seed:aliases, seed:geo.

# одним заходом
docker compose exec backend npm run seed:geo

# или по шагам
docker compose exec backend npm run seed:countries
docker compose exec backend npm run seed:locations
docker compose exec backend npm run seed:aliases

6) Быстрая проверка API в контейнере

# страны
docker compose exec backend sh -lc \
  'curl -sS "http://localhost:8000/api/geo/countries" | jq ".[0:5]"'

# локации по стране (пример: TR)
docker compose exec backend sh -lc \
  'curl -sS "http://localhost:8000/api/geo/locations?countryCode=TR&take=500&orderBy=name" \
   | jq "{total, sample: (.items | map({name,countryCode})[:10])}"'

7) Frontend: сборка (на будущее — убедиться, что не падает)

cd frontend
npm ci
npm run build
cd ..

8) Финальный пуш и PR

git status
git add -A
git commit -m "Finalize geo seeding & UI filters; ready for PR"
git push

Затем создай Pull Request в main и проверь, что GitHub Actions проходят:
	•	backend собирается,
	•	миграции применяются (если у тебя так настроено),
	•	тесты/линт OK.

Если что-то упадёт на шаге миграций или сидов в CI/CD — вернёмся и поправим до мержа в main.