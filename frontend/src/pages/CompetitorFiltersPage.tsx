// /frontend/src/pages/CompetitorFiltersPage.tsx
import { useState, useEffect, useRef } from "react";
import { getCountries, getLocations, Country, LocationItem } from "../api";
import type { YachtType } from "../types/yacht";

/** Lightweight i18n (can be swapped to react-i18next later) */
const messages = {
  en: {
    title: "⚓ Competitor filters",
    country: "Country",
    countryPlaceholder: "— select a country —",
    location: "Location",
    locationPlaceholder: "— select a location —",
    loading: "Loading…",
    length: "Length (ft)",
    from: "From",
    to: "To",
    capacity: "Capacity (pax)",
    type: "Type",
    yearFrom: "Year from",
    yearTo: "Year to",
    cancel: "Cancel",
    apply: "Apply filters",
  },
  // Example: extend later
  // ru: { ... }
};
type LocaleKey = keyof typeof messages;
const locale: LocaleKey = "en";
const t = (key: keyof typeof messages.en) => messages[locale][key] ?? key;

export interface CompetitorFilters {
  lengthMin: number;
  lengthMax: number;
  capacity: number;
  type: YachtType;
  yearMin: number;
  yearMax: number;
  region: string[];        // reserved for future use
  priceRange: number;      // reserved for future use
  rating: number;          // reserved for future use
  countryCode?: string;
  locationId?: string;
}

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

  // prevent race conditions when rapidly switching countries
  const locLoadToken = useRef(0);

  // load countries once
  useEffect(() => {
    getCountries()
      .then(setCountries)
      .catch((e) => console.error("Failed to load countries:", e));
  }, []);

  // on country change -> reset selected location and fetch list
  useEffect(() => {
    setFilters((prev) => ({ ...prev, locationId: undefined }));

    const code = filters.countryCode?.trim();
    if (!code) {
      setLocations([]);
      setLocLoading(false);
      return;
    }

    setLocLoading(true);
    const myToken = ++locLoadToken.current;

    getLocations({ countryCode: code, take: 500, orderBy: "name" })
      .then((r) => {
        if (myToken === locLoadToken.current) {
          setLocations(r.items);
        }
      })
      .catch((e) => console.error("Failed to load locations:", e))
      .finally(() => {
        if (myToken === locLoadToken.current) setLocLoading(false);
      });
  }, [filters.countryCode]);

  // typed field setter
  function setField<K extends keyof CompetitorFilters>(
    field: K,
    value: CompetitorFilters[K]
  ) {
    setFilters((prev) => ({ ...prev, [field]: value }));
  }

  // parse helpers
  const toInt = (v: string) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : 0;
  };
  const toFloat = (v: string) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };

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
      <h2 className="text-xl font-bold mb-2">{t("title")}</h2>

      {/* Country */}
      <label className="flex flex-col">
        {t("country")}
        <select
          value={filters.countryCode || ""}
          onChange={(e) => setField("countryCode", e.target.value || undefined)}
          className="border rounded p-1"
        >
          <option value="">{t("countryPlaceholder")}</option>
          {countries.map((c) => (
            <option key={c.code2} value={c.code2}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      {/* Location */}
      <label className="flex flex-col">
        {t("location")}
        <select
          value={filters.locationId || ""}
          onChange={(e) => setField("locationId", e.target.value || undefined)}
          className="border rounded p-1"
          disabled={!filters.countryCode || locLoading}
        >
          <option value="">
            {locLoading ? t("loading") : t("locationPlaceholder")}
          </option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
              {l.countryCode ? ` (${l.countryCode})` : ""}
            </option>
          ))}
        </select>
      </label>

      {/* Length */}
      <div className="flex gap-2">
        <label className="flex flex-col flex-1">
          {t("from")} — {t("length")}
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
          {t("to")} — {t("length")}
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

      {/* Capacity */}
      <label className="flex flex-col">
        {t("capacity")}
        <input
          type="number"
          inputMode="numeric"
          value={filters.capacity}
          onChange={(e) => setField("capacity", toInt(e.target.value))}
          className="border rounded p-1"
          min={1}
        />
      </label>

      {/* Type */}
      <label className="flex flex-col">
        {t("type")}
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

      {/* Year */}
      <div className="flex gap-2">
        <label className="flex flex-col flex-1">
          {t("yearFrom")}
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
          {t("yearTo")}
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

      {/* Actions */}
      <div className="mt-4 flex justify-end gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded bg-gray-300 px-4 py-2 text-black hover:bg-gray-400"
          >
            {t("cancel")}
          </button>
        )}
        <button
          type="submit"
          className="bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700"
        >
          {t("apply")}
        </button>
      </div>
    </form>
  );
}