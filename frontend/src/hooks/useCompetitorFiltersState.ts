import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSearchParams } from "react-router-dom";

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
  type FilterPreset,
  type FilterPresetInput,
  listFilterPresets,
  createFilterPreset,
  deleteFilterPreset,
} from "../api";

export type Scope = "USER" | "ORG";

// DTO на сохранение — 1:1 с бэком
export type SaveDto = CompetitorFiltersDto;

// option shapes for react-select
export type CountryOpt = { value: string; label: string }; // Country.id (UUID)
export type RegionOpt = { value: number; label: string; countryId?: string };
export type LocationOpt = {
  value: string; // Location.id (UUID)
  label: string; // "HR › Split region › Marina Kaštela"
  countryId?: string | null;
  regionId?: number | null;
};
export type IdLabel = { value: number; label: string };

type CatalogRegionWithCountry = CatalogRegion & {
  country?: {
    code2?: string | null;
    name?: string | null;
  } | null;
  countryId?: string | null;
};

// ============ helpers для подписей ============
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
  const parts: string[] = [];
  if (l.country?.code2) parts.push(l.country.code2);
  if (l.regionName) parts.push(l.regionName);
  parts.push(l.name);
  return parts.join(" › ");
}

type Args = {
  scope: Scope;
  onSubmit?: (dto: SaveDto, scanSource?: "INNERDB" | "NAUSYS") => void;
  onClose?: () => void;
};

export default function useCompetitorFiltersState({
  scope,
  onSubmit,
  onClose,
}: Args) {
  // --- URL search params + scanSource ---
  const [searchParams, setSearchParams] = useSearchParams();
  const [scanSource, setScanSource] = useState<"INNERDB" | "NAUSYS">("INNERDB");

  // 1) стартовый источник: URL ?source → localStorage → дефолт
  useEffect(() => {
    const urlSource = (searchParams.get("source") || "").toUpperCase();
    const lsSource = (localStorage.getItem("competitor:scanSource") || "INNERDB").toUpperCase();

    const initial =
      urlSource === "NAUSYS" || urlSource === "INNERDB"
        ? (urlSource as "NAUSYS" | "INNERDB")
        : (lsSource === "NAUSYS" ? "NAUSYS" : "INNERDB");

    setScanSource(initial);

    if (urlSource !== initial) {
      const next = new URLSearchParams(searchParams);
      next.set("source", initial);
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) любое изменение источника → URL + localStorage
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
  const [lenFtMinus, setLenFtMinus] = useState(3);
  const [lenFtPlus, setLenFtPlus] = useState(3);
  const [yearMinus, setYearMinus] = useState(2);
  const [yearPlus, setYearPlus] = useState(2);
  const [peopleMinus, setPeopleMinus] = useState(1);
  const [peoplePlus, setPeoplePlus] = useState(1);
  const [cabinsMinus, setCabinsMinus] = useState(1);
  const [cabinsPlus, setCabinsPlus] = useState(1);
  const [headsMin, setHeadsMin] = useState(1);

  // --- GEO CASCADE STATE ---
  // Countries
  const [countries, setCountries] = useState<CountryOpt[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<CountryOpt[]>([]);

  // Regions
  const [regionsOptions, setRegionsOptions] = useState<RegionOpt[]>([]);
  const [regionsSel, setRegionsSel] = useState<RegionOpt[]>([]);
  const [regionsLoading, setRegionsLoading] = useState(false);

  // Locations
  const [locationsOptions, setLocationsOptions] = useState<LocationOpt[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<LocationOpt[]>([]);
  const [locLoading, setLocLoading] = useState(false);

  // domain selects
  const [catsSel, setCatsSel] = useState<IdLabel[]>([]);
  const [buildersSel, setBuildersSel] = useState<IdLabel[]>([]);
  const [modelsSel, setModelsSel] = useState<IdLabel[]>([]);

  // --- presets ---
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [presetsLoading, setPresetsLoading] = useState(false);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  // derived IDs
  const countryIds = useMemo(
    () => selectedCountries.map((c) => c.value),
    [selectedCountries]
  );
  const regionIds = useMemo(
    () => regionsSel.map((r) => r.value),
    [regionsSel]
  );

  const nothingSelected = useMemo(
    () =>
      selectedCountries.length === 0 &&
      selectedLocations.length === 0 &&
      catsSel.length === 0 &&
      buildersSel.length === 0 &&
      modelsSel.length === 0 &&
      regionsSel.length === 0,
    [selectedCountries, selectedLocations, catsSel, buildersSel, modelsSel, regionsSel]
  );

  // ===== 1) Countries (once) =====
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const list: Country[] = await getCountries();
        if (!active) return;
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

  // ===== 2) Regions (when countryIds change) =====
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
        const { items } = await findRegions("", {
          countryIds,
          take: 200,
        });

        if (cancelled) return;

        const regionOpts: RegionOpt[] = (items as CatalogRegionWithCountry[]).map((r) => ({
        value: r.id,
        label: makeRegionLabel({
            id: r.id,
            nameEn: r.nameEn,
            nameRu: r.nameRu,
            nameDe: r.nameDe,
            country: r.country ?? null,
        }),
        countryId: r.countryId ?? undefined,
        }));

        setRegionsOptions(regionOpts);

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

  // ===== 3) Locations (when countries OR regions change) =====
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!countryIds.length && !regionIds.length) {
        setLocationsOptions([]);
        setSelectedLocations([]);
        return;
      }

      setLocLoading(true);
      try {
        const { items } = await getLocations({
          countryIds: countryIds.length ? countryIds : undefined,
          regionIds: regionIds.length ? regionIds : undefined,
          source: "NAUSYS",
          take: 1000,
        });

        if (cancelled) return;

        const locOpts: LocationOpt[] = items.map((l) => ({
          value: l.id,
          label: makeLocationLabel({
            name: l.name,
            regionName: l.regionName ?? null,
            country: l.country ?? null,
          }),
          countryId: l.countryId ?? null,
          regionId: l.regionId ?? null,
        }));

        setLocationsOptions(locOpts);
        setSelectedLocations((prev) =>
          prev.filter((sel) => locOpts.some((opt) => opt.value === sel.value))
        );
      } catch (e) {
        console.error("Failed to load locations:", e);
        if (!cancelled) {
          setLocationsOptions([]);
          setSelectedLocations([]);
        }
      } finally {
        if (!cancelled) setLocLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [countryIds, regionIds]);

  // ===== Async loaders — категории / билдеры / модели / регионы (по строке) =====
  const loadCategories = useCallback(
    async (inputValue: string): Promise<IdLabel[]> => {
      const { items } = await findCategories(inputValue ?? "", 20);
      return items.map((c: CatalogCategory) => ({
        value: c.id,
        label: c.nameEn || c.nameRu || `#${c.id}`,
      }));
    },
    []
  );

  const loadBuilders = useCallback(
    async (inputValue: string): Promise<IdLabel[]> => {
      const { items } = await findBuilders(inputValue ?? "", 20);
      return items.map((b: CatalogBuilder) => ({
        value: b.id,
        label: b.name,
      }));
    },
    []
  );

  const loadModels = useCallback(
    async (inputValue: string): Promise<IdLabel[]> => {
      const builderId = buildersSel[0]?.value;
      const categoryId = catsSel[0]?.value;
      const { items } = await findModels(inputValue ?? "", {
        builderId,
        categoryId,
        take: 20,
      });
      return items.map((m: CatalogModel) => ({
        value: m.id,
        label: m.name,
      }));
    },
    [buildersSel, catsSel]
  );

  const loadRegionsAsync = useCallback(
    async (inputValue: string): Promise<RegionOpt[]> => {
      const needle = (inputValue || "").toLowerCase();
      return regionsOptions.filter((opt) =>
        opt.label.toLowerCase().includes(needle)
      );
    },
    [regionsOptions]
  );

  // ===== Собираем DTO =====
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
      countryIds,
      regionIds,
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
  );

  // ===== Apply & Save =====
  const handleApplySave = useCallback(async () => {
    try {
      onSubmit?.(dto, scanSource);
      await saveCompetitorFilters(dto);
      alert("Filters applied and saved.");
      onClose?.();
    } catch (e) {
      console.error("Apply & Save failed:", e);
      alert("Failed to save filters.");
    }
  }, [dto, scanSource, onSubmit, onClose]);

  // ===== Test filters =====
  const handleTestFilters = useCallback(async () => {
    try {
      const { count } = await testFiltersCount<SaveDto>(dto);
      alert(`Test scan: ${count} results`);
    } catch (e) {
      console.error("[Test filters] failed:", e);
      alert("Test failed.");
    }
  }, [dto]);

  // ===== Presets list (load) =====
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPresetsLoading(true);
      try {
        const items = await listFilterPresets();
        if (cancelled) return;
        setPresets(items);
      } catch (e) {
        console.error("[CompetitorFilters] failed to load presets:", e);
        if (!cancelled) setPresets([]);
      } finally {
        if (!cancelled) setPresetsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scope]);

  // ===== Load preset on mount (scope) =====
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const preset = await getCompetitorFilters();
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

        // countries
        const presetCountries: CountryOpt[] = (preset.countries ?? []).map(
          (c) => ({
            value: c.id,
            label: `${c.name} (${c.code2})`,
          })
        );
        setSelectedCountries(presetCountries);

        // cats / builders / models
        if (Array.isArray(preset.categories)) {
          setCatsSel(
            preset.categories.map((c) => ({
              value: c.id,
              label: c.nameEn || c.nameRu || `#${c.id}`,
            }))
          );
        }
        if (Array.isArray(preset.builders)) {
          setBuildersSel(
            preset.builders.map((b) => ({
              value: b.id,
              label: b.name,
            }))
          );
        }
        if (Array.isArray(preset.models)) {
          setModelsSel(
            preset.models.map((m) => ({
              value: m.id,
              label: m.name,
            }))
          );
        }

        // regions
        if (Array.isArray(preset.regions)) {
            const presetRegions: RegionOpt[] = (preset.regions as CatalogRegionWithCountry[]).map((r) => ({
                value: r.id,
                label: makeRegionLabel({
                id: r.id,
                nameEn: r.nameEn,
                nameRu: r.nameRu,
                nameDe: r.nameDe,
                country: r.country ?? null,
                }),
                countryId: r.countryId ?? undefined,
            }));
          setRegionsSel(presetRegions);
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

        // locations
        if (Array.isArray(preset.locations)) {
          const presetLocs: LocationOpt[] = preset.locations.map((l) => ({
            value: l.id,
            label: l.countryCode ? `${l.name} (${l.countryCode})` : l.name,
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
        console.warn("[CompetitorFilters] failed to load preset:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scope]);

  // ===== Apply preset to state =====
  const applyPresetToState = useCallback(
    (preset: FilterPreset) => {
      // numeric
      setLenFtMinus(preset.lenFtMinus ?? 3);
      setLenFtPlus(preset.lenFtPlus ?? 3);
      setYearMinus(preset.yearMinus ?? 2);
      setYearPlus(preset.yearPlus ?? 2);
      setPeopleMinus(preset.peopleMinus ?? 1);
      setPeoplePlus(preset.peoplePlus ?? 1);
      setCabinsMinus(preset.cabinsMinus ?? 1);
      setCabinsPlus(preset.cabinsPlus ?? 1);
      setHeadsMin(preset.headsMin ?? 1);

      // countries: мапим по уже загруженным options
      if (preset.countryIds?.length) {
        setSelectedCountries(
          countries.filter((c) => preset.countryIds!.includes(c.value))
        );
      } else {
        setSelectedCountries([]);
      }

      // regions: создаём простые опции по id
      if (preset.regionIds?.length) {
        const regionOpts: RegionOpt[] = preset.regionIds.map((id) => ({
          value: id,
          label: `Region #${id}`,
        }));
        setRegionsOptions((old) => {
          const merged = [...old];
          regionOpts.forEach((r) => {
            if (!merged.some((m) => m.value === r.value)) merged.push(r);
          });
          return merged;
        });
        setRegionsSel(regionOpts);
      } else {
        setRegionsSel([]);
      }

      // locations: тоже простые опции по id
      if (preset.locationIds?.length) {
        const locOpts: LocationOpt[] = preset.locationIds.map((id) => ({
          value: id,
          label: `Location #${id}`,
        }));
        setLocationsOptions((old) => {
          const merged = [...old];
          locOpts.forEach((l) => {
            if (!merged.some((m) => m.value === l.value)) merged.push(l);
          });
          return merged;
        });
        setSelectedLocations(locOpts);
      } else {
        setSelectedLocations([]);
      }

      // categories / builders / models: ставим заглушки по id
      setCatsSel(
        (preset.categoryIds ?? []).map((id) => ({
          value: id,
          label: `#${id}`,
        }))
      );
      setBuildersSel(
        (preset.builderIds ?? []).map((id) => ({
          value: id,
          label: `#${id}`,
        }))
      );
      setModelsSel(
        (preset.modelIds ?? []).map((id) => ({
          value: id,
          label: `#${id}`,
        }))
      );
    },
    [countries]
  );

  const selectPresetById = useCallback(
    (id: string | null) => {
      setActivePresetId(id);
      if (!id) return;
      const preset = presets.find((p) => p.id === id);
      if (!preset) return;
      applyPresetToState(preset);
    },
    [presets, applyPresetToState]
  );

  // ===== Reset =====
  const handleResetFilters = useCallback(async () => {
    try {
      const ok = confirm("Reset all filters?");
      if (!ok) return;

      await resetCompetitorFilters(scope);

      setSelectedCountries([]);
      setSelectedLocations([]);
      setCatsSel([]);
      setBuildersSel([]);
      setModelsSel([]);
      setRegionsSel([]);

      setLenFtMinus(3);
      setLenFtPlus(3);
      setYearMinus(2);
      setYearPlus(2);
      setPeopleMinus(1);
      setPeoplePlus(1);
      setCabinsMinus(1);
      setCabinsPlus(1);
      setHeadsMin(1);
    } catch (e) {
      console.error("Reset failed:", e);
      alert("Failed to reset filters.");
    }
  }, [scope]);

  // ===== Save current filters as preset =====
  const saveCurrentAsPreset = useCallback(async () => {
    const nameRaw = window.prompt("Preset name:");
    const name = nameRaw?.trim();
    if (!name) return;

    try {
      const input: FilterPresetInput = {
        name,
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
      };

      const created = await createFilterPreset(input);
      setPresets((prev) => [created, ...prev]);
      setActivePresetId(created.id);
      alert("Preset saved.");
    } catch (e) {
      console.error("[CompetitorFilters] failed to save preset:", e);
      alert("Failed to save preset.");
    }
  }, [
    scope,
    countryIds,
    regionIds,
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
  ]);

  // ===== Delete preset =====
  const deletePresetById = useCallback(async (id: string) => {
    const ok = window.confirm("Delete this preset?");
    if (!ok) return;
    try {
      await deleteFilterPreset(id);
      setPresets((prev) => prev.filter((p) => p.id !== id));
      setActivePresetId((cur) => (cur === id ? null : cur));
    } catch (e) {
      console.error("[CompetitorFilters] failed to delete preset:", e);
      alert("Failed to delete preset.");
    }
  }, []);

  return {
    // meta
    scanSource,
    setScanSource,

    // geo + domain
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

    // numeric
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

    // ids / dto
    countryIds,
    regionIds,
    dto,

    // loaders for AsyncSelect
    loadCategories,
    loadBuilders,
    loadModels,
    loadRegionsAsync,

    // actions
    handleApplySave,
    handleTestFilters,
    handleResetFilters,

    // ui helpers
    nothingSelected,

    // === пресеты ===
    presets,
    presetsLoading,
    activePresetId,
    selectPresetById,
    saveCurrentAsPreset,
    deletePresetById,
  };
}
