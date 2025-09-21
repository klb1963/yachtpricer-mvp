Ниже — готовый, пошаговый чек-лист (команды + что ожидать). Выполняй на VPS (под leonidk или root, где лежит repo). Он проверяет: код в main, контейнеры, лог CI-деплоя, backend health, Prisma Studio и БД.

⸻

1) Убедиться, что на VPS запрошена последняя main

cd /home/leonidk/yachtpricer/yachtpricer-mvp
git fetch --all --prune
git status --porcelain
git rev-parse --abbrev-ref HEAD
git rev-parse origin/main
git log -n1 origin/main

Ожидаем: ветка origin/main содержит последний коммит (твой PR/merge). git status — чисто.

⸻

2) Проверить статус сервисов docker compose

docker compose -f docker-compose.yml ps

Ожидаем: backend, db, frontend, prisma-studio (если включён) — Up (backend — healthy).

⸻

3) Проверить логи GitHub Actions (веб) — либо локально (если нужно)

В вебе: GitHub → repo → Actions → последний Deploy to VPS run. Должен быть Success.
Если хочешь смотреть логи на сервере:

# покажет последние строки логов deploy (после docker-compose up)
docker compose -f docker-compose.yml logs backend --tail=200
docker compose -f docker-compose.yml logs prisma-studio --tail=200

Ожидаем: ошибок запуска, backend слушает порт 8000.

⸻

4) Проверить здоровье backend (HTTP)

curl -fsS -o /dev/null -w "%{http_code}\n" http://localhost:8000/api/health

Ожидаем: 200.

Если не 200, посмотри логи:

docker compose -f docker-compose.yml logs backend --tail=200


⸻

5) Проверить что backend слушает на 8000 (host)

docker compose -f docker-compose.yml ps
# или
ss -lntp | grep 8000 || netstat -lntp | grep 8000

Ожидаем: порт 8000 привязан (0.0.0.0:8000 -> контейнер).

⸻

6) Убедиться, что Prisma миграции применены (в контейнере backend)

docker compose exec backend npx prisma migrate status

Ожидаем: Database schema is up to date! и перечисление миграций.

⸻

7) Проверить таблицы в базе (в контейнере db)

docker compose exec db psql -U postgres -d yachtpricer -c '\dt' | sed -n '1,120p'

Ожидаем: таблицы из миграций (competitor_filters, locations, users, и т.д.).

⸻

8) Проверить Prisma Studio процесс и публичный доступ
	•	Проверим, запущен ли контейнер prisma-studio и какой порт проброшен:

docker compose -f docker-compose.yml ps | grep prisma-studio

	•	Проверить, отвечает ли локально:

# если в compose проброшено 127.0.0.1:5557->5555
curl -sI http://127.0.0.1:5557/ | head -n 5

Ожидаем: HTTP/1.1 200 OK.
	•	Если Studio не показывает новые таблицы — перезапустим контейнер studio, чтобы он перечитал схему:

docker compose restart prisma-studio || true
# затем снова проверить:
curl -sI http://127.0.0.1:5557/ | head -n 3

Почему это работает: Studio читается на старом процессе — при изменениях схемы или миграциях лучше перезапустить Studio.

⸻

9) Проверить nginx proxy (веб)

Если ты используешь nginx с проксир. на studio.sandbox.leonidk.de, убедись, что nginx проксирует на тот же порт, где слушает prisma-studio (например, 127.0.0.1:5557). Проверить конфиг (на VPS):

sudo nginx -T | sed -n '1,200p'     # вывести конфиг
# или конкретный файл:
sudo sed -n '1,200p' /etc/nginx/sites-available/studio.sandbox.leonidk.de

Или проверить доступ извне:

curl -sI https://studio.sandbox.leonidk.de/ | head -n 5

Ожидаем: 200 OK и от Studio.

⸻

10) Если Studio показывает «старый» набор таблиц — последовательный план действий
	1.	Убедиться в DATABASE_URL в среде контейнера prisma-studio:

docker compose exec prisma-studio printenv DATABASE_URL

Ожидаем: postgresql://postgres:postgres@db:5432/yachtpricer.

	2.	Если верный — перезапустить prisma-studio (см. пункт 8).
	3.	Если после перезапуска таблицы всё ещё неполны — проверить, откуда Studio берёт схему:
	•	Studio использует Prisma schema, лежащую в контейнере (по --schema=... при запуске); убедиться, что в compose путь к схеме и volume корректны (и schema актуальна).
	•	Перезапустить backend тоже, чтобы исключить кеши:

docker compose restart backend


	4.	В крайнем случае — остановить старые/висящие процессы Studio и поднять заново:

docker compose down prisma-studio || true
docker compose up -d prisma-studio



⸻

11) Проверить веб UI (фронтенд)

После успешного деплоя:
	•	https://sandbox.leonidk.de/ — фронтенд должен показывать новую кнопку/форму фильтров.
	•	Проверь network (DevTools) при открытии формы: запросы GET /api/filters/competitors и PATCH /filters/competitors возвращают 200/JSON.

⸻

Ожидаемый быстрый сценарий «всё ок» (коротко)
	1.	docker compose ps → все up (backend healthy).
	2.	curl -fsS http://localhost:8000/api/health → 200.
	3.	docker compose exec backend npx prisma migrate status → up to date.
	4.	docker compose exec db psql -U postgres -d yachtpricer -c '\dt' → таблицы есть.
	5.	curl -sI http://127.0.0.1:5557/ → 200; curl -sI https://studio.sandbox.leonidk.de/ → 200.
	6.	Веб: sandbox → форма; studio → все таблицы.

⸻
