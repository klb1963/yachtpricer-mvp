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



  