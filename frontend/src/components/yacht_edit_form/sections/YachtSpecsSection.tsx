// frontend/src/components/yacht/YachtSpecsSection.tsx
import type { TFunction } from 'i18next';
import { Legend } from '../../form/Legend';

type SpecsField = 'length' | 'builtYear' | 'cabins' | 'heads';

type Props = {
  values: {
    length: string;
    builtYear: string;
    cabins: string;
    heads: string;
  };
  onChange: (field: SpecsField, value: string) => void;
  t: TFunction<'yacht'>;
};

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

const CURRENT_YEAR = new Date().getFullYear();
const LENGTH_OPTIONS = range(5, 100);      // feet
const BUILT_YEAR_OPTIONS = range(1990, CURRENT_YEAR + 2);
const CABINS_OPTIONS = range(2, 12);
const HEADS_OPTIONS = range(1, 12);

export function YachtSpecsSection({ values, onChange, t }: Props) {
  return (
    <fieldset className="grid gap-4 rounded-2xl border p-5 md:grid-cols-3">
      <Legend>{t('sections.specs')}</Legend>

      {/* Length */}
      <label className="flex flex-col">
        <span className="text-sm text-gray-600">
          {t('fields.length')} ({t('units.feet', 'feet')})
        </span>
        <select
          className="mt-1 rounded border p-2 bg-white"
          value={values.length}
          onChange={(e) => onChange('length', e.target.value)}
        >
          <option value="" disabled>
            {t('placeholders.chooseLength', 'Choose length…')}
          </option>
          {LENGTH_OPTIONS.map((n) => (
            <option key={n} value={String(n)}>
              {n}
            </option>
          ))}
        </select>
      </label>

      {/* Built year */}
      <label className="flex flex-col">
        <span className="text-sm text-gray-600">{t('fields.built')}</span>
        <select
          className="mt-1 rounded border p-2 bg-white"
          value={values.builtYear}
          onChange={(e) => onChange('builtYear', e.target.value)}
        >
          <option value="" disabled>
            {t('placeholders.chooseYear', 'Choose year…')}
          </option>
          {[...BUILT_YEAR_OPTIONS].reverse().map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </select>
      </label>

      {/* Cabins */}
      <label className="flex flex-col">
        <span className="text-sm text-gray-600">{t('fields.cabins')}</span>
        <select
          className="mt-1 rounded border p-2 bg-white"
          value={values.cabins}
          onChange={(e) => onChange('cabins', e.target.value)}
        >
          <option value="" disabled>
            {t('placeholders.chooseCabins', 'Choose cabins…')}
          </option>
          {CABINS_OPTIONS.map((n) => (
            <option key={n} value={String(n)}>
              {n}
            </option>
          ))}
        </select>
      </label>

      {/* Heads */}
      <label className="flex flex-col">
        <span className="text-sm text-gray-600">{t('fields.heads')}</span>
        <select
          className="mt-1 rounded border p-2 bg-white"
          value={values.heads}
          onChange={(e) => onChange('heads', e.target.value)}
        >
          <option value="" disabled>
            {t('placeholders.chooseHeads', 'Choose heads…')}
          </option>
          {HEADS_OPTIONS.map((n) => (
            <option key={n} value={String(n)}>
              {n}
            </option>
          ))}
        </select>
      </label>
    </fieldset>
  );
}