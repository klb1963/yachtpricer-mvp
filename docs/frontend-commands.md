# Frontend (Vite) — запуск локально на Mac (НЕ в Docker)

> **Важно:** все команды ниже выполняются **в обычном терминале macOS** (iTerm/Terminal),  
> в каталоге проекта **`./frontend`**. Не в dev-container, не в Docker.

---

## Быстрый старт (каждый раз)

**Терминал: macOS (host), каталог: `./frontend`**
```bash
cd frontend

# 1) Включаем Node 22 через nvm (берётся из .nvmrc)
nvm use

# 2) Запускаем Vite c локальным конфигом
npm run dev -- --config vite.config.local.ts
# Альтернатива, если в package.json скрипт dev без конфига:
# npx vite --config vite.config.local.ts

## Однократно настроить Node 22
# Создаём .nvmrc, чтобы всегда использовать Node 22
echo "22" > .nvmrc

# Ставим и активируем Node 22
nvm install
nvm use

# (необязательно) сделать Node 22 дефолтом в nvm
nvm alias default 22

# Проверка
node -v

Если nvm: command not found, добавь инициализацию nvm в ~/.zshrc:
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

Ты прав — запутал. Исправляюсь. Ниже — правильный файл для твоего процесса, где фронт запускается на Mac (вне Docker) с указанием vite.config.local.ts.

Скопируй целиком и сохрани как frontend_local_commands.md.

# Frontend (Vite) — запуск локально на Mac (НЕ в Docker)

> **Важно:** все команды ниже выполняются **в обычном терминале macOS** (iTerm/Terminal),  
> в каталоге проекта **`./frontend`**. Не в dev-container, не в Docker.

---

## Быстрый старт (каждый раз)

**Терминал: macOS (host), каталог: `./frontend`**
```bash
cd frontend

# 1) Включаем Node 22 через nvm (берётся из .nvmrc)
nvm use

# 2) Запускаем Vite c локальным конфигом
npm run dev -- --config vite.config.local.ts
# Альтернатива, если в package.json скрипт dev без конфига:
# npx vite --config vite.config.local.ts

Открой: http://localhost:3000

⸻

Однократно настроить Node 22

Терминал: macOS (host), каталог: ./frontend

# Создаём .nvmrc, чтобы всегда использовать Node 22
echo "22" > .nvmrc

# Ставим и активируем Node 22
nvm install
nvm use

# (необязательно) сделать Node 22 дефолтом в nvm
nvm alias default 22

# Проверка
node -v

Если nvm: command not found, добавь инициализацию nvm в ~/.zshrc:

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

⸻

Установка зависимостей

Терминал: macOS (host), каталог: ./frontend

# Чистая установка по lock-файлу (предпочтительно)
npm ci
# или, если нет package-lock.json:
# npm install


⸻

Запуск / сборка

Терминал: macOS (host), каталог: ./frontend

# Dev-сервер Vite (с нужным конфигом!)
npm run dev -- --config vite.config.local.ts
# или
# npx vite --config vite.config.local.ts

# Production-сборка (в dist/)
npm run build

# Предпросмотр prod-сборки
npm run preview


⸻

Прокси к backend (важно)

В файле vite.config.local.ts должен быть прокси на backend:

server: {
  host: true,
  port: 3000,
  proxy: {
    '/api': {
      target: 'http://localhost:8000',
      changeOrigin: true,
      secure: false,
    },
  },
}

Backend у тебя в Docker на localhost:8000, фронт — на Mac. Это корректно.

⸻

Проверки и отладка

Терминал: macOS (host), каталог: ./frontend

# Проверить, что фронт отвечает
curl -s http://localhost:3000 | head -n 5

# Проверить, что backend жив
curl -s http://localhost:8000/api/health

Частые проблемы
	•	Node не той версии / crypto.hash is not a function / Vite ругается

cd frontend
nvm use      # должен подхватить 22 из .nvmrc
node -v      # v22.x.x


	•	Порт 3000 занят

lsof -nP -iTCP:3000 | grep LISTEN
kill -9 <PID>
# либо запустить на другом порту:
npm run dev -- --config vite.config.local.ts --port 3001


	•	Странные ошибки Vite после правок конфига

rm -rf node_modules/.vite
npm run dev -- --config vite.config.local.ts


	•	Убедиться, что ты НЕ в контейнере
	•	В приглашении не должно быть вида node ➜ /workspace.
	•	Команда uname -a покажет macOS, а не Debian/Ubuntu.

⸻

Краткая памятка (самое главное)
	1.	Открывай обычный терминал macOS, не dev-container.
	2.	cd frontend → nvm use → npm run dev -- --config vite.config.local.ts.
	3.	Backend слушает http://localhost:8000, фронт — http://localhost:3000.
