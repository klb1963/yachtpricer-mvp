#!/bin/sh
set -e
cd /app

# 1) Генерация Prisma Client (на случай изменения схемы)
npx prisma generate --schema=/app/prisma/schema.prisma || true

# 2) Применение миграций (боевой режим — без dev тулов)
npx prisma migrate deploy --schema=/app/prisma/schema.prisma

# 3) Запуск собранного кода
exec node dist/main.js