// frontend/src/pages/CompetitorFiltersPage.tsx

import { useState } from "react";

export default function CompetitorYachtFilterForm({ onSubmit }) {
  const [filters, setFilters] = useState({
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

  const handleChange = (field, value) =>
    setFilters({ ...filters, [field]: value });

  return (
    <form
      className="grid gap-4 p-4 bg-white rounded-xl shadow"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(filters);
      }}
    >
      <h2 className="text-xl font-bold">⚓ Настройки отбора конкуренток</h2>

      <div className="flex gap-2">
        <label className="flex flex-col">
          Длина от
          <input
            type="number"
            value={filters.lengthMin}
            onChange={(e) => handleChange("lengthMin", e.target.value)}
            className="border rounded p-1"
          />
        </label>
        <label className="flex flex-col">
          до
          <input
            type="number"
            value={filters.lengthMax}
            onChange={(e) => handleChange("lengthMax", e.target.value)}
            className="border rounded p-1"
          />
        </label>
      </div>

      <label className="flex flex-col">
        Вместимость (пассажиры)
        <input
          type="number"
          value={filters.capacity}
          onChange={(e) => handleChange("capacity", e.target.value)}
          className="border rounded p-1"
        />
      </label>

      <label className="flex flex-col">
        Тип яхты
        <select
          value={filters.type}
          onChange={(e) => handleChange("type", e.target.value)}
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
            value={filters.yearMin}
            onChange={(e) => handleChange("yearMin", e.target.value)}
            className="border rounded p-1"
          />
        </label>
        <label className="flex flex-col">
          до
          <input
            type="number"
            value={filters.yearMax}
            onChange={(e) => handleChange("yearMax", e.target.value)}
            className="border rounded p-1"
          />
        </label>
      </div>

      <label className="flex flex-col">
        Диапазон цен (% от базовой)
        <input
          type="number"
          value={filters.priceRange}
          onChange={(e) => handleChange("priceRange", e.target.value)}
          className="border rounded p-1"
        />
      </label>

      <label className="flex flex-col">
        Рейтинг (минимум)
        <input
          type="number"
          step="0.1"
          value={filters.rating}
          onChange={(e) => handleChange("rating", e.target.value)}
          className="border rounded p-1"
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