#!/bin/sh
set -e

# 1) deps — если volume пустой
[ -d node_modules ] || npm ci

# 2) prisma client
npx prisma generate

# 3) запускаем из src через ts-node
exec npm run start:dev