// frontend/src/pages/CompetitorFiltersPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import Select from "react-select";
import RangePair from "../components/RangePair";
import NumberField from "../components/NumberField";
import ModalFooter from "../components/ModalFooter";
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
    return () => {
      active = false;
    };
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
          })),
        ),
      ),
    )
      .then((arrs) => {
        if (myToken !== loadToken.current) return;
        const merged: Record<string, LocationOpt> = {};
        arrs.flat().forEach((opt) => {
          merged[opt.value] = merged[opt.value] || opt;
        });
        const list = Object.values(merged).sort((a, b) => a.label.localeCompare(b.label));
        setLocations(list);
        setSelectedLocations((prev) => prev.filter((p) => merged[p.value]));
      })
      .catch((e) => console.error("Failed to load locations:", e))
      .finally(() => {
        if (myToken === loadToken.current) setLocLoading(false);
      });
  }, [selectedCountries]);

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
    ],
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
          new Set((preset.locations ?? []).map((l) => l.countryCode).filter(Boolean)),
        ) as string[];
        const countryOpts: Option[] = codes.map((c) => ({ value: c, label: c }));
        setSelectedCountries(countryOpts as CountryOpt[]);
      } catch (e) {
        console.warn("[CompetitorFilters] failed to load preset:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scope]);

  // === Закрытие по Esc (capture, чтобы перебить stopPropagation в виджетах) ===
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
        <form
          role="dialog"
          aria-modal="true"
          className="grid gap-5 p-5 bg-white rounded-xl shadow max-w-xl"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              onClose?.();
            }
          }}
          onSubmit={(e) => {
            e.preventDefault();
            handleApplySave();
          }}
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

      {/* Ranges — ВЕРТИКАЛЬНЫЙ СТЕК */}
      <div className="grid gap-3">
        <RangePair
          label={t.length}
          minus={lenFtMinus}
          plus={lenFtPlus}
          setMinus={setLenFtMinus}
          setPlus={setLenFtPlus}
          min={0}
          max={5}
        />
        <RangePair
          label={t.year}
          minus={yearMinus}
          plus={yearPlus}
          setMinus={setYearMinus}
          setPlus={setYearPlus}
          min={0}
          max={5}
        />
        <RangePair
          label={t.people}
          minus={peopleMinus}
          plus={peoplePlus}
          setMinus={setPeopleMinus}
          setPlus={setPeoplePlus}
          min={0}
          max={5}
        />
        <RangePair
          label={t.cabins}
          minus={cabinsMinus}
          plus={cabinsPlus}
          setMinus={setCabinsMinus}
          setPlus={setCabinsPlus}
          min={0}
          max={3}
        />
        <NumberField label={t.headsMin} value={headsMin} onChange={setHeadsMin} min={0} max={5} />
      </div>

      <ModalFooter
        onCancel={onClose!}
        submitLabel="Apply & Save"
        submitting={false /* или saving */}
      />
    </form>
  );
}