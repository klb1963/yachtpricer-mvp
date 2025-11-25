// frontend/src/pages/CompetitorFiltersPage.tsx

import Select from "react-select";
import type { ScrapeSource } from "../api";
import AsyncSelect from "react-select/async";
import { useTranslation } from "react-i18next";

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

// Feature flag: скрыть People фильтр в UI (оставляем в DTO/стейте)
const SHOW_PEOPLE = false;

type Props = {
  scope?: Scope;
  onSubmit?: (dto: SaveDto, scanSource?: ScrapeSource) => void;
  onClose?: () => void;

  /**
   * Если переданы, страница использует внешний scanSource (из Dashboard/Pricing)
   * и не создаёт свой "отдельный" источник истины.
   */
  externalScanSource?: ScrapeSource;
  onExternalScanSourceChange?: (source: ScrapeSource) => void;
};

export default function CompetitorFiltersPage({
  scope = "USER",
  onSubmit,
  onClose,
  externalScanSource,
  onExternalScanSourceChange,
}: Props) {

  const { t } = useTranslation("competitors");

  const {
    scanSource: innerScanSource,
    setScanSource: innerSetScanSource,

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

    // === пресеты ===
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
    initialScanSource: externalScanSource,   // ← передаём наружный источник
  });

  // Нормализуем внешний source: если вдруг придёт BOATAROUND/SEARADAR и т.п.,
  // внутри модалки всё равно работаем только с INNERDB/NAUSYS
  const normalizedExternal: "INNERDB" | "NAUSYS" | null =
    externalScanSource === "INNERDB" || externalScanSource === "NAUSYS"
      ? externalScanSource
      : null;

  // нормализуем внутренний source: всё, что не NAUSYS, считаем INNERDB
  const normalizedInner: "INNERDB" | "NAUSYS" =
    innerScanSource === "NAUSYS" ? "NAUSYS" : "INNERDB";

  const effectiveScanSource: "INNERDB" | "NAUSYS" =
    normalizedExternal ?? normalizedInner;

  // функция, которая меняет источник и синхронизирует внешний/внутренний state
  const effectiveSetScanSource = (next: "INNERDB" | "NAUSYS") => {
    onExternalScanSourceChange?.(next);   // обновляем Dashboard
    innerSetScanSource(next);             // обновляем внутренний state хука
  };

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
          <h2 className="text-xl font-bold">
            {t("title", "Competitor filters")}
          </h2>

          {/* Source toggle */}
          <div className="inline-flex rounded-lg border bg-white p-1 shadow-sm select-none">
            <button
              type="button"
              onClick={() => effectiveSetScanSource("INNERDB")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                effectiveScanSource === "INNERDB"
                  ? "bg-gray-900 text-white"
                  : "!text-gray-800 hover:bg-gray-100"
              }`}
              title={t(
                "source.innerdbHint",
                "Use internal DB (demo)"
              )}
            >
              {t("source.innerdbLabel", "INNERDB")}
            </button>
            <button
              type="button"
              onClick={() => effectiveSetScanSource("NAUSYS")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                effectiveScanSource === "NAUSYS"
                  ? "bg-gray-900 text-white"
                  : "!text-gray-800 hover:bg-gray-100"
              }`}
              title={t(
                "source.nausysHint",
                "Use NauSYS API results"
              )}
            >
              {t("source.nausysLabel", "NAUSYS")}
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
          <span>{t("fields.countries", "Countries")}</span>
          <Select<CountryOpt, true>
            isMulti
            options={countries}
            value={selectedCountries}
            onChange={(vals) => setSelectedCountries(vals as CountryOpt[])}
            placeholder={t(
              "placeholders.countries",
              "— choose countries —"
            )}
            classNamePrefix="rs"
          />
        </label>

        {/* Regions */}
        <label className="flex flex-col gap-1">
          <span>{t("fields.regions", "Regions")}</span>
          <AsyncSelect<RegionOpt, true>
            isMulti
            cacheOptions
            defaultOptions={regionsOptions}
            loadOptions={loadRegionsAsync}
            value={regionsSel}
            onChange={(vals) => setRegionsSel(vals as RegionOpt[])}
            isDisabled={countryIds.length === 0 || regionsLoading}
            placeholder={
              regionsLoading
                ? t("loading", "Loading…")
                : t(
                    "placeholders.regions",
                    "— choose regions —"
                  )
            }
            classNamePrefix="rs"
          />
        </label>

        {/* Locations */}
        <label className="flex flex-col gap-1">
          <span>{t("fields.locations", "Locations")}</span>
          <Select<LocationOpt, true>
            isMulti
            isDisabled={
              (countryIds.length === 0 && regionIds.length === 0) ||
              locLoading
            }
            options={locationsOptions}
            value={selectedLocations}
            onChange={(vals) => setSelectedLocations(vals as LocationOpt[])}
            placeholder={
              locLoading
                ? t("loading", "Loading…")
                : t(
                    "placeholders.locations",
                    "— choose locations —"
                  )
            }
            classNamePrefix="rs"
          />
        </label>

        {/* Categories */}
        <label className="flex flex-col gap-1">
          <span>{t("fields.categories", "Categories")}</span>
          <AsyncSelect<IdLabel, true>
            cacheOptions
            defaultOptions
            isMulti
            loadOptions={loadCategories}
            value={catsSel}
            onChange={(vals) => setCatsSel(vals as IdLabel[])}
            placeholder={t(
              "placeholders.categories",
              "— choose categories —"
            )}
            classNamePrefix="rs"
          />
        </label>

        {/* Builders */}
        <label className="flex flex-col gap-1">
          <span>{t("fields.builders", "Builders")}</span>
          <AsyncSelect<IdLabel, true>
            cacheOptions
            defaultOptions
            isMulti
            loadOptions={loadBuilders}
            value={buildersSel}
            onChange={(vals) => setBuildersSel(vals as IdLabel[])}
            placeholder={t(
              "placeholders.builders",
              "— choose builders —"
            )}
            classNamePrefix="rs"
          />
        </label>

        {/* Models */}
        <label className="flex flex-col gap-1">
          <span>{t("fields.models", "Models")}</span>
          <AsyncSelect<IdLabel, true>
            cacheOptions
            defaultOptions
            isMulti
            loadOptions={loadModels}
            value={modelsSel}
            onChange={(vals) => setModelsSel(vals as IdLabel[])}
            placeholder={t(
              "placeholders.models",
              "— choose models —"
            )}
            classNamePrefix="rs"
          />
        </label>

        {/* Ranges */}
        <div className="grid gap-3">
          <RangePair
            label={t("ranges.length", "Length ± (ft)")}
            minus={lenFtMinus}
            plus={lenFtPlus}
            setMinus={setLenFtMinus}
            setPlus={setLenFtPlus}
            min={0}
            max={5}
          />
          <RangePair
            label={t("ranges.year", "Year ±")}
            minus={yearMinus}
            plus={yearPlus}
            setMinus={setYearMinus}
            setPlus={setYearPlus}
            min={0}
            max={5}
          />
          {SHOW_PEOPLE && (
            <RangePair
              label={t("ranges.people", "People ±")}
              minus={peopleMinus}
              plus={peoplePlus}
              setMinus={setPeopleMinus}
              setPlus={setPeoplePlus}
              min={0}
              max={5}
            />
          )}
          <RangePair
            label={t("ranges.cabins", "Cabins ±")}
            minus={cabinsMinus}
            plus={cabinsPlus}
            setMinus={setCabinsMinus}
            setPlus={setCabinsPlus}
            min={0}
            max={3}
          />
          <NumberField
            label={t("fields.headsMin", "Heads (min)")}
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
          submitLabel={t("footer.applySave", "Apply & Save")}
          cancelLabel={t('footer.cancel', 'Cancel')}
          submitting={false}
          leftContent={
            <div className="flex gap-2">

              {/* Кнопку Test filters временно отключили, чтобы не путать пользователей
              <button
                type="button"
                onClick={handleTestFilters}
                className="h-10 px-4 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              >
                {t("footer.testFilters", "Test filters")}
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
                {t("footer.resetFilters", "Reset filters")}
              </button>
            </div>
          }
        />
      </div>
    </form>
  );
}