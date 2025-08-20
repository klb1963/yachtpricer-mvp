// frontend/src/utils/date.ts

/** Вернёт ISO-дату субботы (YYYY-MM-DD) для заданной недели */
export function weekIso(d = new Date()) {
    const dd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const day = dd.getUTCDay(); // 0..6 (вс..сб)
    const diff = (day - 6 + 7) % 7;
    dd.setUTCDate(dd.getUTCDate() - diff);
    dd.setUTCHours(0,0,0,0);
    return dd.toISOString().slice(0,10);
  }