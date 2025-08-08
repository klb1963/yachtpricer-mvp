FROM node:20-alpine
WORKDIR /app

# 1. Устанавливаем зависимости
COPY package*.json ./
RUN npm ci

# 2. Копируем весь код (для первого билда)
COPY . .

# 3. Открываем порт Vite
EXPOSE 3000

# 4. Запускаем dev-сервер
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]