#!/bin/bash
# Остановка YachtPricer

cd "$(dirname "$0")" || exit 1

echo "🛑 Stopping YachtPricer..."
docker compose down
