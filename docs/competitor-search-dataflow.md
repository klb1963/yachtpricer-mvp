# reference-план (data flow) для поиска и оценки яхт-конкуренток в NauSYS

0) Конфиг/общие
	•	Auth: username, password (в теле POST).
	•	Базовые справочники кэшируем (в БД/Redis): countries, locations, companies, yachtModels.

⸻

1) География → стартовые точки

A. Countries
	•	POST /catalogue/v6/countries
	•	→ { id, code2, code, name }[]
	•	Кэшируем целиком.

B. Locations
	•	POST /catalogue/v6/locations
	•	→ { id, name, regionId, lat, lon }[]
	•	Сопоставляем через regions → countryId → code2.
	•	Кэш + индексы по countryCode.

C. Charter Bases (опционально)
	•	POST /catalogue/v6/charterBases
	•	→ { id, locationId, lat, lon }[]
	•	Можно использовать как «активные» локации.

⸻

2) Локация → Флот/компании

Companies for location
	•	Варианты:
	1.	Если есть API companies c фильтром по location – используем.
	2.	Если нет — через yachts-by-location (или через companies全→ фильтровать по базам/лоциям).
	•	Результат: companyId[] для выбранной локации(ий).

На практике: чаще идём Location → Yachts и из яхт уже видим companyId. Это надёжнее.

⸻

3) Компании/Локации → Яхты

A. Яхты компании
	•	POST /catalogue/v6/yachts/{companyId}
	•	→ yacht[] c полями: id, yachtModelId, locationId, buildYear, cabins, wc, др.
	•	Собираем yachtModelId (множество уникальных).

B. Яхты по локации (если эндпойнт есть)
	•	Альтернатива ускоряет фильтрацию по гео.

⸻

4) Модели → Габариты/тип

Yacht Models
	•	POST /catalogue/v6/yachtModels
	•	Request: по списку yachtModelIds.
	•	→ { id, name, loa, beam, yachtType?, … }[]
	•	Кэшируем (редко меняются).
	•	Используем loa (длина) + type (heurstics для monohull/catamaran и т.д.).

Фильтрация «подопытного кролика»
	•	По длине: | model.loa - targetLoa | ≤ lenTolerance.
	•	По типу: совпадает с типом исходной яхты (monohull и пр.).
	•	Доп. фильтры: year ±, cabins ±, people ±, heads ≥.

⸻

5) Доступность/цены на неделю

Availability/Prices
	•	Эндпойнты по датам (weekStart/weekEnd), локации/компании/яхте:
	•	Часто: availability/offers/prices (конкретный метод см. в API v6).
	•	В ответе:
	•	Базовая цена за период (WEEKLY), валюта.
	•	Скидки: regularDiscounts, specialOffers.
	•	Условия оплаты/депозиты.
	•	Нормализуем финальную цену по правилам (если нужно — брутто/нетто).

⸻

6) Агрегация и метрики
	•	Для списка конкуренток рассчитываем:
	•	Top1 price, Top3 avg, min/median/max.
	•	Sample size.
	•	Сохраняем snapshot (нашу модель competitor_snapshots).
	•	Сырой ответ/метаданные — в rawStats (JSON), чтобы дебажить.

⸻

7) Кэширование и лимиты
	•	Кэш на:
	•	Countries, Locations, Models (долгий TTL).
	•	Companies-by-location (средний TTL).
	•	Availability (короткий TTL / без кэша, т.к. динамика высокая).
	•	Бектов/ретраи: экспоненциальная пауза, троттлинг.

⸻

8) Поля настройки (из формы)
	•	lenFtMinus/Plus (0..5)
	•	yearMinus/Plus (0..5)
	•	peopleMinus/Plus (0..5)
	•	cabinsMinus/Plus (0..3)
	•	headsMin (0..5)
	•	countryCode?, locationId?
	•	Тип яхты берём от исходной яхты (фиксируем).

⸻

9) Трассировка & аудит
	•	Логируем шаги: какие эндпойнты дернули, сколько вернулось, какие фильтры применили.
	•	Сохраняем параметры запуска (для воспроизводимости).

⸻

10) Типичная последовательность вызовов
	1.	(кэш) countries, locations → выбор гео.
	2.	yachts by location или yachts by company.
	3.	Собираем yachtModelIds → yachtModels.
	4.	Фильтруем по длине/типу/параметрам ±.
	5.	На выборку → availability/prices для weekStart..weekEnd.
	6.	Считаем метрики → сохраняем snapshot.


___________________
# шаг 1: bases -> companies -> yachts (фильтр по нашим локациям)
docker compose exec \
  -e NAUSYS_USERNAME='rest388@TTTTT' \
  -e NAUSYS_PASSWORD='e2THubBC' \
  backend npx ts-node prisma/seed/scanCompetitors.step1.ts

  