#!/usr/bin/env bash
set -e

echo "→ Installing frontend deps in devcontainer volume…"
cd /workspace/frontend
npm ci || npm install

echo "→ Installing backend deps in devcontainer volume…"
cd /workspace/backend
npm ci || npm install

echo "✓ Done."