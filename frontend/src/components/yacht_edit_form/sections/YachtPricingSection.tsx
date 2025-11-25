// frontend/src/components/yacht/YachtPricingSection.tsx
import type { TFunction } from 'i18next';
import { Legend } from '../../form/Legend';
import type { Yacht } from '../../../api';
import { Field } from '../../form/Field';

type Props = {
  // Стартовая базовая цена яхты (записывается в Yacht.basePrice)
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

        {/* Max discount — логика как у Starting base price */}
        {yacht == null ? (
          <Field
            label={t('fields.maxDiscountPct', 'Max. discount %') + ' *'}
            value={maxDiscountPct}
            onChange={(e) => onMaxDiscountPctChange(e.target.value)}
          />
        ) : (
          <label className="flex flex-col">
            <span className="text-sm text-gray-600">
              {t('fields.maxDiscountPct', 'Max. discount %')}
            </span>
            <input
              className="mt-1 rounded border p-2 bg-gray-50 text-gray-500 cursor-not-allowed"
              readOnly
              value={maxDiscount}
            />
            <span className="mt-1 text-xs text-gray-400">
              {t(
                'pricing.maxDiscountHint',
                'This value is set only when creating the yacht and cannot be changed later.'
              )}
            </span>
          </label>
        )}

      </div>

      <div className="mt-3 text-xs text-gray-500">
        {t('pricing.priceUpdatedAt', 'Price updated at')}: {updatedAtStr}
      </div>

      {/* Starting base price:
            - при создании яхты (yacht == null) — редактируемое поле
            - при редактировании существующей — только read-only */}
      {yacht == null ? (
        <div className="mt-4 max-w-xs">
          <Field
            label={t('fields.startingBasePrice', 'Starting base price')}
            value={basePrice}
            onChange={(e) => onBasePriceChange(e.target.value)}
          />
        </div>
      ) : (
        <div className="mt-4 max-w-xs">
          <label className="flex flex-col">
            <span className="text-sm text-gray-600">
              {t('fields.startingBasePrice', 'Starting base price')}
            </span>
            <input
              className="mt-1 rounded border p-2 bg-gray-50 text-gray-500 cursor-not-allowed"
              readOnly
              value={basePrice}
            />
            <span className="mt-1 text-xs text-gray-400">
              {t(
                'pricing.startingBasePriceHint',
                'This value is set only when creating the yacht and cannot be changed later.',
              )}
            </span>
          </label>
        </div>
      )}
    </fieldset>
  );
}