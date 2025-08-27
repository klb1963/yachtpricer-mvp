# ---------- base ----------
    FROM node:20-alpine AS base
    WORKDIR /app
    RUN apk add --no-cache libc6-compat openssl
    
    # ---------- deps (все зависимости, включая dev) ----------
    FROM base AS deps
    COPY package*.json ./
    RUN npm ci
    
    # ---------- build ----------
    FROM deps AS build
    # Копируем prisma на уровень /app/prisma (а не src/prisma!)
    COPY prisma ./prisma
    # Генерируем клиент (берёт schema из /app/prisma/schema.prisma)
    RUN npx prisma generate
    
    # Копируем исходники и собираем
    COPY tsconfig*.json ./
    COPY src ./src
    RUN npm run build
    
    # ---------- runner ----------
    FROM base AS runner
    ENV NODE_ENV=production
    WORKDIR /app
    
    # Копируем node_modules (оставим dev-зависимости, чтобы был доступен npx prisma для миграций)
    COPY --from=deps /app/node_modules ./node_modules
    
    # Копируем собранный билд и prisma (для миграций в рантайме)
    COPY --from=build /app/dist ./dist
    COPY --from=build /app/prisma ./prisma
    COPY package*.json ./
    
    EXPOSE 8000
    # Перед стартом приложения применяем миграции
    CMD sh -c "npx prisma migrate deploy && node dist/main.js"
    
    # ---------- devtools (опционально, для prisma studio) ----------
    FROM build AS devtools
    CMD ["npx", "prisma", "studio", "--port", "5555"]
