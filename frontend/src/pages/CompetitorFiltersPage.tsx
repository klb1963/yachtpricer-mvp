// frontend/src/pages/CompetitorFiltersPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import Select from "react-select";
import {
  getCountries,
  getLocations,
  saveCompetitorFilters,
  getCompetitorFilters,
  type Country,
  type LocationItem,
} from "../api";

// --- i18n-ready labels ---
const t = {
  title: "Competitor filters",
  countries: "Countries",
  locations: "Locations",
  headsMin: "Heads (min)",
  length: "Length ± (ft)",
  year: "Year ±",
  people: "People ±",
  cabins: "Cabins ±",
  applySave: "Apply & Save",
  loading: "Loading…",
  chooseCountries: "— choose countries —",
  chooseLocations: "— choose locations —",
};

type Scope = "USER" | "ORG";

type SaveDto = {
  scope: Scope;
  locationIds?: string[];
  countryCodes?: string[];
  lenFtMinus: number;
  lenFtPlus: number;
  yearMinus: number;
  yearPlus: number;
  peopleMinus: number;
  peoplePlus: number;
  cabinsMinus: number;
  cabinsPlus: number;
  headsMin: number;
};

type CountryOpt = { value: string; label: string };
type LocationOpt = { value: string; label: string; countryCode?: string };

type Option = { value: string; label: string };
const toLocOption = (l: { id: string; name: string; countryCode?: string | null }): Option => ({
  value: l.id,
  label: l.countryCode ? `${l.name} (${l.countryCode})` : l.name,
});

interface Props {
  scope?: Scope;
  onSubmit?: (dto: SaveDto) => void;
  onClose?: () => void;
}

export default function CompetitorFiltersPage({ scope = "USER", onSubmit, onClose }: Props) {
  // --- form state ---
  const [lenFtMinus, setLenFtMinus] = useState(3);
  const [lenFtPlus, setLenFtPlus] = useState(3);
  const [yearMinus, setYearMinus] = useState(2);
  const [yearPlus, setYearPlus] = useState(2);
  const [peopleMinus, setPeopleMinus] = useState(1);
  const [peoplePlus, setPeoplePlus] = useState(1);
  const [cabinsMinus, setCabinsMinus] = useState(1);
  const [cabinsPlus, setCabinsPlus] = useState(1);
  const [headsMin, setHeadsMin] = useState(1);

  // countries / locations
  const [countries, setCountries] = useState<CountryOpt[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<CountryOpt[]>([]);
  const [locations, setLocations] = useState<LocationOpt[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<LocationOpt[]>([]);
  const [locLoading, setLocLoading] = useState(false);

  const loadToken = useRef(0);

  // load countries once
  useEffect(() => {
    let active = true;
    getCountries()
      .then((list: Country[]) => {
        if (!active) return;
        const opts = list
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((c) => ({ value: c.code2, label: c.name }));
        setCountries(opts);
      })
      .catch((e) => console.error("Failed to load countries:", e));
    return () => { active = false; };
  }, []);

  // when countries change → reload locations union
  useEffect(() => {
    const codes = selectedCountries.map((c) => c.value.toUpperCase());
    if (codes.length === 0) {
      setLocations([]);
      setSelectedLocations([]);
      setLocLoading(false);
      return;
    }

    const myToken = ++loadToken.current;
    setLocLoading(true);

    Promise.all(
      codes.map((code) =>
        getLocations({ countryCode: code, take: 500, orderBy: "name" }).then((r) =>
          r.items.map((l: LocationItem) => ({
            value: l.id,
            label: l.name,
            countryCode: l.countryCode,
          }))
        )
      )
    )
      .then((arrs) => {
        if (myToken !== loadToken.current) return;
        const merged: Record<string, LocationOpt> = {};
        arrs.flat().forEach((opt) => { merged[opt.value] = merged[opt.value] || opt; });
        const list = Object.values(merged).sort((a, b) => a.label.localeCompare(b.label));
        setLocations(list);
        setSelectedLocations((prev) => prev.filter((p) => merged[p.value]));
      })
      .catch((e) => console.error("Failed to load locations:", e))
      .finally(() => {
        if (myToken === loadToken.current) setLocLoading(false);
      });
  }, [selectedCountries]);

  // helpers
  const toInt = (v: string, def = 0) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : def;
  };

  // build DTO
  const dto: SaveDto = useMemo(
    () => ({
      scope,
      countryCodes: selectedCountries.map((c) => c.value),
      locationIds: selectedLocations.map((l) => l.value),
      lenFtMinus,
      lenFtPlus,
      yearMinus,
      yearPlus,
      peopleMinus,
      peoplePlus,
      cabinsMinus,
      cabinsPlus,
      headsMin,
    }),
    [
      scope,
      selectedCountries,
      selectedLocations,
      lenFtMinus,
      lenFtPlus,
      yearMinus,
      yearPlus,
      peopleMinus,
      peoplePlus,
      cabinsMinus,
      cabinsPlus,
      headsMin,
    ]
  );

  async function handleApplySave() {
    try {
      onSubmit?.(dto);
      await saveCompetitorFilters(dto);
      alert("Filters applied and saved.");
      onClose?.();
    } catch (e) {
      console.error("Apply & Save failed:", e);
      alert("Failed to save filters.");
    }
  }

  // ===== Загрузка пресета при МОНТИРОВАНИИ компонента =====
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const preset = await getCompetitorFilters(); // может вернуть null
        if (cancelled || !preset) return;

        setLenFtMinus(preset.lenFtMinus ?? 3);
        setLenFtPlus(preset.lenFtPlus ?? 3);
        setYearMinus(preset.yearMinus ?? 2);
        setYearPlus(preset.yearPlus ?? 2);
        setPeopleMinus(preset.peopleMinus ?? 1);
        setPeoplePlus(preset.peoplePlus ?? 1);
        setCabinsMinus(preset.cabinsMinus ?? 1);
        setCabinsPlus(preset.cabinsPlus ?? 1);
        setHeadsMin(preset.headsMin ?? 1);

        const locOpts: Option[] = (preset.locations ?? []).map(toLocOption);
        setSelectedLocations(locOpts);

        const codes = Array.from(
          new Set((preset.locations ?? []).map((l) => l.countryCode).filter(Boolean))
        ) as string[];
        const countryOpts: Option[] = codes.map((c) => ({ value: c, label: c }));
        setSelectedCountries(countryOpts as CountryOpt[]);
      } catch (e) {
        console.warn("[CompetitorFilters] failed to load preset:", e);
      }
    })();
    return () => { cancelled = true; };
  }, [scope]);

  return (
    <form
      className="grid gap-4 p-4 bg-white rounded-xl shadow max-w-xl"
      onSubmit={(e) => { e.preventDefault(); handleApplySave(); }}
    >
      <h2 className="text-xl font-bold">{t.title}</h2>

      {/* Countries (multi) */}
      <label className="flex flex-col gap-1">
        <span>{t.countries}</span>
        <Select<CountryOpt, true>
          isMulti
          options={countries}
          value={selectedCountries}
          onChange={(vals) => setSelectedCountries(vals as CountryOpt[])}
          placeholder={t.chooseCountries}
          classNamePrefix="rs"
        />
      </label>

      {/* Locations (multi) */}
      <label className="flex flex-col gap-1">
        <span>{t.locations}</span>
        <Select<LocationOpt, true>
          isMulti
          isDisabled={selectedCountries.length === 0 || locLoading}
          options={locations}
          value={selectedLocations}
          onChange={(vals) => setSelectedLocations(vals as LocationOpt[])}
          placeholder={locLoading ? t.loading : t.chooseLocations}
          classNamePrefix="rs"
        />
      </label>

      {/* Ranges */}
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col">
          <span>{t.length}</span>
          <div className="flex items-center gap-2">
            <button type="button" className="border rounded px-2" onClick={() => setLenFtMinus((v) => Math.max(0, v - 1))}>−</button>
            <input type="number" inputMode="numeric" className="border rounded p-1 w-20 text-center"
              value={lenFtMinus} min={0} max={5}
              onChange={(e) => setLenFtMinus(Math.min(5, Math.max(0, toInt(e.target.value, lenFtMinus))))}/>
            <button type="button" className="border rounded px-2" onClick={() => setLenFtMinus((v) => Math.min(5, v + 1))}>+</button>
            <span className="opacity-60">/</span>
            <button type="button" className="border rounded px-2" onClick={() => setLenFtPlus((v) => Math.max(0, v - 1))}>−</button>
            <input type="number" inputMode="numeric" className="border rounded p-1 w-20 text-center"
              value={lenFtPlus} min={0} max={5}
              onChange={(e) => setLenFtPlus(Math.min(5, Math.max(0, toInt(e.target.value, lenFtPlus))))}/>
            <button type="button" className="border rounded px-2" onClick={() => setLenFtPlus((v) => Math.min(5, v + 1))}>+</button>
          </div>
        </label>

        <label className="flex flex-col">
          <span>{t.year}</span>
          <div className="flex items-center gap-2">
            <button type="button" className="border rounded px-2" onClick={() => setYearMinus((v) => Math.max(0, v - 1))}>−</button>
            <input type="number" inputMode="numeric" className="border rounded p-1 w-20 text-center"
              value={yearMinus} min={0} max={5}
              onChange={(e) => setYearMinus(Math.min(5, Math.max(0, toInt(e.target.value, yearMinus))))}/>
            <button type="button" className="border rounded px-2" onClick={() => setYearMinus((v) => Math.min(5, v + 1))}>+</button>
            <span className="opacity-60">/</span>
            <button type="button" className="border rounded px-2" onClick={() => setYearPlus((v) => Math.max(0, v - 1))}>−</button>
            <input type="number" inputMode="numeric" className="border rounded p-1 w-20 text-center"
              value={yearPlus} min={0} max={5}
              onChange={(e) => setYearPlus(Math.min(5, Math.max(0, toInt(e.target.value, yearPlus))))}/>
            <button type="button" className="border rounded px-2" onClick={() => setYearPlus((v) => Math.min(5, v + 1))}>+</button>
          </div>
        </label>

        <label className="flex flex-col">
          <span>{t.people}</span>
          <div className="flex items-center gap-2">
            <button type="button" className="border rounded px-2" onClick={() => setPeopleMinus((v) => Math.max(0, v - 1))}>−</button>
            <input type="number" inputMode="numeric" className="border rounded p-1 w-20 text-center"
              value={peopleMinus} min={0} max={5}
              onChange={(e) => setPeopleMinus(Math.min(5, Math.max(0, toInt(e.target.value, peopleMinus))))}/>
            <button type="button" className="border rounded px-2" onClick={() => setPeopleMinus((v) => Math.min(5, v + 1))}>+</button>
            <span className="opacity-60">/</span>
            <button type="button" className="border rounded px-2" onClick={() => setPeoplePlus((v) => Math.max(0, v - 1))}>−</button>
            <input type="number" inputMode="numeric" className="border rounded p-1 w-20 text-center"
              value={peoplePlus} min={0} max={5}
              onChange={(e) => setPeoplePlus(Math.min(5, Math.max(0, toInt(e.target.value, peoplePlus))))}/>
            <button type="button" className="border rounded px-2" onClick={() => setPeoplePlus((v) => Math.min(5, v + 1))}>+</button>
          </div>
        </label>

        <label className="flex flex-col">
          <span>{t.cabins}</span>
          <div className="flex items-center gap-2">
            <button type="button" className="border rounded px-2" onClick={() => setCabinsMinus((v) => Math.max(0, v - 1))}>−</button>
            <input type="number" inputMode="numeric" className="border rounded p-1 w-20 text-center"
              value={cabinsMinus} min={0} max={3}
              onChange={(e) => setCabinsMinus(Math.min(3, Math.max(0, toInt(e.target.value, cabinsMinus))))}/>
            <button type="button" className="border rounded px-2" onClick={() => setCabinsMinus((v) => Math.min(3, v + 1))}>+</button>
            <span className="opacity-60">/</span>
            <button type="button" className="border rounded px-2" onClick={() => setCabinsPlus((v) => Math.max(0, v - 1))}>−</button>
            <input type="number" inputMode="numeric" className="border rounded p-1 w-20 text-center"
              value={cabinsPlus} min={0} max={3}
              onChange={(e) => setCabinsPlus(Math.min(3, Math.max(0, toInt(e.target.value, cabinsPlus))))}/>
            <button type="button" className="border rounded px-2" onClick={() => setCabinsPlus((v) => Math.min(3, v + 1))}>+</button>
          </div>
        </label>
      </div>

      <label className="flex flex-col">
        <span>{t.headsMin}</span>
        <input
          type="number"
          inputMode="numeric"
          className="border rounded p-1 w-24"
          value={headsMin}
          min={0}
          max={5}
          onChange={(e) => setHeadsMin(Math.min(5, Math.max(0, toInt(e.target.value, headsMin))))}
        />
      </label>

      <div className="mt-3 flex justify-end">
        <button type="submit" className="bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700">
          {t.applySave}
        </button>
      </div>
    </form>
  );
}