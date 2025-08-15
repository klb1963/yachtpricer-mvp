📋 План работ: скрапинг конкуренток + интеграция в ценообразование

1) Цель

Автоматически собирать и агрегировать цены конкурентных яхт на выбранную неделю для каждой управляемой яхты и использовать эти данные в таблице «Анализ цен и скидок» и процессе согласования.

⸻

2) Результат на каждую «яхта×неделя»
	•	CompetitorPrice — сырые карточки с площадок (одна запись на карточку).
	•	CompetitorSnapshot — агрегаты: TOP1, TOP3Avg, размер выборки, служебные метрики.
	•	PricingDecision — решение по скидке/итоговой цене, статус утверждения, аудит.

⸻

3) Пользовательский поток
	1.	Пользователь открывает неделю в таблице.
	2.	Для каждой свободной яхты проверяем свежесть снапшота:
	•	нет — запускаем /scrape/start;
	•	есть — берём из БД.
	3.	После скрапа → считаем агрегаты → CompetitorSnapshot.
	4.	Вычисляем ML‑реком (эвристика/модель).
	5.	Пользователь редактирует Скидка % или Итог € (поля связаны).
	6.	Отправка на согласование → утверждение директором → экспорт в NauSYS.

⸻

4) Критерии отбора конкуренток (Boataround)
	•	Локация: страна (MVP — HR).
	•	Тип: Sailing yacht (монокорпус/monohull) или Catamaran.
	•	Длина (футы): сравнение и фильтр именно в футах, допуски:
	•	< 40 ft — ±1 ft,
	•	40–50 ft — ±2 ft,
	•	> 50 ft — ±3 ft.
	•	Неделя: check‑in суббота, check‑out через 7 дней.
	•	Каюты/санузлы: допуск ±1 (этап 2).
	•	(Опционально) год постройки, марка/модель для тюнинга релевантности.

⸻

5) База данных (MVP)

Уже есть
	•	ScrapeJob — статусы задач.
	•	CompetitorPrice — сырые цены.

Добавить
model CompetitorSnapshot {
  id          String   @id @default(uuid())
  yachtId     String
  weekStart   DateTime
  source      ScrapeSource
  top1Price   Decimal
  top3Avg     Decimal
  currency    String
  sampleSize  Int
  rawStats    Json?
  collectedAt DateTime @default(now())
  createdAt   DateTime @default(now())

  @@unique([yachtId, weekStart, source])
}

enum DecisionStatus {
  DRAFT
  SUBMITTED
  APPROVED
  REJECTED
}

model PricingDecision {
  id          String         @id @default(uuid())
  yachtId     String
  weekStart   DateTime
  basePrice   Decimal
  top1        Decimal?
  top3        Decimal?
  mlReco      Decimal?
  discountPct Decimal?
  finalPrice  Decimal?
  status      DecisionStatus @default(DRAFT)
  approvedBy  String?
  approvedAt  DateTime?
  notes       String?
  auditJson   Json?

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([yachtId, weekStart])
}

6) API (этапы)

Scrape / агрегация
	•	POST /scrape/start — запуск; вход: {yachtId, weekStart, source}.
	•	GET  /scrape/status?jobId=... — статус задачи.
	•	GET  /scrape/competitors-prices?yachtId=&week= — сырые цены.
	•	POST /scrape/aggregate — агрегирует CompetitorPrice → CompetitorSnapshot.

Таблица ценообразования
	•	GET  /pricing/rows?week=... — строки для фронта (склейка Yacht + Slot + Snapshot + Decision).
	•	PATCH /pricing/decision — сохраняет скидку/итоговую цену (двусторонний пересчёт).
	•	POST /pricing/submit — статус → SUBMITTED.
	•	POST /pricing/approve — статус → APPROVED (+ штампы).

⸻

7) Логика ML‑рекомендации (простая эвристика на старте)
	•	Базовый таргет = min(TOP3Avg - Δ, TOP1 - δ), где Δ, δ — безопасные отступы (например, 100–200€).
	•	Корректировки по году (новее → можно дороже), по бренду/марке, по локации.
	•	Минимальная маржа (порог), ниже не опускаться.

⸻

8) Фронтенд
	•	Источник данных — GET /pricing/rows.
	•	Колонки: Текущая €, TOP1, TOP3, ML‑реком, Скидка %, Итог €, Статус.
	•	Два редактируемых поля: Скидка % ↔ Итог € (взаимный пересчёт).
	•	Кнопки действий: «Отправить», «Утвердить» (с ролями).
	•	На мобильных — карточный вид, индикации по статусам (цвет/иконки).

⸻

9) Этапы внедрения
	•	Спринт A (техбаза): провайдер BoataroundProvider (заглушка → реальный парсер), агрегация, API снапшота, интеграция в /pricing/rows (без статусов).
	•	Спринт B (бизнес‑логика): статусы и роли, эвристика ML‑реком, каюты/санузлы, расширение регионов, конвертация валют.
	•	Спринт C (UX/отчёты): план/факт загрузки, экспорт, финальные правки UX.

⸻

10) Технические заметки
	•	Единицы длины: хранение в метрах, сопоставление в футах; 1 м = 3.28084 ft.
	•	Валюта: хранить валюту карточки; сравнение — в EUR (конверсия опционально).
	•	Кэш: TTL 6–12 часов на CompetitorSnapshot.
	•	Уникальность: CompetitorSnapshot(yachtId, weekStart, source); PricingDecision(yachtId, weekStart).

⸻

11) Быстрые next‑steps
	1.	Добавить схемы CompetitorSnapshot, PricingDecision (миграция).
	2.	Реализовать /scrape/aggregate и заполнение CompetitorSnapshot.
	3.	Подать CompetitorSnapshot в /pricing/rows.
	4.	Сделать взаимосвязанные поля «Скидка %» ↔ «Итог €».
	5.	Кнопки «Отправить»/«Утвердить» — статусный поток.

⸻

Приложение: конверсия метров ↔ футы
	•	feet = meters * 3.28084
	•	Диапазон подбора по длине (в футах) для таргета L:
	•	if L < 40 → ±1 ft
	•	if 40 ≤ L ≤ 50 → ±2 ft
	•	if L > 50 → ±3 ft

⸻

История изменений
	•	2025‑08‑14: первичная версия плана (скрапинг + интеграция + UX).

⸻

Авторы

YachtPricer Team

⸻

Коммит

# коммит
git add docs/scraping-plan.md
git commit -m "docs: add end-to-end scraping + pricing integration plan (Boataround, snapshots, decisions, FE/BE API)"

# пуш
git push origin main