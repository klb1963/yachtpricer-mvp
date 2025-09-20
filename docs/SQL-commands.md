# Запуск SQL-интерпритатора в Docker

docker compose exec -T db psql -U postgres -d yachtpricer

# Удалить pricing_decision и с price_audit_logs
для яхты 411239cb-bf6b-4d5e-80dd-db2a7c896fe3 на выбранную неделю 2025-09-20T00:00:00Z:

Посмотреть, что именно будем удалять (проверка):
docker compose exec -T db psql -U postgres -d yachtpricer -c "
SELECT id, \"yachtId\", \"weekStart\", status
FROM pricing_decisions
WHERE \"yachtId\" = '411239cb-bf6b-4d5e-80dd-db2a7c896fe3'
  AND \"weekStart\" = '2025-09-20T00:00:00Z';
"

Снести связанные логи аудита и саму запись решения
docker compose exec -T db psql -U postgres -d yachtpricer -c "
DELETE FROM price_audit_logs AS l
USING pricing_decisions AS d
WHERE l.\"decisionId\" = d.id
  AND d.\"yachtId\" = '411239cb-bf6b-4d5e-80dd-db2a7c896fe3'
  AND d.\"weekStart\" = '2025-09-20T00:00:00Z';

DELETE FROM pricing_decisions
WHERE \"yachtId\" = '411239cb-bf6b-4d5e-80dd-db2a7c896fe3'
  AND \"weekStart\" = '2025-09-20T00:00:00Z';
"

1) Проверка, что записи больше нет
docker compose exec -T db psql -U postgres -d yachtpricer -c "
SELECT id, \"yachtId\", \"weekStart\", status
FROM pricing_decisions
WHERE \"yachtId\" = '411239cb-bf6b-4d5e-80dd-db2a7c896fe3'
  AND \"weekStart\" = '2025-09-20T00:00:00Z';
"
2) Посмотреть, что фронт теперь видит DRAFT/пусто и есть права на submit
curl -s "http://localhost:8000/api/pricing/rows?week=2025-09-20" \
  -H "X-User-Email: lida.kleimann@gmail.com" \
| jq '.[] | select(.yachtId=="411239cb-bf6b-4d5e-80dd-db2a7c896fe3") | {name, decision, perms}'

3) Прогон «черновик → сабмит с комментом»

	•	Черновик:
 curl -s -X POST http://localhost:8000/api/pricing/decision \
  -H "Content-Type: application/json" \
  -H "X-User-Email: lida.kleimann@gmail.com" \
  -d '{
    "yachtId": "411239cb-bf6b-4d5e-80dd-db2a7c896fe3",
    "week": "2025-09-20",
    "discountPct": 10,
    "finalPrice": 3150
  }' | jq .

     	•	Сабмит с комментом:
  curl -s -X POST http://localhost:8000/api/pricing/status \
  -H "Content-Type: application/json" \
  -H "X-User-Email: lida.kleimann@gmail.com" \
  -H "X-User-Role: MANAGER" \
  -d '{
    "yachtId": "411239cb-bf6b-4d5e-80dd-db2a7c896fe3",
    "week": "2025-09-20",
    "status": "SUBMITTED",
    "comment": "Проверка после очистки"
  }' | jq .      

  4) Контрольное чтение строки для этой недели
  curl -s "http://localhost:8000/api/pricing/rows?week=2025-09-20" \
  -H "X-User-Email: lida.kleimann@gmail.com" \
| jq '.[] | select(.yachtId=="411239cb-bf6b-4d5e-80dd-db2a7c896fe3") | {name, status: .decision?.status, lastComment}'

============================
## Полная очистка обеих таблиц
docker compose exec -T db psql -U postgres -d yachtpricer -c "
TRUNCATE TABLE price_audit_logs CASCADE;
TRUNCATE TABLE pricing_decisions CASCADE;
"

## Сначала чистим price_audit_logs, потом pricing_decisions
docker compose exec -T db psql -U postgres -d yachtpricer -c "
DELETE FROM price_audit_logs;
DELETE FROM pricing_decisions;
"

## Очистка только за конкретную неделю
(например, 2025-09-20)
docker compose exec -T db psql -U postgres -d yachtpricer -c "
DELETE FROM price_audit_logs l
USING pricing_decisions d
WHERE l.\"decisionId\" = d.id
  AND d.\"weekStart\" = '2025-09-20T00:00:00Z';

DELETE FROM pricing_decisions
WHERE \"weekStart\" = '2025-09-20T00:00:00Z';
"

## Очистка только для конкретной яхты
(например, 411239cb-bf6b-4d5e-80dd-db2a7c896fe3)
docker compose exec -T db psql -U postgres -d yachtpricer -c "
DELETE FROM price_audit_logs l
USING pricing_decisions d
WHERE l.\"decisionId\" = d.id
  AND d.\"yachtId\" = '411239cb-bf6b-4d5e-80dd-db2a7c896fe3';

DELETE FROM pricing_decisions
WHERE \"yachtId\" = '411239cb-bf6b-4d5e-80dd-db2a7c896fe3';
"

## Очистка по яхте + неделе
docker compose exec -T db psql -U postgres -d yachtpricer -c "
DELETE FROM price_audit_logs l
USING pricing_decisions d
WHERE l.\"decisionId\" = d.id
  AND d.\"yachtId\" = '411239cb-bf6b-4d5e-80dd-db2a7c896fe3'
  AND d.\"weekStart\" = '2025-09-20T00:00:00Z';

DELETE FROM pricing_decisions
WHERE \"yachtId\" = '411239cb-bf6b-4d5e-80dd-db2a7c896fe3'
  AND \"weekStart\" = '2025-09-20T00:00:00Z';
"

📌 Совет: если часто зачищаешь именно «текущую неделю для одной яхты», можно вынести ID яхты и дату в переменные окружения в zsh:
YID=411239cb-bf6b-4d5e-80dd-db2a7c896fe3
WEEK=2025-09-20T00:00:00Z

docker compose exec -T db psql -U postgres -d yachtpricer -c "
DELETE FROM price_audit_logs l
USING pricing_decisions d
WHERE l.\"decisionId\" = d.id
  AND d.\"yachtId\" = '$YID'
  AND d.\"weekStart\" = '$WEEK';

DELETE FROM pricing_decisions
WHERE \"yachtId\" = '$YID'
  AND \"weekStart\" = '$WEEK';
"
