// frontend/src/components/FilterPresetsBar.tsx

import Select from "react-select";
import type { FilterPreset } from "../api";

type Option = { value: string; label: string };

export type FilterPresetsBarProps = {
  presets: FilterPreset[];
  activePresetId: string | null;
  loading?: boolean;
  // вызывается при выборе пресета в выпадашке
  onSelectPreset: (id: string | null) => void;
  // сохранить текущие фильтры как новый пресет
  onSaveCurrentAsPreset: () => void;
  // удалить выбранный пресет
  onDeletePreset: (id: string) => void;
};

const t = {
  presets: "Presets",
  noPresets: "— no presets yet —",
  saveAs: "Save current as preset",
  delete: "Delete preset",
};

export default function FilterPresetsBar({
  presets,
  activePresetId,
  loading,
  onSelectPreset,
  onSaveCurrentAsPreset,
  onDeletePreset,
}: FilterPresetsBarProps) {
  const options: Option[] = presets.map((p) => ({
    value: p.id,
    label: p.name,
  }));

  const selected =
    options.find((opt) => opt.value === activePresetId) ?? null;

  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-col gap-1 flex-1">
        <span className="text-sm font-medium text-gray-700">
          {t.presets}
        </span>
        <Select<Option, false>
          isClearable
          isDisabled={loading}
          options={options}
          value={selected}
          onChange={(opt) => onSelectPreset(opt?.value ?? null)}
          placeholder={
            loading ? "Loading…" : options.length ? t.presets : t.noPresets
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
          {t.saveAs}
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
          {t.delete}
        </button>
      </div>
    </div>
  );
}

