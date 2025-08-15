🛠️ YachtPricer: Дорожная карта песочницы MVP

🎯 Цель этапа
✅ Развернуть живую песочницу на sandbox.leonidk.de с рабочим прототипом основных экранов и минимальным UX.
✅ Дать заказчику доступ и собрать обратную связь.

⸻

📆 Неделя 1 — Инфраструктура и каркас

🔷 День 1–2
✅ Настройка VPS (Hetzner): Docker, Docker Compose, nginx
✅ Настройка (переключение) домена sandbox.leonidk.de на папку yachtpricer, SSL
✅ Создание репозитория с монорепо структурой:

/frontend
/backend
/scraper (заглушка)
/ml (заглушка)

✅ CI/CD: базовый workflow GitHub Actions (деплой на VPS) — реализован, проверен, пути исправлены (strip_components) — сайт успешно деплоится на сервер по push в main.

🔷 День 3–4
✅ Инициализация:
 ✅ Frontend: React + Tailwind + i18next + Vite - DONE
 ✅ Backend: NestJS + PostgreSQL + Prisma - DONE

✅ Проверка запуска backend и frontend локально - DONE  и на VPS

🔷 Clerk интеграция (ключи для dev + prod) — dev и prod готовы.

⸻

📆 Неделя 2 — Функциональность

🔷 День 5–6
📋 Таблица «Анализ цен и скидок» (React Table + Tailwind)

🚀 Краткие пояснения:
✅ Все UUID
✅ В Yacht.currentExtraServices хранится текущая конфигурация услуг в формате JSON (без отдельной связи на каждую мелочь)
✅ История изменений цен/услуг — в отдельных таблицах PriceHistory и ExtraServiceHistory с yachtId/weekSlotId
✅ status вынесен в enum для типобезопасности

Колонки: Яхта, Период, Статус, Текущая, Конкуренты, ML, Скидка %, Итог €, Утверждено
Фильтры: по периоду, флоту, статусу
Двусторонняя связь: Скидка % ↔ Итог €

🔷 День 7
• Backend endpoints для таблицы
• Логика пересчёта скидок и итогов
• Модели пользователей с ролями: аналитик / директор

🔷 День 8
• UI: вход/регистрация (Clerk) - готово для dev, нужно зарегистрировать приложение Google для prod
• Переключение языков RU/EN/HR - DONE
• UI: черновики и утверждения директором

⸻

📆 Неделя 3 — Финализация и демо

🔷 День 9–10
• Импорт XLSX (SheetJS) + валидация
• Базовый экспорт PDF
• Заглушки для скрапинга и ML (отображать мок-данные)
• UI: логирование изменений (простая таблица)

🔷 День 11
• Разворачивание последней версии на VPS
• Smoke-тесты
• Документация (README.md с доступами и ролями)

⸻

✨ Уже сделано

CRUD для яхт:
✅ Backend: GET /yachts, GET /yachts/:id, POST /yachts, PATCH /yachts/:id, DELETE /yachts/:id — DONE
✅ Prisma-модель Yacht с полями inline с планом NauSYS (включая ownerName) — DONE
✅ Frontend: страницы списка, просмотра, редактирования и создания яхт — DONE
✅ Кнопка удаления на странице редактирования — DONE

Dashboard (Table / Cards) — выполнено 12.08.2025:
✅ Фильтры, сортировка, пагинация (frontend + backend) — DONE
✅ Переключатель Table / Cards с сохранением состояния в URL и localStorage — DONE
✅ Адаптивная карточная сетка от 1 до 5 колонок — DONE
✅ Добавлены дефолтные фото для типов яхт (monohull, catamaran, trimaran, compromis) — DONE
✅ Исправлены цвета кнопок и видимость активного режима переключателя — DONE

⸻

🔜 Полезные доработки (очередь)
	1.	Валидация данных на бэке (DTO + class-validator)
	•	CreateYachtDto, UpdateYachtDto, ValidationPipe
	2.	Автозапись в PriceHistory при изменении цены
	•	При PATCH с новым basePrice — создаём запись в истории
	3.	Отображение доступных недель (WeekSlot)
	•	Простой список на карточке яхты, генерация слотов
	4.	Swagger-документация API
	•	@nestjs/swagger — живой /docs с описанием моделей
	5.	Улучшение UX на фронте
	•	Тосты при сохранении/ошибке, модальные подтверждения, форматирование цены

⸻

📊 Демонстрация
• Отправить ссылку заказчику с краткими инструкциями
• Собрать первые отзывы

⸻

# 📆 Этап 2 — Интеграция данных, аналитика и улучшения UX

🔷 1. Интеграция с NauSYS
	•	Подключение API NauSYS (тестовый режим).
	•	Импорт флота с характеристиками, фото, ценами.
	•	Автообновление данных (по расписанию / кнопка).
	•	Сопоставление типов яхт для выбора дефолтных фото.
	•	Логирование изменений при синхронизации.

🔷 2. Модуль конкурентных цен (Scraper)
	•	API: GET /competitors-prices, POST /scrape/start, GET /scrape/status.
	•	Настройка парсинга 1–2 сайтов (BoatAround, Searadar).
	•	UI: список источников, чекбоксы “Активен/Не активен”, кнопка “Обновить сейчас”.
	•	Хранение данных в competitor_prices с yachtId и week_start.

🔷 3. Расширение модели данных и API
	•	Сущность WeekSlot: дата начала, статус загрузки, цена, история.
	•	API для списка доступных недель.
	•	Привязка конкурентных цен к неделе.

🔷 4. Аналитика и ML (шаг 1)
	•	Расчет TOP1 / TOP3 по конкурентам (среднее, медиана, разброс).
	•	API для расчета рекомендуемой скидки до попадания в TOP3.
	•	Отображение рекомендаций в Dashboard.
	•	Заглушка ML-модуля с тестовыми данными.

🔷 5. Улучшения UX
	•	YachtDetailsPage: блок “Доступные недели”, таблица конкурентных цен, история изменений.
	•	Тосты при сохранении/ошибке.
	•	Модальные подтверждения.
	•	Форматирование цен (разделители тысяч, символ валюты).
	•	Локализация новых элементов.

🔷 6. Документация и тестирование
	•	Swagger-документация API.
	•	README с описанием API.
	•	Smoke-тесты ключевых сценариев.
	•	Демо на sandbox с мок-данными.

📅 Порядок выполнения:
	1.	Backend: NauSYS импорт → WeekSlot API.
	2.	Frontend: отображение недель, фото по типу, конкурентные цены.
	3.	Scraper: первый источник → сохранение и вывод.
	4.	Аналитика: расчёт рекомендаций TOP3 / TOP1.
	5.	UX: тосты, модалки, улучшения.
	6.	Тесты и деплой.

	------------------
	отлично, делаем «тонкий» скелет скрапера + стыкуем его с бэком. Ниже даю готовые файлы/фрагменты, которые можно вставить и запустить — это уже рабочий MVP-поток: Backend → (HTTP) → Scraper → Backend сохраняет результаты.

⸻

1) БД (Prisma): минимальные таблицы

Добавь в backend/prisma/schema.prisma:

enum ScrapeSource {
  BOATAROUND
  SEARADAR
}

enum JobStatus {
  PENDING
  RUNNING
  DONE
  FAILED
}

model CompetitorPrice {
  id               String       @id @default(uuid())
  yachtId          String?
  weekStart        DateTime
  source           ScrapeSource
  competitorYacht  String
  price            Decimal
  currency         String       @default("EUR")
  link             String?
  scrapedAt        DateTime     @default(now())
  raw              Json?

  @@index([yachtId, weekStart, source])
}

model ScrapeJob {
  id         String      @id @default(uuid())
  source     ScrapeSource
  status     JobStatus   @default(PENDING)
  params     Json
  startedAt  DateTime?   @default(now())
  finishedAt DateTime?
  error      String?
}

Миграция:

docker compose exec backend npx prisma migrate dev --name add_scraper_models


⸻

2) Scraper сервис (Python + FastAPI + Playwright)

2.1. Структура

/scraper
  ├─ Dockerfile
  ├─ requirements.txt
  └─ app/
     ├─ __init__.py
     └─ main.py

2.2. scraper/Dockerfile

FROM mcr.microsoft.com/playwright/python:v1.46.0-focal

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Браузеры уже установлены в базовом образе playwright
COPY app ./app

ENV PORT=8001
EXPOSE 8001
CMD ["python", "-m", "app.main"]

2.3. scraper/requirements.txt

fastapi==0.110.0
uvicorn==0.29.0
pydantic==2.6.1

2.4. scraper/app/main.py

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
import os

# MVP: пока вернем «полумок» + каркас Playwright можно подключить позже
# чтобы быстро показать end-to-end.

app = FastAPI(title="YachtPricer Scraper", version="0.1.0")

class ScrapeParams(BaseModel):
    location: Optional[str] = None
    yacht_type: Optional[str] = Field(None, description="monohull | catamaran | ...")
    length_min: Optional[float] = None
    length_max: Optional[float] = None
    built_min: Optional[int] = None
    built_max: Optional[int] = None
    week_start: Optional[str] = Field(None, description="YYYY-MM-DD")
    limit: int = 10

class CompetitorItem(BaseModel):
    competitor_yacht: str
    price: float
    currency: str = "EUR"
    link: Optional[str] = None
    raw: Optional[dict] = None

class ScrapeResponse(BaseModel):
    source: str
    items: List[CompetitorItem]

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/scrape/boataround", response_model=ScrapeResponse)
def scrape_boataround(params: ScrapeParams):
    # TODO: Реальный парсинг Playwright — позже.
    # Сейчас — заглушка с детерминированными данными для интеграции.
    demo = [
        CompetitorItem(
            competitor_yacht="Bavaria 46 2019",
            price=4800,
            currency="EUR",
            link="https://www.boataround.com/some/listing",
            raw={"mock": True, "location": params.location},
        ),
        CompetitorItem(
            competitor_yacht="Jeanneau Sun Odyssey 45",
            price=4500,
            currency="EUR",
            link="https://www.boataround.com/some/listing-2",
            raw={"mock": True},
        ),
    ][: params.limit]
    return ScrapeResponse(source="BOATAROUND", items=demo)


⸻

3) Docker Compose: подключаем сервис

В docker-compose.yml добавь сервис scraper и переменную окружения в backend:

services:
  backend:
    # ...
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - SCRAPER_URL=http://scraper:8001
    depends_on:
      - db
      - scraper

  scraper:
    build: ./scraper
    container_name: yachtpricer-mvp-scraper-1
    ports:
      - "8001:8001"

Запуск/пересборка:

docker compose up -d --build scraper backend

Проверка:

curl http://localhost:8001/health
# {"status":"ok"}


⸻

4) Backend (NestJS): контроллер для старта скрапа и сохранения результатов

Добавь backend/src/scraper.controller.ts:

import {
  Body, Controller, Get, Post, Query, BadRequestException,
} from '@nestjs/common';
import { PrismaClient, Prisma, ScrapeSource, JobStatus } from '@prisma/client';

const prisma = new PrismaClient();

type StartScrapeDto = {
  source: 'BOATAROUND' | 'SEARADAR';
  yachtId?: string;
  weekStart?: string; // YYYY-MM-DD
  location?: string;
  yacht_type?: string;
  length_min?: number;
  length_max?: number;
  built_min?: number;
  built_max?: number;
  limit?: number;
};

@Controller()
export class ScraperController {
  private SCRAPER_URL = process.env.SCRAPER_URL || 'http://scraper:8001';

  @Get('competitors-prices')
  async listCompetitorPrices(
    @Query('yachtId') yachtId?: string,
    @Query('weekStart') weekStart?: string,
  ) {
    const where: Prisma.CompetitorPriceWhereInput = {
      AND: [
        yachtId ? { yachtId } : undefined,
        weekStart ? { weekStart: new Date(weekStart) } : undefined,
      ].filter(Boolean) as Prisma.CompetitorPriceWhereInput[],
    };
    const items = await prisma.competitorPrice.findMany({
      where, orderBy: { scrapedAt: 'desc' }, take: 200,
    });
    return { items };
  }

  @Post('scrape/start')
  async start(@Body() body: StartScrapeDto) {
    const { source } = body;
    if (!source) throw new BadRequestException('source is required');

    // Создаем job
    const job = await prisma.scrapeJob.create({
      data: {
        source: source as ScrapeSource,
        status: JobStatus.RUNNING,
        params: body as any,
        startedAt: new Date(),
      },
    });

    // Вызываем scraper-сервис
    const endpoint =
      source === 'BOATAROUND' ? '/scrape/boataround' : '/scrape/searadar';

    const fetchUrl = this.SCRAPER_URL + endpoint;
    let payload: any = {
      location: body.location,
      yacht_type: body.yacht_type,
      length_min: body.length_min,
      length_max: body.length_max,
      built_min: body.built_min,
      built_max: body.built_max,
      week_start: body.weekStart,
      limit: body.limit ?? 10,
    };

    try {
      const res = await fetch(fetchUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Scraper error: ${res.status} ${text}`);
      }
      const json: {
        source: string;
        items: Array<{
          competitor_yacht: string;
          price: number;
          currency?: string;
          link?: string;
          raw?: unknown;
        }>;
      } = await res.json();

      const weekStart = body.weekStart ? new Date(body.weekStart) : new Date();

      // Сохраняем результаты
      for (const it of json.items) {
        await prisma.competitorPrice.create({
          data: {
            yachtId: body.yachtId,
            weekStart,
            source: source as ScrapeSource,
            competitorYacht: it.competitor_yacht,
            price: String(it.price),
            currency: it.currency ?? 'EUR',
            link: it.link,
            raw: it.raw as Prisma.InputJsonValue,
          },
        });
      }

      await prisma.scrapeJob.update({
        where: { id: job.id },
        data: { status: JobStatus.DONE, finishedAt: new Date() },
      });

      return { success: true, jobId: job.id, saved: json.items.length };
    } catch (e: any) {
      await prisma.scrapeJob.update({
        where: { id: job.id },
        data: { status: JobStatus.FAILED, finishedAt: new Date(), error: e?.message ?? 'unknown' },
      });
      throw new BadRequestException(e?.message ?? 'scrape failed');
    }
  }
}

Зарегистрируй контроллер в backend/src/app.module.ts:

import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { YachtsController } from './yachts.controller';
import { ScraperController } from './scraper.controller';

@Module({
  imports: [],
  controllers: [AppController, YachtsController, ScraperController],
  providers: [],
})
export class AppModule {}

Пересобрать бэкенд:

docker compose restart backend

Проверка потока:

# 1) здоровье скрапера
curl http://localhost:8001/health

# 2) старт задачи (пример)
curl -X POST http://localhost:8000/scrape/start \
  -H 'Content-Type: application/json' \
  -d '{
    "source":"BOATAROUND",
    "yachtId":"b7e83156-b411-49d0-88fc-1e0b56a5a263",
    "weekStart":"2025-08-18",
    "location":"Split",
    "yacht_type":"monohull",
    "length_min":11,
    "length_max":14,
    "built_min":2015,
    "limit":5
  }'

# 3) посмотреть сохранённые цены
curl "http://localhost:8000/competitors-prices?yachtId=b7e8...&weekStart=2025-08-18"


⸻

5) (Опционально) простая фронт-заглушка

Позже добавим в Dashboard блок:
	•	кнопка “Update now” → POST /scrape/start
	•	таблица “Competitors” → GET /competitors-prices?yachtId=…&week=…

⸻

Что дальше (быстрые инкременты)
	•	Подключить реальный Playwright-парсинг в scraper/app/main.py (вторым шагом, когда убедимся, что связка/сохранение работают).
	•	Добавить ScrapeJob в Swagger NestJS.
	•	Пагинация/фильтры для GET /competitors-prices.

Если что-то из шагов хочется упростить ещё сильнее (например, пока не писать job-таблицу), скажи — дам сокращённую версию.