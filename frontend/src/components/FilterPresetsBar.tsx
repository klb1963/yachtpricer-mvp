// frontend/src/components/FilterPresetsBar.tsx

import Select from "react-select";
import { useTranslation } from "react-i18next";
import type { FilterPreset } from "../api";

type Option = { value: string; label: string };

export type FilterPresetsBarProps = {
  presets: FilterPreset[];
  activePresetId: string | null;
  loading?: boolean;
  onSelectPreset: (id: string | null) => void;
  onSaveCurrentAsPreset: () => void;
  onDeletePreset: (id: string) => void;
};

export default function FilterPresetsBar({
  presets,
  activePresetId,
  loading,
  onSelectPreset,
  onSaveCurrentAsPreset,
  onDeletePreset,
}: FilterPresetsBarProps) {
  const { t } = useTranslation("competitors");

  const options: Option[] = presets.map((p) => ({
    value: p.id,
    label: p.name,
  }));

  const selected = options.find((opt) => opt.value === activePresetId) ?? null;

  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-col gap-1 flex-1">
        <span className="text-sm font-medium text-gray-700">
          {t("presets.label", "Presets")}
        </span>
        <Select<Option, false>
          isClearable
          isDisabled={loading}
          options={options}
          value={selected}
          onChange={(opt) => onSelectPreset(opt?.value ?? null)}
          placeholder={
            loading
              ? t("loading", "Loading…")
              : options.length
              ? t("presets.placeholder", "Select preset")
              : t("presets.noPresets", "— no presets yet —")
          }
          classNamePrefix="rs"
        />
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onSaveCurrentAsPreset}
          className="px-3 py-1.5 text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50"
        >
          {t("presets.saveAs", "Save current as preset")}
        </button>

        <button
          type="button"
          disabled={!activePresetId}
          onClick={() => activePresetId && onDeletePreset(activePresetId)}
          className={`px-3 py-1.5 text-sm rounded-md border ${
            activePresetId
              ? "border-red-300 text-red-700 bg-white hover:bg-red-50"
              : "border-gray-200 text-gray-300 cursor-not-allowed bg-white"
          }`}
        >
          {t("presets.delete", "Delete preset")}
        </button>
      </div>
    </div>
  );
}