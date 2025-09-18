// frontend/src/pages/CompetitorFiltersPage.tsx

import { useState } from "react";

// Доменные типы
type YachtType = "Sailing" | "Catamaran" | "Motor";

export interface CompetitorFilters {
  lengthMin: number;
  lengthMax: number;
  capacity: number;
  type: YachtType;
  yearMin: number;
  yearMax: number;
  region: string[];     // пока не используется в форме — оставим для расширения
  priceRange: number;   // % от базовой
  rating: number;       // минимум
}

interface Props {
  /** Колбек отправки формы. Если не передан — выведем в консоль. */
  onSubmit?: (filters: CompetitorFilters) => void;
}

/**
 * Страница/форма фильтров для отбора конкуренток
 */
export default function CompetitorFiltersPage({ onSubmit }: Props) {
  const [filters, setFilters] = useState<CompetitorFilters>({
    lengthMin: 35,
    lengthMax: 55,
    capacity: 8,
    type: "Sailing",
    yearMin: 2005,
    yearMax: 2022,
    region: [],
    priceRange: 20,
    rating: 4,
  });

  // Универсальный, типобезопасный сеттер по ключу состояния
  function setField<K extends keyof CompetitorFilters>(field: K, value: CompetitorFilters[K]) {
    setFilters(prev => ({ ...prev, [field]: value }));
  }

  // Утилиты преобразования строки в число/float
  const toInt = (v: string) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : 0;
  };
  const toFloat = (v: string) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };

  function handleSubmit() {
    if (onSubmit) {
      onSubmit(filters);
    } else {
      // поведение по умолчанию, чтобы страница работала автономно
      // eslint-disable-next-line no-console
      console.log("Applied competitor filters:", filters);
    }
  }

  return (
    <form
      className="grid gap-4 p-4 bg-white rounded-xl shadow"
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
    >
      <h2 className="text-xl font-bold">⚓ Настройки отбора конкуренток</h2>

      <div className="flex gap-2">
        <label className="flex flex-col">
          Длина от
          <input
            type="number"
            inputMode="numeric"
            value={filters.lengthMin}
            onChange={(e) => setField("lengthMin", toInt(e.target.value))}
            className="border rounded p-1"
            min={0}
          />
        </label>
        <label className="flex flex-col">
          до
          <input
            type="number"
            inputMode="numeric"
            value={filters.lengthMax}
            onChange={(e) => setField("lengthMax", toInt(e.target.value))}
            className="border rounded p-1"
            min={filters.lengthMin}
          />
        </label>
      </div>

      <label className="flex flex-col">
        Вместимость (пассажиры)
        <input
          type="number"
          inputMode="numeric"
          value={filters.capacity}
          onChange={(e) => setField("capacity", toInt(e.target.value))}
          className="border rounded p-1"
          min={1}
        />
      </label>

      <label className="flex flex-col">
        Тип яхты
        <select
          value={filters.type}
          onChange={(e) => setField("type", e.target.value as YachtType)}
          className="border rounded p-1"
        >
          <option value="Sailing">Sailing yacht</option>
          <option value="Catamaran">Catamaran</option>
          <option value="Motor">Motor yacht</option>
        </select>
      </label>

      <div className="flex gap-2">
        <label className="flex flex-col">
          Год от
          <input
            type="number"
            inputMode="numeric"
            value={filters.yearMin}
            onChange={(e) => setField("yearMin", toInt(e.target.value))}
            className="border rounded p-1"
            min={1970}
            max={filters.yearMax}
          />
        </label>
        <label className="flex flex-col">
          до
          <input
            type="number"
            inputMode="numeric"
            value={filters.yearMax}
            onChange={(e) => setField("yearMax", toInt(e.target.value))}
            className="border rounded p-1"
            min={filters.yearMin}
          />
        </label>
      </div>

      <label className="flex flex-col">
        Диапазон цен (% от базовой)
        <input
          type="number"
          inputMode="numeric"
          value={filters.priceRange}
          onChange={(e) => setField("priceRange", toInt(e.target.value))}
          className="border rounded p-1"
          min={0}
          max={100}
        />
      </label>

      <label className="flex flex-col">
        Рейтинг (минимум)
        <input
          type="number"
          step="0.1"
          inputMode="decimal"
          value={filters.rating}
          onChange={(e) => setField("rating", toFloat(e.target.value))}
          className="border rounded p-1"
          min={0}
          max={5}
        />
      </label>

      <button
        type="submit"
        className="bg-blue-600 text-white rounded p-2 hover:bg-blue-700"
      >
        Применить фильтры
      </button>
    </form>
  );
}