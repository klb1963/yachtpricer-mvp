#!/usr/bin/env bash
set -euo pipefail

# путь к проекту (проверь, при необходимости поправь)
PROJECT_DIR="$HOME/Developer/YachtPricer/yachtpricer-mvp"
SESSION="yachtpricer"

# если сессия уже существует — подключаемся к ней
tmux has-session -t "$SESSION" 2>/dev/null && exec byobu attach -t "$SESSION"

# окно 0: docker (логи backend)
tmux new-session -d -s "$SESSION" -n docker -c "$PROJECT_DIR"
tmux send-keys "docker compose up -d && docker compose ps" C-m
tmux send-keys "docker compose logs -f backend" C-m

# окно 1: backend (Nest dev)
tmux new-window -t "$SESSION":1 -n backend -c "$PROJECT_DIR/backend"
tmux send-keys "npm run start:dev" C-m

# окно 2: frontend (Vite dev)
tmux new-window -t "$SESSION":2 -n frontend -c "$PROJECT_DIR/frontend"
tmux send-keys "npm run dev" C-m

# окно 3: prisma studio
tmux new-window -t "$SESSION":3 -n prisma -c "$PROJECT_DIR/backend"
tmux send-keys "npx prisma studio --port 5555" C-m

# окно 4: db (psql в контейнере)
tmux new-window -t "$SESSION":4 -n db -c "$PROJECT_DIR"
tmux send-keys "docker compose exec -it db psql -U postgres -d yachtpricer" C-m

# окно 5: workspace (шелл в контейнере)
tmux new-window -t "$SESSION":5 -n ws -c "$PROJECT_DIR"
tmux send-keys "docker compose exec -it workspace bash" C-m

# подключаемся через byobu
exec byobu attach -t "$SESSION"
