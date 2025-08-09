#!/usr/bin/env bash
set -e

FRONT=/workspace/yachtpricer-mvp/frontend
BACK=/workspace/yachtpricer-mvp/backend

echo "→ Fixing ownership on volumes…"
mkdir -p "$FRONT/node_modules" "$BACK/node_modules"
chown -R node:node "$FRONT" "$BACK"

echo "→ Installing frontend deps…"
su node -c "cd $FRONT && (npm ci || npm install)"

echo "→ Installing backend deps…"
su node -c "cd $BACK && (npm ci || npm install)"

echo "✓ postCreate done."