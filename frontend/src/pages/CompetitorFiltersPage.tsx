import Select from "react-select";
import AsyncSelect from "react-select/async";

import RangePair from "../components/RangePair";
import NumberField from "../components/NumberField";
import ModalFooter from "../components/ModalFooter";
import FilterPresetsBar from "../components/FilterPresetsBar";

import useCompetitorFiltersState, {
  type Scope,
  type SaveDto,
  type CountryOpt,
  type RegionOpt,
  type LocationOpt,
  type IdLabel,
} from "../hooks/useCompetitorFiltersState";

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

export default function CompetitorFiltersPage({
  scope = "USER",
  onSubmit,
  onClose,
}: {
  scope?: Scope;
  onSubmit?: (dto: SaveDto, scanSource?: "INNERDB" | "NAUSYS") => void;
  onClose?: () => void;
}) {
  const {
    scanSource,
    setScanSource,

    countries,
    selectedCountries,
    setSelectedCountries,

    regionsOptions,
    regionsSel,
    setRegionsSel,
    regionsLoading,

    locationsOptions,
    selectedLocations,
    setSelectedLocations,
    locLoading,

    catsSel,
    setCatsSel,
    buildersSel,
    setBuildersSel,
    modelsSel,
    setModelsSel,

    lenFtMinus,
    lenFtPlus,
    setLenFtMinus,
    setLenFtPlus,
    yearMinus,
    yearPlus,
    setYearMinus,
    setYearPlus,
    peopleMinus,
    peoplePlus,
    setPeopleMinus,
    setPeoplePlus,
    cabinsMinus,
    cabinsPlus,
    setCabinsMinus,
    setCabinsPlus,
    headsMin,
    setHeadsMin,

    countryIds,
    regionIds,

    loadCategories,
    loadBuilders,
    loadModels,
    loadRegionsAsync,

    // === новое для пресетов ===
    presets,
    presetsLoading,
    activePresetId,
    selectPresetById,
    saveCurrentAsPreset,
    deletePresetById,

    handleApplySave,
    // handleTestFilters, // временно не используется
    handleResetFilters,
    nothingSelected,
  } = useCompetitorFiltersState({
    scope: scope ?? "USER",
    onSubmit,
    onClose,
  });

  return (
    <form
      className="grid gap-5"
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
      {/* Header */}
      <div className="mb-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold">{t.title}</h2>
          <div className="inline-flex rounded-lg border bg-white p-1 shadow-sm select-none">
            <button
              type="button"
              onClick={() => setScanSource("INNERDB")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                scanSource === "INNERDB"
                  ? "bg-gray-900 text-white"
                  : "!text-gray-800 hover:bg-gray-100"
              }`}
              title="Use internal DB (demo)"
            >
              INNERDB
            </button>
            <button
              type="button"
              onClick={() => setScanSource("NAUSYS")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                scanSource === "NAUSYS"
                  ? "bg-gray-900 text-white"
                  : "!text-gray-800 hover:bg-gray-100"
              }`}
              title="Use NauSYS API results"
            >
              NAUSYS
            </button>
          </div>
        </div>

        {/* Presets bar */}
        <FilterPresetsBar
          presets={presets}
          activePresetId={activePresetId}
          loading={presetsLoading}
          onSelectPreset={selectPresetById}
          onSaveCurrentAsPreset={saveCurrentAsPreset}
          onDeletePreset={deletePresetById}
        />
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-4">
        {/* Countries */}
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

        {/* Regions */}
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

        {/* Locations */}
        <label className="flex flex-col gap-1">
          <span>{t.locations}</span>
          <Select<LocationOpt, true>
            isMulti
            isDisabled={
              (countryIds.length === 0 && regionIds.length === 0) || locLoading
            }
            options={locationsOptions}
            value={selectedLocations}
            onChange={(vals) => setSelectedLocations(vals as LocationOpt[])}
            placeholder={locLoading ? t.loading : t.chooseLocations}
            classNamePrefix="rs"
          />
        </label>

        {/* Categories */}
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

        {/* Builders */}
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

        {/* Models */}
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

        {/* Ranges */}
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
          <NumberField
            label={t.headsMin}
            value={headsMin}
            onChange={setHeadsMin}
            min={0}
            max={5}
          />
        </div>
      </div>

      {/* Sticky footer */}
      <div className="sticky bottom-0 -mx-5 -mb-5 border-t bg-white px-5 py-4">
        <ModalFooter
          onCancel={onClose!}
          submitLabel={t.applySave}
          submitting={false}
          leftContent={
            <div className="flex gap-2">
              {/* Кнопку Test filters временно отключили, чтобы не путать пользователей
              <button
                type="button"
                onClick={handleTestFilters}
                className="h-10 px-4 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              >
                {t.testFilters}
              </button>
              */}

              <button
                type="button"
                onClick={handleResetFilters}
                disabled={nothingSelected}
                className={`h-10 px-4 rounded-md border ${
                  nothingSelected
                    ? "border-gray-200 text-gray-300 cursor-not-allowed"
                    : "border-red-300 bg-white text-red-700 hover:bg-red-50"
                }`}
              >
                {t.resetFilters}
              </button>
            </div>
          }
        />
      </div>
    </form>
  );
}