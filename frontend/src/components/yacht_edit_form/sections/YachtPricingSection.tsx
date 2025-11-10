// frontend/src/components/yacht/YachtPricingSection.tsx
import type { TFunction } from 'i18next';
import { Legend } from '../../form/Legend';
import type { Yacht } from '../../../api';
import { Field } from '../../form/Field';

type Props = {
  // ⚠️ теперь трактуем как "Last minute base price"
  basePrice: string;
  maxDiscountPct: string; // оставили в пропсах, но не редактируем здесь
  onBasePriceChange: (value: string) => void;
  onMaxDiscountPctChange: (value: string) => void; // не используется, но оставляем для совместимости
  yacht: Yacht | null;
  t: TFunction<'yacht'>;
};

export function YachtPricingSection({
  basePrice,
  maxDiscountPct,       // eslint-disable-line @typescript-eslint/no-unused-vars
  onBasePriceChange,
  onMaxDiscountPctChange, // eslint-disable-line @typescript-eslint/no-unused-vars
  yacht,
  t,
}: Props) {
  // базовая цена по выбранной неделе (read-only)
  const readonlyBasePrice = (() => {
    if (!yacht) return '—';
    const p =
      yacht.currentBasePrice != null
        ? yacht.currentBasePrice
        : typeof yacht.basePrice === 'string'
          ? Number(yacht.basePrice)
          : (yacht.basePrice as number | undefined);

    if (p == null || !Number.isFinite(p)) return '—';
    return String(Math.round(p));
  })();

  const currentDiscount =
    yacht?.currentDiscountPct != null && Number.isFinite(yacht.currentDiscountPct)
      ? `${yacht.currentDiscountPct}%`
      : '—';

  const maxDiscount =
    yacht?.maxDiscountPct != null && Number.isFinite(yacht.maxDiscountPct)
      ? `${yacht.maxDiscountPct}%`
      : maxDiscountPct
        ? `${maxDiscountPct}%`
        : '—';

  const updatedAtIso = yacht?.currentPriceUpdatedAt ?? yacht?.fetchedAt ?? null;
  const updatedAtStr =
    updatedAtIso != null
      ? new Date(updatedAtIso).toLocaleString()
      : '—';

  return (
    <fieldset className="rounded-2xl border p-5">
      <Legend>{t('sections.pricing')}</Legend>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Базовая цена (read-only, из WeekSlot/basePrice) */}
        <label className="flex flex-col">
          <span className="text-sm text-gray-600">
            {t('fields.basePrice', 'Base price')}
          </span>
          <input
            className="mt-1 rounded border p-2 bg-gray-50"
            readOnly
            value={readonlyBasePrice}
          />
        </label>

        {/* Текущая скидка (read-only) */}
        <label className="flex flex-col">
          <span className="text-sm text-gray-600">
            {t('fields.currentDiscountPct', 'Current discount')}
          </span>
          <input
            className="mt-1 rounded border p-2 bg-gray-50"
            readOnly
            value={currentDiscount}
          />
        </label>

        {/* Максимальная скидка (read-only) */}
        <label className="flex flex-col">
          <span className="text-sm text-gray-600">
            {t('fields.maxDiscountPct', 'Max. discount %')}
          </span>
          <input
            className="mt-1 rounded border p-2 bg-gray-50"
            readOnly
            value={maxDiscount}
          />
        </label>

        {/* Last minute base price — единственное редактируемое поле */}
        <Field
          label={t('fields.lastMinuteBasePrice', 'Last minute base price')}
          value={basePrice}
          onChange={(e) => onBasePriceChange(e.target.value)}
        />
      </div>

      <div className="mt-3 text-xs text-gray-500">
        {t('pricing.priceUpdatedAt', 'Price updated at')}: {updatedAtStr}
      </div>
    </fieldset>
  );
}