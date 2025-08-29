#!/bin/bash
# Остановка YachtPricer

cd "$(dirname "$0")" || exit 1

echo "🛑 Stopping YachtPricer..."
docker compose -f docker-compose.yml -f .devcontainer/docker-compose.devcontainer.yml down
