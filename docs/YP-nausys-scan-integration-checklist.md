План: NauSYS Scan Integration (Frontend ↔ Backend)

A. Контракты и БД
	1.	Схема/модель данных

	•	Что делаем: подтверждаем поля competitor_prices: source, externalId, weekStart, price, currency, link, мета (year, cabins, heads, lengthFt, marina), scrapeJobId, raw.
	•	Правило externalId: для NAUSYS = String(yachtId из NauSYS), для INNERDB/BOATAROUND — null (если нет внешнего ID).
	•	Критерии приёмки:
	•	Есть уникальность на (source, weekStart, link) или (source, weekStart, externalId, yachtId) — чтобы не плодить дублей.
	•	Поле source поддерживает 'INNERDB' | 'NAUSYS' | 'BOATAROUND'.

	2.	Снапшоты

	•	Что делаем: в competitor_snapshots считаем top1, top3Avg, currency, sampleSize по (yachtId, weekStart, source).
	•	Приёмка: повторный запуск апсертит ту же строку.

B. Backend (Scraper)
	3.	router/controller

	•	Что делаем: POST /scrape/start принимает { yachtId, weekStart, source, filterId? }.
	•	Приёмка: при NAUSYS filterId обязателен (или мягкое предупреждение — решаем UX).

	4.	сервис scraper.service.ts

	•	Ветки:
	•	source==='INNERDB' — текущая логика (без изменений).
	•	source==='NAUSYS' — вызываем runNausysJob({ weekStart, filterId, targetYachtId }).
	•	Приёмка: лог console.info('[NauSYS] start', {weekStart, filterId, targetYachtId}).

	5.	runNausysJob

	•	Шаги (как у тебя описано):
	1.	charterBases → companyIds.
	2.	yachts/{companyId} → собрать yachtIds и byYachtId (year, cabins, heads, modelId, locationId).
	3.	Батчи freeYachts (по ~80 id) для периода [periodFrom, periodTo].
	4.	Маппинг к CompetitorPrice:
	•	externalId = String(yachtId из NauSYS),
	•	price, currency, discountPct (max из массива или (priceList-final)/priceList*100),
	•	marina из locationFromId (или из базового locationId),
	•	мета: year, cabins, heads, lengthFt? (по модели), raw — сохраняем.
	5.	Сохранить все как upsert по ключу уникальности.
	•	Приёмка: лог итогов kept=N, список причин фильтрации — вернуть в ответ StartResponseDto.

	6.	aggregateSnapshot

	•	Что делаем: выборка всех competitor_prices по (yachtId, weekStart, source); расчет top1, top3Avg, currency, sampleSize; апсерт в competitor_snapshots.
	•	Приёмка: отдаёт Snapshot | null.

	7.	Логи/диагностика

	•	Что делаем: в каждом шаге малошумные info (begin/end, counts), в ошибках — warn/error c jobId.
	•	Приёмка: по jobId можно восстановить путь выполнения.

C. Frontend
	8.	Переключатель источника (ГОТОВО)

	•	В CompetitorFiltersPage: INNERDB/NAUSYS, хранить в localStorage: competitor:scanSource, не сбрасывать Reset.
	•	Приёмка: значение переживает перезагрузку и сохраняется в URL ?source=.

	9.	DashboardPage — use scanSource (ГОТОВО)

	•	Что делаем: состояние scanSource: ScrapeSource, передавать в:
	•	startScrape({ source, filterId? }) (для NAUSYS — filterId из activeFilterId),
	•	aggregateSnapshot({ source }),
	•	listCompetitorPrices({ source }).
	•	UX-guard: если scanSource==='NAUSYS' и нет activeFilterId — мягкий alert + открыть модалку.
	•	Приёмка: Network в DevTools показывает ?source=… и filterId (для NAUSYS).

	10.	Визуальный бейдж источника

	•	Что делаем: рядом с кнопкой Scan в YachtCard/YachtTable показывать mini-бейдж: 🌐 NAUSYS / 🏠 INNERDB.
	•	Приёмка: бейдж переключается при смене источника.

	11.	UI детализация результатов

	•	Что делаем: в списке офферов показывать competitorYacht (year) · marina · cabins/heads · price currency.
	•	Приёмка: не ломает лейаут, есть скролл, 40px-60px высота списка.

D. Фильтры (CompetitorFilters)
	12.	Хранение фильтров (уже есть)

	•	CompetitorFilters — single source of truth для NauSYS-фильтра.
	•	Приёмка: GET /filters/competitors возвращает предустановку.

	13.	Передача фильтров на backend

	•	Что делаем: при startScrape передаём filterId (id последнего сохраненного набора).
	•	Приёмка: backend извлекает фильтр по id, преобразует к NauSYS-формату (countryCodes → NauSYS country ids, locationIds → NauSYS location ids/aliases и т.д.).

	14.	Кнопка “Test filters” (уже есть)

	•	Что делаем: POST /scrape/test возвращает {count} — сколько кандидатов даёт фильтр до реального скана (может быть прокси к NauSYS или локальный расчёт).
	•	Приёмка: работающий alert с количеством.

E. Качество и тесты
	15.	Источники не смешиваются

	•	Что делаем: все запросы снапшотов/цен сопровождаются source.
	•	Приёмка: в БД competitor_prices видим строки с source=NAUSYS и отдельные с source=INNERDB; снапшоты считаются по каждому source отдельно.

	16.	Производительность

	•	Что делаем: батчи по 80, таймауты/ретраи; если 413/400 — сжимаем до 50.
	•	Приёмка: job не падает на длинных списках, в логах видно количество батчей.

	17.	Ошибки и предупреждения

	•	Что делаем: в ответ старта включать reasons: string[] при kept=0 (например: “no matches by location”, “payload too large — reduced batch size”).
	•	Приёмка: фронт показывает предупреждение в ячейке Competitors.

	18.	Документация

	•	Что делаем: docs/YP-nausys-scan-integration-checklist.md + docs/YP-competitive-boats-search-dataflow.md (обновить разделы).
	•	Приёмка: добавлен пункт про externalId (см. ниже).

F. Правило externalId (зафиксировать)
	19.	Сохранение externalId

	•	Для NAUSYS:
externalId = String(item.yachtId) (из ответа NauSYS).
	•	Для INNERDB: externalId = null.
	•	Для BOATAROUND (если добавим): externalId = id из внешнего источника (если есть).
	•	Приёмка: в таблице competitor_prices при source=NAUSYS externalId заполнен и стабилен.

G. Релизы и проверки
	20.	Поэтапный деплой

	•	Шаг 1 (ГОТОВО): фронт — переключатель и прокидка source.
	•	Шаг 2: backend — ветка feat/nausys-scrape, реализация шагов 3–7; деплой на sandbox.
	•	Шаг 3: интеграционное тестирование на sandbox:
	•	Запуск скана NAUSYS для 1–2 целевых яхт (из Трогира/Сплита) → проверка заполнения competitor_prices, competitor_snapshots.
	•	UI: таблица/карточки показывают результаты.
	•	Шаг 4: фиксация поведения предупреждений и UX-полировки.

⸻

Быстрые коммиты (разбивка)
	1.	feat(backend): route & service branch for NAUSYS in /scrape/start
	2.	feat(backend): runNausysJob — bases → yachts → freeYachts (batched)
	3.	feat(backend): map & upsert competitor_prices (externalId=yachtId)
	4.	feat(backend): aggregateSnapshot by (yachtId, weekStart, source)
	5.	chore(backend): logs & reasons on empty result
	6.	docs: YP-nausys-scan-integration-checklist + externalId rule

⸻
