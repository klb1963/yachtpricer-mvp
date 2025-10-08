# reference-план (data flow) для поиска и оценки яхт-конкуренток в NauSYS

0) Конфиг/общие
	•	Auth: username, password (в теле POST).
	•	Базовые справочники кэшируем (в БД/Redis): countries, locations, companies, yachtModels.

⸻

1) География → стартовые точки

A. Countries
	•	URL:https://ws.nausys.com/CBMS-external/rest/catalogue/v6/countries
	•	→ { id, code2, code, name }[]
	•	Кэшируем целиком.

B. Locations
	•	URL:https://ws.nausys.com/CBMS-external/rest/catalogue/v6/locations
	•	→ { id, name, regionId, lat, lon }[]
	•	Сопоставляем через regions → countryId → code2.
	•	Кэш + индексы по countryCode.

C. Charter Bases (опционально)
	•	URL:https://ws.nausys.com/CBMS-external/rest/catalogue/v6/charterBases
	•	→ { id, locationId, lat, lon }[]
	•	Можно использовать как «активные» локации.

D. Regions - Provides all available regions
URL:https://ws.nausys.com/CBMS-external/rest/catalogue/v6/regions

E. Charter company (ies) - Provides all available charter companies
URL:https://ws.nausys.com/CBMS-external/rest/catalogue/v6/charterCompanies

⸻

Требуется уточнить/проверить способы фильтрации/отбора:

Локация → Флот/компании

Companies for location
	•	Варианты:
	1.	Если есть API companies c фильтром по location – используем.
	2.	Если нет — через yachts-by-location (или через companies全→ фильтровать по базам/лоциям).
	•	Результат: companyId[] для выбранной локации(ий).

На практике: чаще идём Location → Yachts и из яхт уже видим companyId. Это надёжнее.

⸻

Компании/Локации → Яхты

A. Яхты компании
	•	POST /catalogue/v6/yachts/{companyId}
	•	→ yacht[] c полями: id, yachtModelId, locationId, buildYear, cabins, wc, др.
	•	Собираем yachtModelId (множество уникальных).

B. Яхты по локации (если эндпойнт есть)
	•	Альтернатива ускоряет фильтрацию по гео.

⸻

2) Параметры яхты: 

A. Category (types)
https://ws.nausys.com/CBMS-external/rest/catalogue/v6/yachtCategories 

B. Builder(s) 
https://ws.nausys.com/CBMS-external/rest/catalogue/v6/yachtBuilders 

C. Model(s)
https://ws.nausys.com/CBMS-external/rest/catalogue/v6/yachtModels 

D. Диапазон отклонений от "яхты-образца", на которой вызывается Scan (scraper)
	Поля настройки (из формы)
	•	length - lenFtMinus/Plus (0..5)
	•	year - yearMinus/Plus (0..5)
	•	people - peopleMinus/Plus (0..5)
	•	cabin(s) - cabinsMinus/Plus (0..3)
	•	head(s)- headsMin (0..5)

⸻

3) Доступность яхт/цены на ВЫБРАННУЮ неделю
Free yachts search
URL: https://ws.nausys.com/CBMS-external/rest/yachtReservation/v6/freeYachtsSearch 
	POST param:
	{
	"credentials": {
	"username":"xxx@xxxx",
	"password":"xxxxxxxxxx"
	},
	"periodFrom":"04.06.2016",
	"periodTo":"11.06.2016",
	"countries":[1],
	"resultsPerPage":5,
	"resultsPage":2
	}

Free yacht
URL: https://ws.nausys.com/CBMS-external/rest/yachtReservation/v6/freeYachts
	POST param:
	{
	"credentials":{"username":"xxx@xxxxx","password":"xxxxxxxxxx"},
	"periodFrom":"23.05.2015",
	"periodTo":"30.05.2015",
	"yachts":[302,557323,101723]
	}

Free yacht search criteria
Provides all search criteria
URL: https://ws.nausys.com/CBMS-external/rest/yachtReservation/v6/freeYachtsSearchCriteria 
	POST param:
	{
	"username":"XXXXXX@XXX",
	"password":"XXXXXXXXXXX"
	}

	Response:
	{"status": "OK",
	"countries": [
	1,
	100143,
	100174,
	100119
	],
	"regions": [
	555430,
	555308,
	555373
	],
	"locations": [
	972887,
	482314,
	482315,
	1
	],
	"yachtBuilders": [
	832736,
	1,
	100330,
	515208,
	112740
	],
	"yachtCategories": [
	102,
	51,
	120895,
	1
	],
	"equipment": [
	1,
	2,
	3,
	933728,
	4
	],
	"sailTypes": [
	1,
	3,
	4,
	112782
	]
	}



⸻

4) Агрегация и метрики
	•	Для списка конкуренток рассчитываем:
	•	Top1 price, Top3 avg, min/median/max.
	•	Sample size.
	•	Сохраняем snapshot (нашу модель competitor_snapshots).
	•	Сырой ответ/метаданные — в rawStats (JSON), чтобы дебажить.

⸻

5) Кэширование и лимиты - требуется уточнить

	?????

⸻

6) Трассировка & аудит
	•	Логируем шаги: какие эндпойнты дернули, сколько вернулось, какие фильтры применили.
	•	Сохраняем параметры запуска (для воспроизводимости).

⸻

7) Типичная последовательность вызовов - НУЖНО ПЕРЕПИСАТЬ ЗАНОВО
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

==========================================

#  Получение данных из NauSYS (версия от 8 октября 2025)

## запрос, который вернул результат:
curl -X POST http://localhost:8000/api/scrape/start \
  -H "Content-Type: application/json" \
  -d '{
    "yachtId": "798ef333-b830-44fe-8d8a-e349aa29816d",
    "weekStart": "2025-10-11",
    "source": "NAUSYS",
    "filterId": null
  }'

{
  "jobId": "267d9843-94c8-4e25-821e-39037756c884",
  "status": "DONE",
  "kept": 81, - 81 запись в таблицу CompetitorPrice
  "reasons": []
}

	1.	POST /api/scrape/start
Передаём на эндпойнт http://localhost:8000/api/scrape/start:
	•	yachtId (лодка-таргет)
	•	weekStart (любая дата недели)
	•	source: "NAUSYS"

  	2.	Сервис Scraper создаёт job и вычисляет чартерную неделю (суббота) + преобразует период к формату NauSYS dd.MM.yyyy:
	•	periodFrom = dd.MM.yyyy(weekStart)
	•	periodTo = dd.MM.yyyy(weekStart + 7d)

	3.	Метод/функция runNausysJob() в сервисе scraper.service.ts :

## Шаг 1 •	charterBases → собираем companyIds
### Что делаем
Отправляем POST на:
	https://ws.nausys.com/CBMS-external/rest/catalogue/v6/charterBases
	body: { username, password }

### Что возвращает NauSYS
Ответ содержит массив баз (charter bases). Для каждой базы, среди прочего, есть:
	•	companyId — ID чартерной компании (оператора флотилии),
	•	locationId — локация/марина этой базы (полезно, если хотим фильтровать по местоположению),
	•	другие поля (название, адрес и т.п.).

### Что извлекаем
Берём уникальные companyId из всех баз:
	•	сейчас — просто все (без фильтра по location).
	•	опционально можно ограничивать по локации (например, «только Trogir / Croatia»): тогда мы заранее строим wantedLocationIds и берём companyId только тех баз, у которых locationId ∈ wantedLocationIds. (Ты уже видел у нас helper для сопоставления алиасов локаций → location.externalId NauSYS — можем включить это в следующей итерации.)

Результат шага: companyIds: number[].

## Шаг 2. собираем yachtIds и метаданные
### Что делаем
Для каждого companyId вызываем в цикле:
POST https://ws.nausys.com/CBMS-external/rest/catalogue/v6/yachts/{companyId}
body: { username, password }

### Что возвращает NauSYS
Список яхт этой компании. Для каждой яхты обычно есть:
	•	id — ID яхты в NauSYS (это наш главный ключ для связи с ценами),
	•	yachtModelId — ID модели (через неё можно достать длину и др. характеристики модели),
	•	buildYear, cabins, wc — год постройки, каюты, санузлы (иногда сразу есть),
	•	locationId — текущая база/марина, где лодка базируется.

(У демо-аккаунтов часть полей может быть пустой — это особенность данных, а не ошибки запроса.)

### Что извлекаем/готовим
	•	Собираем все yachtIds (уникально).
	•	Строим карту метаданных по лодкам, чтобы потом обогатить прайсы:

byYachtId[yachtId] = {
  year: buildYear,
  cabins,
  heads: wc,
  locationId,
  yachtModelId
}

## Шаг 3. Получаем ценовые офферы на период с помощью запроса freeYachts

### Что делаем
Батчами (кусками, порциями), например, по 80 ID, вызываем:
POST https://ws.nausys.com/CBMS-external/rest/yachtReservation/v6/freeYachts
body: {
  credentials: { username, password },
  periodFrom: "dd.MM.yyyy",
  periodTo:   "dd.MM.yyyy",
  yachts: [ ...yachtIdsSlice ]
}

Batch = «пакет», «группа».
Когда у нас есть очень длинный список элементов (например, 2000 яхт), нельзя (и не нужно) слать их все разом в одном запросе — API NauSYS ограничивает объём входных данных (иначе упадёт с ошибкой “Payload too large”).
Поэтому мы делим весь список на порции, например, по 80 элементов.
Каждая порция = один батч, и для каждого батча мы делаем отдельный запрос.
API NauSYS возвращает 3 JSON-а, мы их объединяем (push(...arr)).

⚙️ Почему именно 80?
Это эмпирически безопасное значение для NauSYS:
	•	достаточно большое, чтобы не слать тысячи микрозапросов;
	•	достаточно маленькое, чтобы гарантированно не превысить лимит размера запроса или таймаут.
Если на практике увидим «400 Bad Request» или «413 Request Entity Too Large» — уменьшим до 50, например.

### Что возвращает NauSYS
Массив объектов свободных яхт на заданный период. Обычно там есть:
	•	yachtId — ID той самой лодки,
	•	price.clientPrice — итоговая цена,
	•	price.priceListPrice — прайс-лист (можно посчитать скидку),
	•	price.currency,
	•	price.discounts[] — отдельные скидки (процент/сумма),
	•	feesTotal — иногда сборы,
	•	locationFromId — марина отправления (может помочь для поля marina).

Результат шага: массив freeItems.

## Шаг 4. Сохранение в competitor_prices (с обогащением)
Для каждого freeItem:
	•	ключи уникальности: (source=NAUSYS, weekStart, link)
где link = "nausys://freeYacht?id=YID&from=DD.MM.YYYY&to=DD.MM.YYYY"
	•	пишем в цикле в таблицу БД:
		•	yachtId = наша таргет-лодка (чтобы «привязать» конкурентов),
		•	externalId = NauSYS yachtId (чтобы потом было чем связывать),
		•	price, currency,
		•	discountPct (берём max из discounts или считаем (priceList - final)/priceList * 100),
		•	raw (весь ответ freeYachts — полезно для отладки),
		•	обогащение метой с шага (2):
		•	year, cabins, heads,
		•	lengthFt — либо из модели, либо если модель пустая, оставляем null (позже дотянем),
		•	marina — по locationFromId или по базе лодки,
		•	scrapedAt, scrapeJobId.

## Шаг 5. Снимок competitor_snapshots
После сохранения цен в БД:
	•	выбираем все competitor_prices за неделю/источник/лодку,
	•	считаем top1 и top3Avg,
	•	апсертом пишем competitor_snapshots (sampleSize, currency, rawStats и т.д.).

