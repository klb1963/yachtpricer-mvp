// frontend/src/utils/week.ts

/** Округляем дату к субботе (UTC, 00:00) */
export function toSaturdayUTC(date: Date) {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const diff = (d.getUTCDay() - 6 + 7) % 7;
    d.setUTCDate(d.getUTCDate() - diff);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }
  
  /** Форматирование даты в YYYY-MM-DD (UTC) */
  export function toYMD(d: Date) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  
  /** ISO строка */
  export function fmtISO(d: Date) {
    return d.toISOString();
  }
  
  /** Следующая суббота (UTC) */
  export function nextSaturday(d: Date) {
    const s = toSaturdayUTC(d);
    s.setUTCDate(s.getUTCDate() + 7);
    return s;
  }
  
  /** Предыдущая суббота (UTC) */
  export function prevSaturday(d: Date) {
    const s = toSaturdayUTC(d);
    s.setUTCDate(s.getUTCDate() - 7);
    return s;
  }
  
  /** Сдвинуть дату на days дней (UTC) */
  export function addDaysUTC(d: Date, days: number) {
    const x = new Date(d);
    x.setUTCDate(x.getUTCDate() + days);
    return x;
  }