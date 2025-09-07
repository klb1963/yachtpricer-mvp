#!/bin/sh
set -e

# 1) Генерация Prisma Client (на случай изменения схемы)
npx prisma generate

# 2) Применение миграций (боевой режим — без dev тулов)
npx prisma migrate deploy

# 3) Запуск собранного кода
exec node dist/main.js