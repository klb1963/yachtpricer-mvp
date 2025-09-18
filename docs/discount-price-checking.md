# Как быстро получить токен и использовать его в curl

	1.	В браузере (на странице вашего фронта) открой DevTools → Console и выполните:

window.Clerk?.session?.getToken({ refresh: true }).then(t => { copy(t); t && console.log('JWT copied to clipboard, len=', t.length); });

Это скопирует свежий JWT в буфер обмена.
	2.	В терминале (Mac):

# Подхватить токен из буфера
TOKEN="$(pbpaste)"
# Проверить длину (чтобы убедиться, что не пусто)
echo "TOKEN length: ${#TOKEN}"

Теперь используем $TOKEN во всех curl.

⸻

# Набор curl-команд для проверки «сладкой пары» и статусов

Подставьте свой yachtId и неделю. Ниже — ваш пример для
yachtId=411239cb-bf6b-4d5e-80dd-db2a7c896fe3, week=2025-09-20.

0) Посмотреть rows (и убедиться, что Authorization уходит)

curl -s "http://localhost:8000/api/pricing/rows?week=2025-09-20" \
  -H "Authorization: Bearer $TOKEN" | \
jq '.[] | select(.yachtId=="411239cb-bf6b-4d5e-80dd-db2a7c896fe3") | {name, decision, finalPrice, lastComment, lastActionAt, perms}'

1) SUBMIT с указанием скидки (discountPct)

curl -s -X POST http://localhost:8000/api/pricing/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "yachtId": "411239cb-bf6b-4d5e-80dd-db2a7c896fe3",
    "week": "2025-09-20",
    "status": "SUBMITTED",
    "comment": "Submit via curl with discount",
    "discountPct": 12.5
  }' | jq '{id, status, discountPct: .discountPct, finalPrice: .finalPrice, lastComment, lastActionAt}'

2) SUBMIT с указанием финальной цены (finalPrice)

curl -s -X POST http://localhost:8000/api/pricing/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "yachtId": "411239cb-bf6b-4d5e-80dd-db2a7c896fe3",
    "week": "2025-09-20",
    "status": "SUBMITTED",
    "comment": "Submit via curl with finalPrice",
    "finalPrice": 2990
  }' | jq '{id, status, discountPct: .discountPct, finalPrice: .finalPrice, lastComment, lastActionAt}'

3) APPROVE

curl -s -X POST http://localhost:8000/api/pricing/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "yachtId": "411239cb-bf6b-4d5e-80dd-db2a7c896fe3",
    "week": "2025-09-20",
    "status": "APPROVED",
    "comment": "Approved via curl"
  }' | jq '{id, status, discountPct: .discountPct, finalPrice: .finalPrice, lastComment, lastActionAt, approvedAt}'

4) REJECT (с обязательным комментарием)

curl -s -X POST http://localhost:8000/api/pricing/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "yachtId": "411239cb-bf6b-4d5e-80dd-db2a7c896fe3",
    "week": "2025-09-20",
    "status": "REJECTED",
    "comment": "Need lower price"
  }' | jq '{id, status, discountPct: .discountPct, finalPrice: .finalPrice, lastComment, lastActionAt}'

5) Быстрая проверка последнего состояния строки после операций

curl -s "http://localhost:8000/api/pricing/rows?week=2025-09-20" \
  -H "Authorization: Bearer $TOKEN" | \
jq '.[] | select(.yachtId=="411239cb-bf6b-4d5e-80dd-db2a7c896fe3") | {name, decision, finalPrice, lastComment, lastActionAt, perms}'


⸻

Подсказки против «протухания» токена
	•	Используйте refresh: true при получении токена в консоли — это выдает свежий JWT.
	•	Держите два окна рядом: DevTools и терминал. Скопировали → сразу pbpaste → запускаете curl.
	•	Если токен всё же истёк (получите 401), просто повторите шаг получения токена и запустите ту же команду.

Эти команды сразу подсветят в логах бэка ваши входные discountPct/finalPrice (мы уже включили там логи), и вы увидите, как применяется «сладкая пара».