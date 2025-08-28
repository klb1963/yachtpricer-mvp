#!/usr/bin/env bash
set -Eeuo pipefail

echo "[postCreate] start"

# Идём из корня воркспейса — devcontainer.json.workspaceFolder=/workspace
cd /workspace

# Backend deps + Prisma
if [ -d backend ]; then
  echo "[postCreate] backend deps"
  cd backend
  npm ci || true
  npx prisma generate || true
  cd ..
fi

# Frontend deps
if [ -d frontend ]; then
  echo "[postCreate] frontend deps"
  cd frontend
  npm ci || true
  cd ..
fi

echo "[postCreate] done"
exit 0