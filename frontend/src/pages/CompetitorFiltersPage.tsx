import { useEffect, useRef, useState } from "react";
import Select, { MultiValue, SingleValue } from "react-select";
import { getCountries, getLocations, Country, LocationItem } from "../api";
import type { YachtType } from "../types/yacht";

export interface CompetitorFilters {
  lengthMin: number;
  lengthMax: number;
  capacity: number;
  type: YachtType;
  yearMin: number;
  yearMax: number;
  region: string[];          // reserved for future
  priceRange: number;        // %
  rating: number;            // min
  countryCodes?: string[];   // ← MULTI countries
  locationId?: string;       // only when exactly one country selected
}

type Option = { value: string; label: string };

interface Props {
  onSubmit?: (filters: CompetitorFilters) => void;
  onCancel?: () => void;
}

export default function CompetitorFiltersPage({ onSubmit, onCancel }: Props) {
  const [filters, setFilters] = useState<CompetitorFilters>({
    lengthMin: 35,
    lengthMax: 55,
    capacity: 8,
    type: "monohull",
    yearMin: 2005,
    yearMax: 2022,
    region: [],
    priceRange: 20,
    rating: 4,
  });

  const [countries, setCountries] = useState<Country[]>([]);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [locLoading, setLocLoading] = useState(false);
  const locLoadToken = useRef(0);

  // load countries once
  useEffect(() => {
    getCountries()
      .then(setCountries)
      .catch((e) => console.error("Failed to load countries:", e));
  }, []);

  // when countries changed:
  // - reset location
  // - if exactly one country selected -> load its locations
  useEffect(() => {
    setFilters((prev) => ({ ...prev, locationId: undefined }));

    const codes = filters.countryCodes ?? [];
    if (codes.length !== 1) {
      setLocations([]);
      setLocLoading(false);
      return;
    }

    const code = codes[0];
    setLocLoading(true);
    const token = ++locLoadToken.current;

    getLocations({ countryCode: code, take: 500, orderBy: "name" })
      .then((r) => {
        if (token === locLoadToken.current) setLocations(r.items);
      })
      .catch((e) => console.error("Failed to load locations:", e))
      .finally(() => {
        if (token === locLoadToken.current) setLocLoading(false);
      });
  }, [filters.countryCodes]);

  // generic setter
  function setField<K extends keyof CompetitorFilters>(field: K, value: CompetitorFilters[K]) {
    setFilters((prev) => ({ ...prev, [field]: value }));
  }

  // utils
  const toInt = (v: string) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : 0;
  };
  const toFloat = (v: string) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };

  // react-select helpers
  const countryOptions: Option[] = countries.map((c) => ({ value: c.code2, label: c.name }));
  const selectedCountryOptions: Option[] =
    (filters.countryCodes ?? []).map((code) => ({
      value: code,
      label: countries.find((c) => c.code2 === code)?.name ?? code,
    }));

  function handleSubmit() {
    if (onSubmit) onSubmit(filters);
    else console.log("Applied competitor filters:", filters);
  }

  return (
    <form
      className="grid gap-4 p-4 bg-white rounded-xl shadow max-w-lg"
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
    >
      <h2 className="text-xl font-bold mb-2">⚓ Competitor filters</h2>

      {/* Countries (multi) */}
      <div className="flex flex-col gap-1">
        <label className="font-medium">Country</label>
        <Select
          isMulti
          options={countryOptions}
          value={selectedCountryOptions}
          onChange={(vals: MultiValue<Option>) =>
            setField(
              "countryCodes",
              vals.map((v) => v.value)
            )
          }
          placeholder="— select countries —"
        />
        <small className="text-gray-500">
          You can pick multiple countries. Location is available when exactly one country is selected.
        </small>
      </div>

      {/* Location (only when exactly one country picked) */}
      {(filters.countryCodes?.length ?? 0) === 1 && (
        <label className="flex flex-col">
          <span className="font-medium">Location</span>
          <select
            value={filters.locationId || ""}
            onChange={(e) => setField("locationId", e.target.value || undefined)}
            className="border rounded p-1"
            disabled={locLoading}
          >
            <option value="">{locLoading ? "Loading…" : "— select location —"}</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {/* Other filters */}
      <div className="flex gap-2">
        <label className="flex flex-col flex-1">
          Length from
          <input
            type="number"
            inputMode="numeric"
            value={filters.lengthMin}
            onChange={(e) => setField("lengthMin", toInt(e.target.value))}
            className="border rounded p-1"
            min={0}
          />
        </label>
        <label className="flex flex-col flex-1">
          to
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
        Capacity (passengers)
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
        Yacht type
        <select
          value={filters.type}
          onChange={(e) => setField("type", e.target.value as YachtType)}
          className="border rounded p-1"
        >
          <option value="monohull">Monohull</option>
          <option value="catamaran">Catamaran</option>
          <option value="trimaran">Trimaran</option>
          <option value="compromis">Compromis</option>
        </select>
      </label>

      <div className="flex gap-2">
        <label className="flex flex-col flex-1">
          Year from
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
        <label className="flex flex-col flex-1">
          to
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

      <div className="mt-4 flex justify-end gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded bg-gray-300 px-4 py-2 text-black hover:bg-gray-400"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700"
        >
          Apply filters
        </button>
      </div>
    </form>
  );
}