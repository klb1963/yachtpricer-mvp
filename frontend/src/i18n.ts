// /frontend/src/i18n.ts

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import HttpBackend from 'i18next-http-backend'

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    debug: false,
    // грузим только код языка (en, ru, hr), без регионов типа en-US
    load: 'languageOnly',
    supportedLngs: ['en', 'ru', 'hr'],

    // включаем namespaces: базовый translation и наш pricing
    ns: ['translation', 'pricing', 'yacht', 'home'],
    defaultNS: 'translation',

    interpolation: { escapeValue: false },
    backend: {
      // позволяем грузить любой namespace
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    detection: {
      order: ['querystring', 'localStorage', 'navigator'],
      caches: ['localStorage'],
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
