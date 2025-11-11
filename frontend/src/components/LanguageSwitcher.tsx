// frontend/src/components/LanguageSwitcher.tsx

import { useTranslation } from "react-i18next";

const LANGS = [
  { code: "en", label: "EN" },
  { code: "ru", label: "RU" },
  { code: "hr", label: "HR" },
];

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  // из-за load: 'languageOnly' у тебя будут "en", "ru", "hr"
  const current = i18n.language;

  return (
    <select
      className="rounded-md bg-slate-900/60 border border-slate-700 px-2 py-1 text-xs text-slate-100"
      value={current}
      onChange={(e) => {
        const lng = e.target.value;
        i18n.changeLanguage(lng);
      }}
    >
      {LANGS.map((lng) => (
        <option key={lng.code} value={lng.code}>
          {lng.label}
        </option>
      ))}
    </select>
  );
}