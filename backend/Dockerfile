FROM node:20-alpine
WORKDIR /app

# 1. Устанавливаем зависимости
COPY package*.json ./
RUN npm ci

# 2. Копируем исходники и Prisma-схему
COPY . .

# 3. Генерируем Prisma Client
RUN npx prisma generate

# 4. Собираем проект
RUN npm run build

# 5. Очищаем dev-зависимости (опционально, для уменьшения образа)
RUN npm prune --omit=dev

EXPOSE 8000

# 6. Запускаем приложение
CMD ["node", "dist/src/main.js"]
