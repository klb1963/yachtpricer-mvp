// frontend/src/components/yacht/YachtPricingSection.tsx
import type { TFunction } from 'i18next';
import { Legend } from '../../form/Legend';
import type { Yacht } from '../../../api';
import { Field } from '../../form/Field';

type Props = {
  basePrice: string;
  maxDiscountPct: string;
  onBasePriceChange: (value: string) => void;
  onMaxDiscountPctChange: (value: string) => void;
  yacht: Yacht | null;
  t: TFunction<'yacht'>;
};

export function YachtPricingSection({
  basePrice,
  maxDiscountPct,
  onBasePriceChange,
  onMaxDiscountPctChange,
  yacht,
  t,
}: Props) {
  return (
    <fieldset className="rounded-2xl border p-5">
      <Legend>{t('sections.pricing')}</Legend>
      <div className="grid gap-4 md:grid-cols-3">
        {/* Base price */}
        <Field
          label={t('fields.basePrice')}
          value={basePrice}
          onChange={(e) => onBasePriceChange(e.target.value)}
        />

        {/* Max discount */}
        <label className="flex flex-col">
          <span className="text-sm text-gray-600">{t('fields.maxDiscountPct')}</span>
          <input
            className="mt-1 rounded border p-2"
            type="number"
            inputMode="decimal"
            step="1"
            min="0"
            max="100"
            placeholder="—"
            value={maxDiscountPct}
            onChange={(e) => onMaxDiscountPctChange(e.target.value)}
          />
        </label>

        {/* read-only actuals for context */}
        <label className="flex flex-col">
          <span className="text-sm text-gray-600">{t('fields.actualPrice')}</span>
          <input
            className="mt-1 rounded border p-2 bg-gray-50"
            readOnly
            value={yacht?.actualPrice != null ? String(yacht.actualPrice) : '—'}
          />
        </label>

        <label className="flex flex-col">
          <span className="text-sm text-gray-600">{t('fields.actualDiscount')}</span>
          <input
            className="mt-1 rounded border p-2 bg-gray-50"
            readOnly
            value={
              yacht?.actualDiscountPct != null
                ? String(yacht.actualDiscountPct) + '%'
                : '—'
            }
          />
        </label>
      </div>

      <div className="mt-3 text-xs text-gray-500">
        {t('fields.fetchedAt')}:{' '}
        {yacht?.fetchedAt ? new Date(yacht.fetchedAt).toLocaleString() : '—'}
      </div>
    </fieldset>
  );
}