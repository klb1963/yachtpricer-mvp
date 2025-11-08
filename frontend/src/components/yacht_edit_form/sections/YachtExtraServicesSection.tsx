// frontend/src/components/yacht/YachtExtraServicesSection.tsx
import type { TFunction } from 'i18next';
import { Legend } from '../../form/Legend';

type Props = {
  value: string;
  onChange: (value: string) => void;
  t: TFunction<'yacht'>;
};

export function YachtExtraServicesSection({ value, onChange, t }: Props) {
  return (
    <fieldset className="rounded-2xl border p-5">
      <Legend>{t('sections.extraServices')}</Legend>
      <textarea
        className="mt-1 w-full rounded border p-2 font-mono text-sm"
        rows={6}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="mt-1 text-xs text-gray-500">
        {t(
          'hints.extraServicesJsonHint',
          'Можно оставить строкой — сервер сам сохранит.',
        )}
      </p>
    </fieldset>
  );
}