FROM node:20-alpine
WORKDIR /app

# 1. Устанавливаем зависимости
COPY package*.json ./
RUN npm ci

# 2. Копируем исходники и Prisma-схему (и миграции)
COPY . .

# 3. Генерируем Prisma Client (жёстко указываем путь к схеме)
RUN npx prisma generate --schema=src/prisma/schema.prisma

# 4. Собираем проект
RUN npm run build

# 5. Чистим dev-зависимости (продолжит работать, если @prisma/client в dependencies)
RUN npm prune --omit=dev

EXPOSE 8000

# 6. Запуск (Nest по умолчанию кладёт main.js в dist/)
CMD ["node", "dist/main.js"]
