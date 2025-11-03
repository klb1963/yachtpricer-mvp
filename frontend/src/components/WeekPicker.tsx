// frontend/src/components/WeekPicker.tsx

import React from 'react';

type Props = {
  /** Дата недели (суббота) в формате YYYY-MM-DD (UTC) */
  value: string;
  onChange: (nextIso: string) => void;
  className?: string;
  /** Подписи кнопок — можно переопределить при желании */
  prevLabel?: string;
  nextLabel?: string;
};

/** Сервисные: сдвиг на ±N дней в UTC и формат YYYY-MM-DD */
function shiftIsoDays(iso: string, days: number): string {
  // Привязываем к полуночи UTC, чтобы избежать TZ-эффектов браузера
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function WeekPicker({
  value,
  onChange,
  className,
  prevLabel = '◀',
  nextLabel = '▶',
}: Props) {
  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      <button
        type="button"
        className="rounded border px-3 py-1 hover:bg-gray-50"
        onClick={() => onChange(shiftIsoDays(value, -7))}
        aria-label="Previous week"
      >
        {prevLabel}
      </button>

      <input
        type="date"
        className="rounded border px-3 py-1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />

      <button
        type="button"
        className="rounded border px-3 py-1 hover:bg-gray-50"
        onClick={() => onChange(shiftIsoDays(value, +7))}
        aria-label="Next week"
      >
        {nextLabel}
      </button>
    </div>
  );
}