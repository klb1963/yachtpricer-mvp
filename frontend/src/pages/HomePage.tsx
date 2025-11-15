// frontend/src/pages/HomePage.tsx

import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { SignedIn, SignedOut } from "@clerk/clerk-react";

export default function HomePage() {
  // 👇 используем namespace "home"
  const { t } = useTranslation("home");

  const steps = [
    t("steps.step1"),
    t("steps.step2"),
    t("steps.step3"),
    t("steps.step4"),
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-50">
      {/* Header 
      <header className="border-b border-slate-800">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-8 w-8 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-sm font-bold text-cyan-300">
              YP
            </span>
            <span className="text-lg font-semibold tracking-tight">
              {t("brand")}
            </span>
          </div>
        </div>
      </header> */}

      <main className="flex-1">
        {/* HERO */}
        <section className="border-b border-slate-800 bg-gradient-to-b from-slate-950 to-slate-900">
          <div className="mx-auto max-w-6xl px-4 py-16 lg:py-24 grid gap-10 lg:grid-cols-2 lg:items-center">
            <div className="space-y-6">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight">
                {t("hero.titleLine1")}
                <br />
                {t("hero.titleLine2")}
              </h1>
              <p className="text-lg text-slate-200">
                {t("hero.subtitle")}
              </p>

              <div className="space-y-3">
                {/* Когда пользователь НЕ залогинен — показываем Sign in */}
                <SignedOut>
                  <Link
                    to="/sign-in"
                    className="inline-flex items-center justify-center rounded-xl px-6 py-3 text-base font-medium bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition shadow-lg shadow-cyan-500/20"
                  >
                    {t("hero.ctaMain")}
                  </Link>
                </SignedOut>

                {/* Когда пользователь уже залогинен — кнопку Sign in скрываем, 
                   при желании можно заменить на "Перейти в приложение" */}
                <SignedIn>
                  <Link
                    to="/dashboard"
                    className="inline-flex items-center justify-center rounded-xl px-6 py-3 text-base font-medium bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition shadow-lg shadow-emerald-500/20"
                  >
                    {t("hero.ctaGoToApp", "Start working")}
                  </Link>
                </SignedIn>

                <div>
                  <button
                    type="button"
                    className="text-sm text-slate-300 underline underline-offset-4 hover:text-slate-100"
                    onClick={() => {
                      window.location.href =
                        "mailto:info@aquatoria-group.com?subject=YachtPricer%20доступ";
                    }}
                  >
                    {t("hero.ctaNoAccess")}
                  </button>
                </div>
              </div>

            </div>

            {/* Иллюстрация-панель */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6 lg:p-8 shadow-xl shadow-slate-950/70">
              <p className="text-sm font-medium text-cyan-300 mb-3">
                {t("hero.exampleLabel")}
              </p>
              <ol className="space-y-3 text-sm text-slate-100">
                {steps.map((text, index) => (
                  <li key={index} className="flex gap-3">
                    <span className="mt-0.5 h-6 w-6 shrink-0 rounded-full bg-slate-800 flex items-center justify-center text-xs text-cyan-300">
                      {index + 1}
                    </span>
                    <span>{text}</span>
                  </li>
                ))}
              </ol>

              <div className="mt-6 grid grid-cols-2 gap-3 text-xs text-slate-300">
                <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">
                    {t("example.historyLabel")}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-50">
                    {t("example.historyText")}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">
                    {t("example.competitorsLabel")}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-50">
                    {t("example.competitorsText")}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Как это работает */}
        <section className="border-b border-slate-800 bg-slate-950">
          <div className="mx-auto max-w-6xl px-4 py-12 lg:py-16">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-6">
              {t("steps.title")}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((text, index) => (
                <div
                  key={index}
                  className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 flex flex-col gap-2"
                >
                  <div className="h-8 w-8 rounded-xl bg-slate-800 flex items-center justify-center text-sm font-semibold text-cyan-300">
                    {index + 1}
                  </div>
                  <p className="text-sm text-slate-100">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Ключевые преимущества */}
        <section className="border-b border-slate-800 bg-slate-950">
          <div className="mx-auto max-w-6xl px-4 py-12 lg:py-16">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-6">
              {t("benefits.title")}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <h3 className="font-semibold text-slate-50 mb-1">
                  {t("benefits.integrationTitle")}
                </h3>
                <p className="text-sm text-slate-300">
                  {t("benefits.integrationText")}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <h3 className="font-semibold text-slate-50 mb-1">
                  {t("benefits.fleetTitle")}
                </h3>
                <p className="text-sm text-slate-300">
                  {t("benefits.fleetText")}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <h3 className="font-semibold text-slate-50 mb-1">
                  {t("benefits.historyTitle")}
                </h3>
                <p className="text-sm text-slate-300">
                  {t("benefits.historyText")}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <h3 className="font-semibold text-slate-50 mb-1">
                  {t("benefits.analyticsTitle")}
                </h3>
                <p className="text-sm text-slate-300">
                  {t("benefits.analyticsText")}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Для кого */}
        <section className="border-b border-slate-800 bg-slate-950">
        <div className="mx-auto max-w-6xl px-4 py-12 lg:py-16">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-6">
            {t("forWhom.title")}
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <h3 className="font-semibold text-slate-50 mb-1">
                {t("forWhom.fleetManagersTitle")}
                </h3>
                <p className="text-sm text-slate-300">
                {t("forWhom.fleetManagersText")}
                </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <h3 className="font-semibold text-slate-50 mb-1">
                {t("forWhom.ownersTitle")}
                </h3>
                <p className="text-sm text-slate-300">
                {t("forWhom.ownersText")}
                </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <h3 className="font-semibold text-slate-50 mb-1">
                {t("forWhom.companiesTitle")}
                </h3>
                <p className="text-sm text-slate-300">
                {t("forWhom.companiesText")}
                </p>
            </div>
            </div>
        </div>
        </section>

        {/* Нижний CTA */}
        <section className="bg-slate-900 border-t border-slate-800">
          <div className="mx-auto max-w-6xl px-4 py-12 lg:py-16">
            <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-cyan-500/10 via-slate-900 to-slate-900 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-semibold text-slate-50">
                  {t("ctaBottom.title")}
                </h2>
                <p className="mt-1 text-sm text-slate-200">
                  {t("ctaBottom.subtitle")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  window.location.href =
                    "mailto:info@aquatoria-group.com?subject=YachtPricer%20запрос%20доступа";
                }}
                className="inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-medium bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition shadow-lg shadow-cyan-500/20"
              >
                {t("ctaBottom.button")}
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950">
        <div className="mx-auto max-w-6xl px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
          <span>
            © {new Date().getFullYear()} {t("footer.copyright")}
          </span>
          <span className="text-[11px]">{t("footer.pilot")}</span>
        </div>
      </footer>
    </div>
  );
}