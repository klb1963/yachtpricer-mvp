

import { useTranslation } from 'react-i18next';

export default function PricingSearchBar(props: {
  q: string;
  setQ: (v: string) => void;
  onReset: () => void;
  total: number;
  filtered: number;
}) {
  const { t } = useTranslation('pricing');
  const { q, setQ, onReset, total, filtered } = props;

  return (
    <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-6">
      <input
        className="rounded border p-2 md:col-span-4"
        placeholder={t(
          'filters.searchPlaceholder',
          'Search (name, model)…',
        )}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <button
        type="button"
        onClick={onReset}
        className="rounded bg-gray-300 px-4 py-2 text-black hover:bg-gray-400 md:col-span-1"
        disabled={!q}
        title={t('filters.reset', 'Reset')}
      >
        {t('filters.reset', 'Reset')}
      </button>

      <div className="md:col-span-1 flex items-center text-sm text-gray-600">
        {filtered}/{total}
      </div>
    </div>
  );
}