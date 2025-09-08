#!/bin/sh
set -Eeuo pipefail

echo "[postCreate] start"

# идём из корня воркспейса
cd /workspace

# === Backend ===
if [ -d backend ]; then
  echo "[postCreate] backend deps"
  cd backend

  # ставим зависимости (ci = строго по lock-файлу)
  npm ci

  # генерим prisma client
  npx prisma generate

  # проверка типов и сборка (чтобы tsserver видел index.d.ts из dist)
  npm run build || echo "[postCreate] build failed, but continuing for editor"

  cd ..
fi

# === Frontend ===
if [ -d frontend ]; then
  echo "[postCreate] frontend deps"
  cd frontend
  npm ci
  cd ..
fi

echo "[postCreate] done"