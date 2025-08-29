#!/bin/bash
# Запуск YachtPricer

cd "$(dirname "$0")" || exit 1

echo "🚀 Starting YachtPricer..."
docker compose -f docker-compose.yml -f .devcontainer/docker-compose.devcontainer.yml up -d
