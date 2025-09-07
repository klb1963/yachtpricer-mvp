# ---------- build ----------
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---------- runtime ----------
FROM node:20-alpine AS runtime
WORKDIR /app
COPY --from=build /app/dist ./dist
RUN npm i -g serve
EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000"]