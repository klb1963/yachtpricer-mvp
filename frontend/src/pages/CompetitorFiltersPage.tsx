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
  // NEW:
  findCategories,
  findBuilders,
  findModels,
  testFiltersCount,
  type CatalogCategory,
  type CatalogBuilder,
  type CatalogModel,
} from "../api";

// --- i18n-ready labels ---
const t = {
  title: "Competitor filters",
  countries: "Countries",
  locations: "Locations",
  categories: "Categories",     // NEW
  builders: "Builders",         // NEW
  models: "Models",             // NEW
  headsMin: "Heads (min)",
  length: "Length ± (ft)",
  year: "Year ±",
  people: "People ±",
  cabins: "Cabins ±",
  applySave: "Apply & Save",
  loading: "Loading…",
  chooseCountries: "— choose countries —",
  chooseLocations: "— choose locations —",
  chooseCategories: "— choose categories —", // NEW
  chooseBuilders: "— choose builders —",     // NEW
  chooseModels: "— choose models —",         // NEW
  testFilters: "Test filters",
};

type Scope = "USER" | "ORG";

type SaveDto = {
  scope: Scope;
  locationIds?: string[];
  countryCodes?: string[];
  categoryIds?: string[]; // NEW
  builderIds?: string[];  // NEW
  modelIds?: string[];    // NEW
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

  type IdLabel = { value: number; label: string };

  // NEW: каталог — выбранные значения
  const [catsSel, setCatsSel] = useState<IdLabel[]>([]);
  const [buildersSel, setBuildersSel] = useState<IdLabel[]>([]);
  const [modelsSel, setModelsSel] = useState<IdLabel[]>([]);

  // NEW: каталог — опции списков
  const [catOpts, setCatOpts] = useState<IdLabel[]>([]);
  const [builderOpts, setBuilderOpts] = useState<IdLabel[]>([]);
  const [modelOpts, setModelOpts] = useState<IdLabel[]>([]);

  // NEW: простой дебаунс для onInputChange
  const debounceRef = useRef<number | null>(null);
  const debounce = (fn: () => void, delay = 300) => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(fn, delay);
  };
 
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

      // NEW ↓ конвертируем number → string
      categoryIds: catsSel.map((x: IdLabel) => String(x.value)),
      builderIds:  buildersSel.map((x: IdLabel) => String(x.value)),
      modelIds:    modelsSel.map((x: IdLabel) => String(x.value)),

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
      catsSel,
      buildersSel,
      modelsSel,
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

  async function handleTestFilters() {
  try {
    const { count } = await testFiltersCount(dto);
    alert(`Found ${count} competitors for these filters.`);
  } catch (e) {
    console.error("Test filters failed:", e);
    alert("Failed to test filters.");
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
        if (e.key === 'Escape') {
          e.stopPropagation()
          onClose?.()
        }
      }}
      onSubmit={(e) => {
        e.preventDefault()
        handleApplySave()
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

      {/* NEW: Categories (multi) */}
      <label className="flex flex-col gap-1">
        <span>{t.categories}</span>
        <Select<IdLabel, true>
          isMulti
          options={catOpts}
          value={catsSel}
          onInputChange={(q) => {
            debounce(async () => {
              try {
                const res = await findCategories(q)
                setCatOpts(
                  res.items.map((c: CatalogCategory) => ({
                    value: c.id,
                    label: c.nameEn ?? c.nameRu ?? String(c.id),
                  }))
                )
              } catch {}
            })
            return q
          }}
          onChange={(vals) => setCatsSel(vals as IdLabel[])}
          placeholder={t.chooseCategories}
          classNamePrefix="rs"
        />
      </label>

      {/* NEW: Builders (multi) */}
      <label className="flex flex-col gap-1">
        <span>{t.builders}</span>
        <Select<IdLabel, true>
          isMulti
          options={builderOpts}
          value={buildersSel}
          onInputChange={(q) => {
            debounce(async () => {
              try {
                const res = await findBuilders(q)
                setBuilderOpts(
                  res.items.map((b: CatalogBuilder) => ({
                    value: b.id,
                    label: b.name,
                  }))
                )
              } catch {}
            })
            return q
          }}
          onChange={(vals) => setBuildersSel(vals as IdLabel[])}
          placeholder={t.chooseBuilders}
          classNamePrefix="rs"
        />
      </label>

      {/* NEW: Models (multi) */}
      <label className="flex flex-col gap-1">
        <span>{t.models}</span>
        <Select<IdLabel, true>
          isMulti
          options={modelOpts}
          value={modelsSel}
          onInputChange={(q) => {
            debounce(async () => {
              try {
                const primaryBuilderId = buildersSel[0]?.value
                const primaryCategoryId = catsSel[0]?.value
                const res = await findModels(q, {
                  builderId: primaryBuilderId,
                  categoryId: primaryCategoryId,
                })
                setModelOpts(
                  res.items.map((m: CatalogModel) => ({
                    value: m.id,
                    label: m.name,
                  }))
                )
              } catch {}
            })
            return q
          }}
          onChange={(vals) => setModelsSel(vals as IdLabel[])}
          placeholder={t.chooseModels}
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

      {/* Footer row: Test filters + Cancel/Apply */}
      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={handleTestFilters}
          className="inline-flex h-10 items-center justify-center rounded-md border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          {t.testFilters}
        </button>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-md border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {t.applySave}
          </button>
        </div>
</div>
    </form>
  )
}