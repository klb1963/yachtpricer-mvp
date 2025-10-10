// backend/src/scraper/vendors/nausys.client.ts

/* ===========================================================
 * NauSYS Client — низкоуровневые вызовы REST API NauSYS
 * Используется в nausys.runner.ts для загрузки данных о:
 *   1. Базах и компаниях (charterBases)
 *   2. Яхтах компаний (yachts/{companyId})
 *   3. Ценах и доступности (freeYachts / freeYachtsSearch)
 *   4. Моделях яхт (yachtModel/{id})
 * =========================================================== */

/** Учетные данные NauSYS API */
export type NauSysCreds = { username: string; password: string };

/* ---------------------------------------------------------------------
 * Типы данных, которые реально используются в коде (минимальные версии).
 * Мы не описываем весь ответ NauSYS, а только нужные поля.
 * ------------------------------------------------------------------- */

/** База (charter base) — принадлежит компании, имеет ID и локацию */
export type NauSysCharterBase = {
  id?: number;
  name?: string;
  companyId: number;
  locationId?: number | null;
};

/** Яхта компании (из /catalogue/v6/yachts/{companyId}) */
export type NauSysYacht = {
  id: number; // основной идентификатор лодки в NauSYS
  yachtModelId?: number | null; // модель, чтобы потом запросить длину/параметры
  buildYear?: number | null;
  cabins?: number | null;
  wc?: number | null; // heads
  locationId?: number | null; // базовая локация (марина)
};

/** Элемент из ответа freeYachts / freeYachtsSearch */
export type NauSysFreeYachtItem = {
  yachtId: number;

  // Иногда NauSYS возвращает вложенный объект `yacht`, иногда — "плоско"
  yacht?: {
    name?: string | null;
    modelName?: string | null;
    buildYear?: number | null;
    cabins?: number | null;
    heads?: number | null;
    wc?: number | null;
    length?: number | null; // длина в метрах
  } | null;

  // Альтернативные варианты полей, в зависимости от структуры JSON
  buildYear?: number | null;
  yachtBuildYear?: number | null;
  cabins?: number | null;
  yachtCabins?: number | null;
  heads?: number | null;
  yachtHeads?: number | null;
  length?: number | null; // длина (метры)
  yachtLengthMeters?: number | null;
  yachtModelName?: string | null;
  modelName?: string | null;

  // Цена и скидки
  price?: {
    clientPrice?: number | null; // финальная цена для клиента
    priceListPrice?: number | null;
    currency?: string | null;
    discounts?: Array<{ type?: string | null; value?: number | null }>;
  };

  feesTotal?: number | null;
  locationFromId?: number | null; // ID локации отправления
};

/** Модель яхты (используется, чтобы дотянуть длину) */
export type NauSysYachtModel = {
  id: number;
  name?: string | null;
  length?: number | null; // метры
  lengthFt?: number | null; // футы
};

/* ===========================================================
 * Вспомогательная функция POST-запроса с JSON
 * Универсальный метод для всех NauSYS endpoints.
 * =========================================================== */
async function postJson<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  // Считываем текст, чтобы при ошибке отдать часть тела ответа
  const text = await r.text();
  if (!r.ok) throw new Error(`${url} HTTP ${r.status} ${text.slice(0, 300)}`);

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${url} invalid JSON: ${text.slice(0, 300)}`);
  }
}

/* ===========================================================
 * 1️⃣ Получение списка чартерных баз (charterBases)
 *    - Используется для извлечения companyId (владельцев)
 * =========================================================== */
export async function getCharterBases(creds: NauSysCreds) {
  return postJson<NauSysCharterBase[]>(
    'https://ws.nausys.com/CBMS-external/rest/catalogue/v6/charterBases',
    { username: creds.username, password: creds.password },
  );
}

/* ===========================================================
 * 2️⃣ Получение яхт конкретной компании
 *    - Возвращает массив объектов с метаданными яхт
 * =========================================================== */
export async function getYachtsByCompany(
  creds: NauSysCreds,
  companyId: number,
) {
  return postJson<NauSysYacht[]>(
    `https://ws.nausys.com/CBMS-external/rest/catalogue/v6/yachts/${companyId}`,
    { username: creds.username, password: creds.password },
  );
}

/* ===========================================================
 * 3️⃣ Получение доступных яхт за период
 *    (старый endpoint /freeYachts — работает по yachtIds)
 * =========================================================== */
export async function getFreeYachts(
  creds: NauSysCreds,
  opts: { periodFrom: string; periodTo: string; yachtIds: number[] },
) {
  return postJson<NauSysFreeYachtItem[]>(
    'https://ws.nausys.com/CBMS-external/rest/yachtReservation/v6/freeYachts',
    {
      credentials: { username: creds.username, password: creds.password },
      periodFrom: opts.periodFrom,
      periodTo: opts.periodTo,
      yachts: opts.yachtIds,
    },
  );
}

/* ===========================================================
 * 4️⃣ Новый endpoint — /freeYachtsSearch
 *    (наша цель на этот спринт — использовать его вместо freeYachts)
 * =========================================================== */
export async function getFreeYachtsSearch(
  creds: NauSysCreds,
  opts: {
    periodFrom: string;
    periodTo: string;
    countries?: number[];
    resultsPerPage?: number;
    resultsPage?: number;
  },
) {
  return postJson<NauSysFreeYachtItem[]>(
    'https://ws.nausys.com/CBMS-external/rest/yachtReservation/v6/freeYachtsSearch',
    {
      credentials: { username: creds.username, password: creds.password },
      periodFrom: opts.periodFrom,
      periodTo: opts.periodTo,
      countries: opts.countries ?? [],
      resultsPerPage: opts.resultsPerPage ?? 100,
      resultsPage: opts.resultsPage ?? 1,
    },
  );
}

/* ===========================================================
 * Утилита форматирования даты для NauSYS (DD.MM.YYYY)
 * =========================================================== */
export function ddmmyyyy(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0'); // фикс бага (месяц с 0)
  const yyyy = d.getUTCFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

/* ===========================================================
 * 5️⃣ Получение описания модели яхты
 *    Используется для вытягивания длины в метрах (loa)
 * =========================================================== */
export async function getYachtModel(creds: NauSysCreds, modelId: number) {
  return postJson<NauSysYachtModel>(
    `https://ws.nausys.com/CBMS-external/rest/catalogue/v6/yachtModel/${modelId}`,
    { username: creds.username, password: creds.password },
  );
}
