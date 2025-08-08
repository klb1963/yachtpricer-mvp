import { useTranslation } from 'react-i18next';

export default function DashboardPage() {
  const { t, i18n } = useTranslation();
  return (
    <div className="max-w-4xl mx-auto py-16 text-center">
      <h1 className="text-4xl font-bold">
        {t('app.title', { version: '0.02' })}
      </h1>
      <p className="text-gray-500 mt-4">{t('app.subtitle')}</p>

      <button
        className="mt-8 px-3 py-1 border rounded hover:bg-gray-50"
        onClick={() => i18n.changeLanguage(i18n.language === 'en' ? 'ru' : 'en')}
      >
        {t('actions.changeLang')}
      </button>
    </div>
  );
}