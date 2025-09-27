// frontend/src/pages/CompetitorFiltersPage.tsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Select from "react-select";
import AsyncSelect from "react-select/async";
import RangePair from "../components/RangePair";
import NumberField from "../components/NumberField";
import ModalFooter from "../components/ModalFooter";
import {
  getCountries,
  getLocations,
  saveCompetitorFilters,
  getCompetitorFilters,
  findCategories,
  findBuilders,
  findModels,
  testFiltersCount,
  type Country,
  type LocationItem,
  type CatalogCategory,
  type CatalogBuilder,
  type CatalogModel,
} from "../api";

// --- i18n-ready labels ---
const t = {
  title: "Competitor filters",
  countries: "Countries",
  locations: "Locations",
  categories: "Categories",
  builders: "Builders",
  models: "Models",
  headsMin: "Heads (min)",
  length: "Length ± (ft)",
  year: "Year ±",
  people: "People ±",
  cabins: "Cabins ±",
  applySave: "Apply & Save",
  loading: "Loading…",
  chooseCountries: "— choose countries —",
  chooseLocations: "— choose locations —",
  chooseCategories: "— choose categories —",
  chooseBuilders: "— choose builders —",
  chooseModels: "— choose models —",
  testFilters: "Test filters",
};

type Scope = "USER" | "ORG";

type SaveDto = {
  scope: Scope;
  locationIds?: string[];
  countryCodes?: string[];

  categoryIds?: string[];
  builderIds?: string[];
  modelIds?: string[];

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
type LocationOpt = { value: string; label: string; countryCode?: string | null };
type IdLabel = { value: number; label: string };
type Option = { value: string; label: string };

const toLocOption = (l: { id: string; name: string; countryCode?: string | null }): Option => ({
  value: l.id,
  label: l.countryCode ? `${l.name} (${l.countryCode})` : l.name,
});

export default function CompetitorFiltersPage({
  scope = "USER",
  onSubmit,
  onClose,
}: {
  scope?: Scope;
  onSubmit?: (dto: SaveDto) => void;
  onClose?: () => void;
}) {
  // --- ranges / numeric ---
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

  // NEW: categories / builders / models (selected)
  const [catsSel, setCatsSel] = useState<IdLabel[]>([]);
  const [buildersSel, setBuildersSel] = useState<IdLabel[]>([]);
  const [modelsSel, setModelsSel] = useState<IdLabel[]>([]);

  // load countries (once)
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

  // ===== Async loaders for catalog dropdowns =====
  const loadCategories = useCallback(
    async (inputValue: string): Promise<IdLabel[]> => {
      const { items } = await findCategories(inputValue ?? "", 20);
      return items.map((c: CatalogCategory) => ({
        value: c.id,
        label: c.nameEn || c.nameRu || `#${c.id}`,
      }));
    },
    [],
  );

  const loadBuilders = useCallback(
    async (inputValue: string): Promise<IdLabel[]> => {
      const { items } = await findBuilders(inputValue ?? "", 20);
      return items.map((b: CatalogBuilder) => ({ value: b.id, label: b.name }));
    },
    [],
  );

  const loadModels = useCallback(
    async (inputValue: string): Promise<IdLabel[]> => {
      // optionally filter by selected cat/builder (возьмем первый выбранный для узкого поиска)
      const builderId = buildersSel[0]?.value;
      const categoryId = catsSel[0]?.value;
      const { items } = await findModels(inputValue ?? "", {
        builderId,
        categoryId,
        take: 20,
      });
      return items.map((m: CatalogModel) => ({ value: m.id, label: m.name }));
    },
    [buildersSel, catsSel],
  );

  // build DTO
  const dto: SaveDto = useMemo(
    () => ({
      scope,
      countryCodes: selectedCountries.map((c) => c.value),
      locationIds: selectedLocations.map((l) => l.value),

      categoryIds: catsSel.map((x) => String(x.value)),
      builderIds: buildersSel.map((x) => String(x.value)),
      modelIds: modelsSel.map((x) => String(x.value)),

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

  // Test filters (dry-run)
  const handleTestFilters = useCallback(async () => {
    try {
      const { count } = await testFiltersCount<SaveDto>(dto);
      alert(`Test scan: ${count} results`);
    } catch (e) {
      console.error("[Test filters] failed:", e);
      alert("Test failed.");
    }
  }, [dto]);

  // ===== Load preset on mount =====
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

        // locations / countries from preset
        const locOpts: Option[] = (preset.locations ?? []).map(toLocOption);
        setSelectedLocations(locOpts);
        const codes = Array.from(
          new Set((preset.locations ?? []).map((l) => l.countryCode).filter(Boolean)),
        ) as string[];
        const countryOpts: Option[] = codes.map((c) => ({ value: c, label: c }));
        setSelectedCountries(countryOpts as CountryOpt[]);

        // NEW: hydrate cats/builders/models if present
        if (Array.isArray(preset.categories)) {
          setCatsSel(
            preset.categories.map((c) => ({
              value: c.id,
              label: c.nameEn || c.nameRu || `#${c.id}`,
            })),
          );
        }
        if (Array.isArray(preset.builders)) {
          setBuildersSel(preset.builders.map((b) => ({ value: b.id, label: b.name })));
        }
        if (Array.isArray(preset.models)) {
          setModelsSel(preset.models.map((m) => ({ value: m.id, label: m.name })));
        }
      } catch (e) {
        console.warn("[CompetitorFilters] failed to load preset:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scope]);

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

      {/* Categories (multi, async) */}
      <label className="flex flex-col gap-1">
        <span>{t.categories}</span>
        <AsyncSelect<IdLabel, true>
          cacheOptions
          defaultOptions
          isMulti
          loadOptions={loadCategories}
          value={catsSel}
          onChange={(vals) => setCatsSel(vals as IdLabel[])}
          placeholder={t.chooseCategories}
          classNamePrefix="rs"
        />
      </label>

      {/* Builders (multi, async) */}
      <label className="flex flex-col gap-1">
        <span>{t.builders}</span>
        <AsyncSelect<IdLabel, true>
          cacheOptions
          defaultOptions
          isMulti
          loadOptions={loadBuilders}
          value={buildersSel}
          onChange={(vals) => setBuildersSel(vals as IdLabel[])}
          placeholder={t.chooseBuilders}
          classNamePrefix="rs"
        />
      </label>

      {/* Models (multi, async; depends on selected cat/builder) */}
      <label className="flex flex-col gap-1">
        <span>{t.models}</span>
        <AsyncSelect<IdLabel, true>
          cacheOptions
          defaultOptions
          isMulti
          loadOptions={loadModels}
          value={modelsSel}
          onChange={(vals) => setModelsSel(vals as IdLabel[])}
          placeholder={t.chooseModels}
          classNamePrefix="rs"
        />
      </label>

      {/* Ranges — вертикальный стек */}
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

      {/* Bottom row: Test filters (left) + Cancel/Apply (right) */}
      <ModalFooter
        onCancel={onClose!}
        submitLabel={t.applySave}
        submitting={false}
        leftContent={
          <button
            type="button"
            onClick={handleTestFilters}
            className="h-10 px-4 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          >
            {t.testFilters}
          </button>
        }
      />
    </form>
  );
}