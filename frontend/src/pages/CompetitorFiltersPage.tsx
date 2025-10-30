// frontend/src/pages/CompetitorFiltersPage.tsx

import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import Select from "react-select";
import AsyncSelect from "react-select/async";

import RangePair from "../components/RangePair";
import NumberField from "../components/NumberField";
import ModalFooter from "../components/ModalFooter";
import {
  getCountries,
  findRegions,
  getLocations,
  saveCompetitorFilters,
  getCompetitorFilters,
  findCategories,
  findBuilders,
  findModels,
  testFiltersCount,
  resetCompetitorFilters,
  type Country,
  type CatalogCategory,
  type CatalogBuilder,
  type CatalogModel,
  type CatalogRegion,
  type CompetitorFiltersDto,
} from "../api";

// --- i18n-ready labels ---
const t = {
  title: "Competitor filters",
  countries: "Countries",
  locations: "Locations",
  regions: "Regions",
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
  chooseRegions: "— choose regions —",
  chooseLocations: "— choose locations —",
  chooseCategories: "— choose categories —",
  chooseBuilders: "— choose builders —",
  chooseModels: "— choose models —",
  testFilters: "Test filters",
  resetFilters: "Reset filters",
};

// Feature flag: скрыть People фильтр в UI (оставляем в DTO/стейте)
const SHOW_PEOPLE = false;

type Scope = "USER" | "ORG";

// тип DTO полностью синхронизирован с API
type SaveDto = CompetitorFiltersDto;

// option shapes for react-select
type CountryOpt = { value: string; label: string }; // value = country.id (UUID)
type RegionOpt  = { value: number; label: string; countryId?: string };
type LocationOpt = {
  value: string;     // location.id (UUID)
  label: string;     // "HR › Split region › Marina Kaštela"
  countryId?: string | null;
  regionId?: number | null;
};
type IdLabel = { value: number; label: string };

function makeRegionLabel(r: {
  id: number;
  nameEn?: string | null;
  nameRu?: string | null;
  nameDe?: string | null;
  country?: { code2: string; name: string } | null;
}): string {
  const primary =
    r.nameEn ||
    r.nameRu ||
    r.nameDe ||
    `#${r.id}`;
  if (r.country?.code2) {
    return `${r.country.code2} › ${primary}`;
  }
  return primary;
}

function makeLocationLabel(l: {
  name: string;
  country?: { code2: string; name: string } | null;
  regionName?: string | null;
}): string {
  // prefer "HR › Split region › Marina Kaštela"
  const parts: string[] = [];
  if (l.country?.code2) parts.push(l.country.code2);
  if (l.regionName) parts.push(l.regionName);
  parts.push(l.name);
  return parts.join(" › ");
}

export default function CompetitorFiltersPage({
  scope = "USER",
  onSubmit,
  onClose,
}: {
  scope?: Scope;
  onSubmit?: (dto: SaveDto, scanSource?: "INNERDB" | "NAUSYS") => void;
  onClose?: () => void;
}) {

  // --- URL search params ---
  const [searchParams, setSearchParams] = useSearchParams();

  // === Scan source (persisted) ===
  const [scanSource, setScanSource] = useState<"INNERDB" | "NAUSYS">("INNERDB");

  // 1) При монтировании читаем ?source из URL → state/localStorage (fallback — localStorage → URL)
  useEffect(() => {
    const urlSource = (searchParams.get("source") || "").toUpperCase();
    const lsSource = (localStorage.getItem("competitor:scanSource") || "INNERDB").toUpperCase();
    const initial = (urlSource === "NAUSYS" || urlSource === "INNERDB") ? (urlSource as any) : (lsSource as any);
    setScanSource(initial);
    if (urlSource !== initial) {
      const next = new URLSearchParams(searchParams);
      next.set("source", initial);
      setSearchParams(next, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) Любое изменение источника → URL + localStorage
  useEffect(() => {
    localStorage.setItem("competitor:scanSource", scanSource);
    const cur = (searchParams.get("source") || "").toUpperCase();
    if (cur !== scanSource) {
      const next = new URLSearchParams(searchParams);
      next.set("source", scanSource);
      setSearchParams(next, { replace: true });
    }
  }, [scanSource, searchParams, setSearchParams]);


  // --- ranges / numeric ---
  const [lenFtMinus, setLenFtMinus] = useState(3)
  const [lenFtPlus, setLenFtPlus] = useState(3)
  const [yearMinus, setYearMinus] = useState(2)
  const [yearPlus, setYearPlus] = useState(2)
  const [peopleMinus, setPeopleMinus] = useState(1)
  const [peoplePlus, setPeoplePlus] = useState(1)
  const [cabinsMinus, setCabinsMinus] = useState(1)
  const [cabinsPlus, setCabinsPlus] = useState(1)
  const [headsMin, setHeadsMin] = useState(1)

  // --- GEO CASCADE STATE ---
  // Countries
  const [countries, setCountries] = useState<CountryOpt[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<CountryOpt[]>([]);

  // Regions
  const [regionsOptions, setRegionsOptions] = useState<RegionOpt[]>([]);
  const [regionsSel, setRegionsSel] = useState<RegionOpt[]>([]);
  const [regionsLoading, setRegionsLoading] = useState(false);

  // Locations (marinas/bases)
  const [locationsOptions, setLocationsOptions] = useState<LocationOpt[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<LocationOpt[]>([]);
  const [locLoading, setLocLoading] = useState(false);

  // derived arrays we will send to backend
  const countryIds = useMemo(
    () => selectedCountries.map((c) => c.value),
    [selectedCountries]
  );
  const regionIds = useMemo(
    () => regionsSel.map((r) => r.value),
    [regionsSel]
  );

  // NEW: categories / builders / models (selected)
  const [catsSel, setCatsSel] = useState<IdLabel[]>([])
  const [buildersSel, setBuildersSel] = useState<IdLabel[]>([])
  const [modelsSel, setModelsSel] = useState<IdLabel[]>([])

  // Кнопка Reset неактивна, если «и так пусто»
  const nothingSelected = useMemo(
    () =>
      selectedCountries.length === 0 &&
      selectedLocations.length === 0 &&
      catsSel.length === 0 &&
      buildersSel.length === 0 &&
      modelsSel.length === 0 &&
      regionsSel.length === 0,
    [selectedCountries, selectedLocations, catsSel, buildersSel, modelsSel, regionsSel]
  )

  // 1) load countries (once)
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const list: Country[] = await getCountries();
        if (!active) return;
        // Country: { id, code2, name }
        const opts: CountryOpt[] = list
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((c) => ({
            value: c.id,
            label: `${c.name} (${c.code2})`,
          }));
        setCountries(opts);
      } catch (e) {
        console.error("Failed to load countries:", e);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // 2) whenever countryIds[] changes → reload regions (cascade)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!countryIds.length) {
        setRegionsOptions([]);
        setRegionsSel([]);
        return;
      }
      setRegionsLoading(true);
      try {
        // backend expects comma-separated countryIds in query
        const { items } = await findRegions("", {
          countryIds,
          take: 200,
        });

        if (cancelled) return;

        // convert to RegionOpt
        const regionOpts: RegionOpt[] = (items as CatalogRegion[]).map((r) => ({
          value: r.id,
          label: makeRegionLabel({
            id: r.id,
            nameEn: r.nameEn,
            nameRu: r.nameRu,
            nameDe: r.nameDe,
            country: (r as any).country ?? null,
          }),
          countryId: (r as any).countryId ?? undefined,
        }));

        setRegionsOptions(regionOpts);

        // clean selected regions that are not in new options
        setRegionsSel((prev) =>
          prev.filter((sel) => regionOpts.some((opt) => opt.value === sel.value))
        );
      } catch (e) {
        console.error("Failed to load regions:", e);
        if (!cancelled) {
          setRegionsOptions([]);
          setRegionsSel([]);
        }
      } finally {
        if (!cancelled) setRegionsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [countryIds]);

  // 3) whenever countryIds[] OR regionIds[] changes → reload locations (cascade)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!countryIds.length && !regionIds.length) {
        setLocationsOptions([]);
        setSelectedLocations([]);
        return;
      }

      setLocLoading(true)
      try {
        const { items } = await getLocations({
          countryIds: countryIds.length ? countryIds : undefined,
          regionIds: regionIds.length ? regionIds : undefined,
          source: 'NAUSYS',
          take: 1000,
        })

        if (cancelled) return

        const locOpts: LocationOpt[] = items.map((l) => ({
          value: l.id,
          label: makeLocationLabel({
            name: l.name,
            regionName: l.regionName ?? null,
            country: l.country ?? null,
          }),
          countryId: l.countryId ?? null,
          regionId: l.regionId ?? null,
        }))

        setLocationsOptions(locOpts)

        // clean selected locations that are not in options anymore
        setSelectedLocations((prev) =>
          prev.filter((sel) => locOpts.some((opt) => opt.value === sel.value))
        )
      } catch (e) {
        console.error('Failed to load locations:', e)
        if (!cancelled) {
          setLocationsOptions([])
          setSelectedLocations([])
        }
      } finally {
        if (!cancelled) setLocLoading(false)
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [countryIds, regionIds]);

  // ===== Async loaders for catalog dropdowns =====
  const loadCategories = useCallback(async (inputValue: string): Promise<IdLabel[]> => {
    const { items } = await findCategories(inputValue ?? '', 20)
    return items.map((c: CatalogCategory) => ({
      value: c.id,
      label: c.nameEn || c.nameRu || `#${c.id}`,
    }))
  }, [])

  const loadBuilders = useCallback(async (inputValue: string): Promise<IdLabel[]> => {
    const { items } = await findBuilders(inputValue ?? '', 20)
    return items.map((b: CatalogBuilder) => ({ value: b.id, label: b.name }))
  }, [])

  const loadModels = useCallback(
    async (inputValue: string): Promise<IdLabel[]> => {
      // optionally filter by selected cat/builder (возьмем первый выбранный для узкого поиска)
      const builderId = buildersSel[0]?.value
      const categoryId = catsSel[0]?.value
      const { items } = await findModels(inputValue ?? '', {
        builderId,
        categoryId,
        take: 20,
      })
      return items.map((m: CatalogModel) => ({ value: m.id, label: m.name }))
    },
    [buildersSel, catsSel]
  )

  // ⚠ regions now come from cascade state (regionsOptions).
  // AsyncSelect's loadOptions can just resolve cached regionsOptions filtered by input.
  const loadRegionsAsync = useCallback(
    async (inputValue: string): Promise<RegionOpt[]> => {
      const needle = (inputValue || "").toLowerCase();
      return regionsOptions.filter((opt) =>
        opt.label.toLowerCase().includes(needle)
      );
    },
    [regionsOptions]
  );

  // build DTO
  const dto: SaveDto = useMemo(
    () => ({
      scope,
      countryIds,
      regionIds,
      locationIds: selectedLocations.map((l) => l.value),
      categoryIds: catsSel.map((x) => x.value),
      builderIds: buildersSel.map((x) => x.value),
      modelIds: modelsSel.map((x) => x.value),
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
      regionsSel,
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
    ]
  )

  async function handleApplySave() {
    try {
      onSubmit?.(dto, scanSource)
      await saveCompetitorFilters(dto)
      alert('Filters applied and saved.')
      onClose?.()
    } catch (e) {
      console.error('Apply & Save failed:', e)
      alert('Failed to save filters.')
    }
  }

  // Test filters (dry-run)
  const handleTestFilters = useCallback(async () => {
    try {
      const { count } = await testFiltersCount<SaveDto>(dto)
      alert(`Test scan: ${count} results`)
    } catch (e) {
      console.error('[Test filters] failed:', e)
      alert('Test failed.')
    }
  }, [dto])

  // ===== Load preset on mount =====
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const preset = await getCompetitorFilters() // может вернуть null
        if (cancelled || !preset) return

        setLenFtMinus(preset.lenFtMinus ?? 3)
        setLenFtPlus(preset.lenFtPlus ?? 3)
        setYearMinus(preset.yearMinus ?? 2)
        setYearPlus(preset.yearPlus ?? 2)
        setPeopleMinus(preset.peopleMinus ?? 1)
        setPeoplePlus(preset.peoplePlus ?? 1)
        setCabinsMinus(preset.cabinsMinus ?? 1)
        setCabinsPlus(preset.cabinsPlus ?? 1)
        setHeadsMin(preset.headsMin ?? 1)

        // countries from preset (M2M countries[])
        const presetCountries: CountryOpt[] = (preset.countries ?? []).map((c) => ({
          value: c.id,
          label: `${c.name} (${c.code2})`,
        }));
        setSelectedCountries(presetCountries);

        // NEW: hydrate cats/builders/models if present
        if (Array.isArray(preset.categories)) {
          setCatsSel(
            preset.categories.map((c) => ({
              value: c.id,
              label: c.nameEn || c.nameRu || `#${c.id}`,
            }))
          )
        }
        if (Array.isArray(preset.builders)) {
          setBuildersSel(preset.builders.map((b) => ({ value: b.id, label: b.name })))
        }
        if (Array.isArray(preset.models)) {
          setModelsSel(preset.models.map((m) => ({ value: m.id, label: m.name })))
        }

        // regions from preset
        if (Array.isArray(preset.regions)) {
          const presetRegions: RegionOpt[] = preset.regions.map((r) => ({
            value: r.id,
            label: makeRegionLabel({
              id: r.id,
              nameEn: r.nameEn,
              nameRu: r.nameRu,
              nameDe: r.nameDe,
              country: (r as any).country ?? null,
            }),
            countryId: (r as any).countryId ?? undefined,
          }));
          setRegionsSel(presetRegions);
          // важно: добавить их в options тоже, чтобы AsyncSelect показал value
          setRegionsOptions((old) => {
            const merged = [...old];
            presetRegions.forEach((pr) => {
              if (!merged.some((m) => m.value === pr.value)) {
                merged.push(pr);
              }
            });
            return merged;
          });
        }

        // locations from preset
        if (Array.isArray(preset.locations)) {
          const presetLocs: LocationOpt[] = preset.locations.map((l) => ({
            value: l.id,
            label: l.countryCode
              ? `${l.name} (${l.countryCode})`
              : l.name,
          }));
          setSelectedLocations(presetLocs);
          setLocationsOptions((old) => {
            const merged = [...old];
            presetLocs.forEach((pl) => {
              if (!merged.some((m) => m.value === pl.value)) {
                merged.push(pl);
              }
            });
            return merged;
          });
        }
      } catch (e) {
        console.warn('[CompetitorFilters] failed to load preset:', e)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [scope])

  async function handleResetFilters() {
   try {
      // Подтверждение сброса
      const ok = confirm('Reset all filters?')
      if (!ok) return

      await resetCompetitorFilters(scope)
      // подчистим локальный стейт
      setSelectedCountries([])
      setSelectedLocations([])
      setCatsSel([])
      setBuildersSel([])
      setModelsSel([])
      setRegionsSel([])
      setLenFtMinus(3)
      setLenFtPlus(3)
      setYearMinus(2)
      setYearPlus(2)
      setPeopleMinus(1)
      setPeoplePlus(1)
      setCabinsMinus(1)
      setCabinsPlus(1)
      setHeadsMin(1)
    } catch (e) {
      console.error('Reset failed:', e)
      alert('Failed to reset filters.')
    }
  }

  return (
    <form
      className="grid gap-5"
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
      {/* Header */}
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">{t.title}</h2>
        <div className="inline-flex rounded-lg border bg-white p-1 shadow-sm select-none">
          <button
            type="button"
            onClick={() => setScanSource("INNERDB")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              scanSource === "INNERDB" ? "bg-gray-900 text-white" : "!text-gray-800 hover:bg-gray-100"
            }`}
            title="Use internal DB (demo)"
          >
            INNERDB
          </button>
          <button
            type="button"
            onClick={() => setScanSource("NAUSYS")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              scanSource === "NAUSYS" ? "bg-gray-900 text-white" : "!text-gray-800 hover:bg-gray-100"
            }`}
            title="Use NauSYS API results"
          >
            NAUSYS
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-4">
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

        {/* Regions (multi, async, but fed from cascade cache) */}
        <label className="flex flex-col gap-1">
          <span>{t.regions}</span>
          <AsyncSelect<RegionOpt, true>
              isMulti
              cacheOptions
              defaultOptions={regionsOptions}
              loadOptions={loadRegionsAsync}
              value={regionsSel}
              onChange={(vals) => setRegionsSel(vals as RegionOpt[])}
              isDisabled={countryIds.length === 0 || regionsLoading}
              placeholder={regionsLoading ? t.loading : t.chooseRegions}
              classNamePrefix="rs"
            />
        </label>

        {/* Locations (multi) */}
        <label className="flex flex-col gap-1">
          <span>{t.locations}</span>
          <Select<LocationOpt, true>
              isMulti
              isDisabled={(countryIds.length === 0 && regionIds.length === 0) || locLoading}
              options={locationsOptions}
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
          {SHOW_PEOPLE && (
            <RangePair
              label={t.people}
              minus={peopleMinus}
              plus={peoplePlus}
              setMinus={setPeopleMinus}
              setPlus={setPeoplePlus}
              min={0}
              max={5}
            />
          )}
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
      </div>

      {/* Bottom row: Test filters (left) + Cancel/Apply (right) */}

      {/* всегда видимый футер: «прилипает» к низу скроллящегося тела из Modal */}
      <div className="sticky bottom-0 -mx-5 -mb-5 border-t bg-white px-5 py-4">
        <ModalFooter
          onCancel={onClose!}
          submitLabel={t.applySave}
          submitting={false}
          leftContent={
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleTestFilters}
                className="h-10 px-4 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              >
                {t.testFilters}
              </button>

              <button
                type="button"
                onClick={handleResetFilters}
                disabled={nothingSelected}
                className={`h-10 px-4 rounded-md border ${
                  nothingSelected ? 'border-gray-200 text-gray-300 cursor-not-allowed' :
                  'border-red-300 bg-white text-red-700 hover:bg-red-50'
                }`}
              >
                {t.resetFilters}
              </button>
            </div>
          }
        />
      </div>
    </form>
  )
}