#!/usr/bin/env bash
set -Eeuo pipefail

echo "[postCreate] start"

cd /workspace

# ставим все зависимости монорепы в корень
npm ci --workspaces || true

# генерация prisma клиента
npm -w backend exec prisma generate || true

# лёгкая валидация (через require.resolve, не через ls node_modules/)
node -e "require.resolve('@nestjs/common/package.json', { paths: ['./backend'] }); console.log('NestJS OK')"
node -e "require.resolve('@prisma/client/package.json', { paths: ['./backend'] }); console.log('Prisma Client OK')"
node -e "require.resolve('vite/package.json', { paths: ['./frontend'] }); console.log('Vite OK')"

echo "[postCreate] done"