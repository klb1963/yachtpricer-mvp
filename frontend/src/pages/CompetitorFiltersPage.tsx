// frontend/src/pages/CompetitorFiltersPage.tsx
import { useEffect, useMemo, useState, useCallback } from "react";
import Select from "react-select";
import AsyncSelect from "react-select/async";
import { findRegions } from "../api";
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
  resetCompetitorFilters,
  type Country,
  type CatalogCategory,
  type CatalogBuilder,
  type CatalogModel,
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

type Scope = "USER" | "ORG";

type SaveDto = {
  scope: Scope;
  locationIds?: string[];
  countryCodes?: string[];

  // числа, как ожидает API
  categoryIds?: number[];
  builderIds?: number[];
  modelIds?: number[];
  regionIds?: number[];

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
  onSubmit?: (dto: SaveDto, scanSource?: "INNERDB" | "NAUSYS") => void;
  onClose?: () => void;
}) {

  // === Scan source (persisted) ===
  const [scanSource, setScanSource] = useState<"INNERDB" | "NAUSYS">(
    (localStorage.getItem("competitor:scanSource") as any) || "INNERDB"
  );
  useEffect(() => {
    localStorage.setItem("competitor:scanSource", scanSource);
  }, [scanSource]);

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

  // countries / locations
  const [countries, setCountries] = useState<CountryOpt[]>([])
  const [selectedCountries, setSelectedCountries] = useState<CountryOpt[]>([])
  const [locations, setLocations] = useState<LocationOpt[]>([])
  const [selectedLocations, setSelectedLocations] = useState<LocationOpt[]>([])
  const [locLoading, setLocLoading] = useState(false)

  const [locQuery, setLocQuery] = useState('')
  // все выбранные страны → ISO-2 (верхним регистром)
  const countryCodes = useMemo(
    () => selectedCountries.map(c => c.value.toUpperCase()), [selectedCountries])

  // NEW: categories / builders / models (selected)
  const [catsSel, setCatsSel] = useState<IdLabel[]>([])
  const [buildersSel, setBuildersSel] = useState<IdLabel[]>([])
  const [modelsSel, setModelsSel] = useState<IdLabel[]>([])
  const [regionsSel, setRegionsSel] = useState<IdLabel[]>([])

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

  // load countries (once)
  useEffect(() => {
    let active = true
    getCountries()
      .then((list: Country[]) => {
        if (!active) return
        const opts = list
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((c) => ({ value: c.code2, label: c.name }))
        setCountries(opts)
      })
      .catch((e) => console.error('Failed to load countries:', e))
    return () => {
      active = false
    }
  }, [])

  // when countries or search change → reload locations (union по всем странам)
  useEffect(() => {
    let aborted = false
    ;(async () => {
      setLocLoading(true)
      try {

        // если стран нет — грузим без фильтра страны (поиск по всему справочнику)
        const codes = countryCodes.length ? countryCodes : [undefined]
        const pages = await Promise.all(
          codes.map(code =>
            getLocations({
              q: locQuery || undefined,
              countryCode: code,       // undefined → параметр не уйдёт
              take: 500,
              // orderBy: 'name',
            })
          )
        )
        if (aborted) return

        const items = pages.flatMap(p => p.items ?? [])
        const dedup = new Map<string, LocationOpt>()
        for (const l of items) {
          const opt: LocationOpt = {
            value: l.id,
            label: l.countryCode ? `${l.name} (${l.countryCode})` : l.name,
            countryCode: l.countryCode ?? null,
          }
          if (!dedup.has(opt.value)) dedup.set(opt.value, opt)
        }
        const list = Array.from(dedup.values()).sort((a, b) => a.label.localeCompare(b.label))
        setLocations(list)
        // вычистим выбранные, которых больше нет в options
        setSelectedLocations(prev => prev.filter(p => dedup.has(p.value)))

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {
        if (!aborted) {
          setLocations([])
          setSelectedLocations([])
        }
      } finally {
        if (!aborted) setLocLoading(false)
      }
    })()
    return () => {
      aborted = true
    }
  }, [countryCodes, locQuery])

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

  // NEW: async loader for regions
  const loadRegions = useCallback(async (inputValue: string): Promise<IdLabel[]> => {
    const { items } = await findRegions(inputValue ?? '', { take: 20 })
    return items.map((r) => ({
      value: r.id,
      label:
        r.nameEn ||
        r.nameRu ||
        r.nameDe ||
        (r.countryCode ? `#${r.id} (${r.countryCode})` : `#${r.id}`),
    }))
  }, [])

  // build DTO
  const dto: SaveDto = useMemo(
    () => ({
      scope,
      countryCodes: selectedCountries.map((c) => c.value),
      locationIds: selectedLocations.map((l) => l.value),

      // передаем ЧИСЛА, как требует API
      categoryIds: catsSel.map((x) => x.value),
      builderIds: buildersSel.map((x) => x.value),
      modelIds: modelsSel.map((x) => x.value),
      regionIds: regionsSel.map((x) => x.value),

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

        // locations from preset
        const locOpts: Option[] = (preset.locations ?? []).map(toLocOption)
        setSelectedLocations(locOpts)

        // countries from preset (новый M2M)
        const countryOpts: CountryOpt[] = (preset.countries ?? []).map((c) => ({
          // если селект работает по ISO-2:
          value: c.code2,
          label: `${c.name} (${c.code2})`,
        }))
        setSelectedCountries(countryOpts)

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
        // NEW: hydrate regions
        if (Array.isArray(preset.regions)) {
          setRegionsSel(
            preset.regions.map((r) => ({
              value: r.id,
              label:
                r.nameEn ||
                r.nameRu ||
                r.nameDe ||
                (r.countryCode ? `#${r.id} (${r.countryCode})` : `#${r.id}`),
            }))
          )
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

        {/* Regions (multi, async) */}
        <label className="flex flex-col gap-1">
          <span>{t.regions}</span>
          <AsyncSelect<IdLabel, true>
            cacheOptions
            defaultOptions
            isMulti
            loadOptions={loadRegions}
            value={regionsSel}
            onChange={(vals) => setRegionsSel(vals as IdLabel[])}
            placeholder={t.chooseRegions}
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
            onInputChange={(input) => {
              setLocQuery(input)
              return input
            }}
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