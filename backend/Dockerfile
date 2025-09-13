# ---------- base ----------
    FROM node:20-alpine AS base
    WORKDIR /app
    RUN apk add --no-cache libc6-compat openssl
    
    # ---------- deps (все зависимости, включая dev) ----------
    FROM base AS deps
    WORKDIR /app
    # ВАЖНО: копируем отдельными строками, чтобы кэш корректно инвалидировался
    COPY package.json ./
    COPY package-lock.json ./

    # Диагностика: проверим, что зависимость заявлена в package.json
    RUN node -e "const p=require('./package.json'); if(!p.dependencies || !p.dependencies['@clerk/backend']){console.error('NO @clerk/backend in package.json'); process.exit(1)}"

    # Ставим зависимости строго по lock-файлу
    RUN npm ci

    # Диагностика: убеждаемся, что пакет реально установлен
    RUN node -e "require.resolve('@clerk/backend/package.json'); console.log('clerk/backend OK')"
    
    # ---------- build ----------
    FROM deps AS build
    # Кладём prisma рядом с приложением (не в src/)
    COPY prisma ./prisma
    # Генерируем клиент (берёт schema из /app/prisma/schema.prisma)
    RUN npx prisma generate --schema=prisma/schema.prisma
    
    # Копируем исходники и собираем
    COPY tsconfig*.json ./
    COPY src ./src
    RUN npm run build
    
    # ---------- runner ----------
    FROM base AS runner
    ENV NODE_ENV=production
    WORKDIR /app
    
    # Копируем node_modules (оставляем dev-зависимости, чтобы был доступен npx prisma)
    COPY --from=deps /app/node_modules ./node_modules
    
    # Копируем билд и prisma (нужна для миграций в рантайме)
    COPY --from=build /app/dist ./dist
    COPY --from=build /app/prisma ./prisma
    COPY package*.json ./
    
    # 👇 добавили entrypoint.sh
    COPY entrypoint.sh ./entrypoint.sh
    RUN chmod +x ./entrypoint.sh
    
    EXPOSE 8000
    
    # Запуск через наш entrypoint (внутри он делает migrate deploy и стартует app)
    ENTRYPOINT ["sh", "./entrypoint.sh"]
    
    # ---------- devtools (опционально, для prisma studio) ----------
    FROM build AS devtools
    CMD ["npx", "prisma", "studio", "--port", "5555"]