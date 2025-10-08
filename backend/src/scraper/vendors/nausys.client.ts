// backend/src/scraper/vendors/nausys.client.ts

/* Клиент NauSYS: charterBases → companyIds,
 * yachts(companyId) → yachtIds, freeYachts → цены по периоду.
 */

export type NauSysCreds = { username: string; password: string };

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${url} HTTP ${r.status} ${text.slice(0, 300)}`);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${url} invalid JSON: ${text.slice(0, 300)}`);
  }
}

export async function getCharterBases(creds: NauSysCreds) {
  return postJson<any>(
    'https://ws.nausys.com/CBMS-external/rest/catalogue/v6/charterBases',
    { username: creds.username, password: creds.password },
  );
}

export async function getYachtsByCompany(
  creds: NauSysCreds,
  companyId: number,
) {
  return postJson<any>(
    `https://ws.nausys.com/CBMS-external/rest/catalogue/v6/yachts/${companyId}`,
    { username: creds.username, password: creds.password },
  );
}

export async function getFreeYachts(
  creds: NauSysCreds,
  opts: { periodFrom: string; periodTo: string; yachtIds: number[] },
) {
  return postJson<any>(
    'https://ws.nausys.com/CBMS-external/rest/yachtReservation/v6/freeYachts',
    {
      credentials: { username: creds.username, password: creds.password },
      periodFrom: opts.periodFrom,
      periodTo: opts.periodTo,
      yachts: opts.yachtIds,
    },
  );
}

export function ddmmyyyy(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0'); // ← тут был баг
  const yyyy = d.getUTCFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

/** Получить описание модели яхты (для длины и т.п.) */
export async function getYachtModel(
  creds: NauSysCreds,
  modelId: number,
) {
  return postJson<any>(
    `https://ws.nausys.com/CBMS-external/rest/catalogue/v6/yachtModel/${modelId}`,
    { username: creds.username, password: creds.password },
  );
}
