# 🚀 CI/CD: Автоматический деплой на VPS

## 📄 Как это работает

Каждый `push` в ветку **`main`** автоматически:
- Собирает проект (`npm run build`) на GitHub Actions.
- Удаляет старую папку `dist` на сервере.
- Загружает новую сборку в `/home/leonidk/yachtpricer/frontend/dist/`.
- Сайт обновляется и доступен по адресу:  
  👉 [https://sandbox.leonidk.de/](https://sandbox.leonidk.de/)

## 📁 Структура на сервере

Сборка фронтенда размещается по пути:  
```
/home/leonidk/yachtpricer/frontend/dist
```

Обслуживается веб-сервером **nginx**.

## 🔗 GitHub Secrets

Перед первым использованием убедись, что в настройках репозитория заданы секреты:

| Name | Описание |
| --- | --- |
| `VPS_SSH_PRIVATE_KEY` | SSH private key для доступа к VPS |
| `VITE_CLERK_PUBLISHABLE_KEY` | Ключ Clerk для фронтенда |

Добавить секреты можно в:
```
Repository Settings → Secrets and variables → Actions
```

## 🛠️ Конфигурация GitHub Actions

Файл конфигурации `.github/workflows/deploy.yml`:

```yaml
name: Deploy to VPS

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies & build
        run: |
          cd frontend
          npm ci
          npm run build
        env:
          VITE_CLERK_PUBLISHABLE_KEY: ${{ secrets.VITE_CLERK_PUBLISHABLE_KEY }}

      - name: Prepare server
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: sandbox.leonidk.de
          username: leonidk
          key: ${{ secrets.VPS_SSH_PRIVATE_KEY }}
          port: 22
          script: |
            cd ~/yachtpricer/frontend
            git checkout main
            git pull origin main
            rm -rf dist

      - name: Upload built dist
        uses: appleboy/scp-action@v0.1.4
        with:
          host: sandbox.leonidk.de
          username: leonidk
          key: ${{ secrets.VPS_SSH_PRIVATE_KEY }}
          port: 22
          source: ./frontend/dist/*
          target: /home/leonidk/yachtpricer/frontend/dist/
          strip_components: 2
```

## ✅ Как проверить деплой

1. Внеси изменения в проект локально.
2. Закоммить и запушь изменения в ветку `main`.
3. Перейди в [GitHub Actions](https://github.com/klb1963/yachtpricer-mvp/actions) и дождись завершения workflow.
4. Открой сайт:  
   [https://sandbox.leonidk.de/](https://sandbox.leonidk.de/)  
   Убедись, что изменения применились.