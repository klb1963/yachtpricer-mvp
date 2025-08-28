#!/bin/bash
# Запуск YachtPricer

cd "$(dirname "$0")" || exit 1

echo "🚀 Starting YachtPricer..."
docker compose up
