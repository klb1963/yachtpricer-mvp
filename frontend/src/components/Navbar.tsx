// frontend/src/components/Navbar.tsx
import { UserButton } from "@clerk/clerk-react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useWhoami } from "@/hooks/useWhoami";
import { useTranslation } from "react-i18next";

// Простая утилита для классов
function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

// Основные пункты навигации
const MAIN_ITEMS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/pricing", label: "Pricing" },
] as const;

// Языки
const LANG_ITEMS = [
  { code: "en", label: "EN" },
  { code: "ru", label: "RU" },
  { code: "hr", label: "HR" },
] as const;

export default function Navbar() {
  const { whoami } = useWhoami();
  const location = useLocation();
  const { i18n } = useTranslation();

  // сохраняем текущие query-параметры (view/week/source и т.п.)
  const search = location.search || "";

  // нормализуем язык (en-US → en, ru-RU → ru и т.д.)
  const rawLang = (i18n.language || "en").toLowerCase();
  const currentLang =
    rawLang.startsWith("ru") ? "ru" : rawLang.startsWith("hr") ? "hr" : "en";

  const handleChangeLang = (code: string) => {
    if (code !== currentLang) {
      i18n.changeLanguage(code);
    }
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cx(
      "px-2 py-1.5 md:px-3 md:py-2 rounded-md text-sm font-medium transition-colors",
      isActive
        ? "bg-white text-blue-600 shadow-sm"
        : "text-white/90 hover:text-white hover:bg-blue-500/50"
    );

  return (
    <header className="sticky top-0 z-20 bg-blue-500 text-white">
      <nav
        className="mx-auto flex h-14 max-w-screen-xl items-center gap-2 px-3 sm:px-4"
        aria-label="Main navigation"
      >
        {/* Logo / brand */}
        <Link
          to="/"
          className="flex items-center gap-2 min-w-0 truncate font-bold text-lg leading-none no-underline"
        >
          <img src="/logo.svg" alt="YachtPricer logo" className="h-10 w-10" />
          <span className="hidden sm:inline text-white">YP</span>
        </Link>

        {/* Навигация: занимает всё доступное пространство, скроллится по оси X на мобильном */}
        <div
          className={cx(
            "flex-1 flex items-center gap-1 overflow-x-auto whitespace-nowrap",
            "pl-1"
          )}
        >
          {MAIN_ITEMS.map(({ to, label }) => (
            <NavLink key={to} to={`${to}${search}`} className={navLinkClass}>
              {label}
            </NavLink>
          ))}
        </div>

        {/* Правый блок: переключатель языка + аватар */}
        <div className="flex items-center gap-2">
          {/* Language switcher */}
          <div className="flex items-center gap-1 rounded-full bg-blue-400/40 px-1 py-0.5 text-xs">
            {LANG_ITEMS.map(({ code, label }) => {
              const active = currentLang === code;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => handleChangeLang(code)}
                  className={cx(
                    "px-2 py-0.5 rounded-full transition-colors",
                    active
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-white/80 hover:bg-blue-500/70"
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* User avatar / menu */}
          <div className="shrink-0 mt-1">
            <UserButton
              appearance={{
                elements: {
                  avatarBox: { width: "60px", height: "60px" },
                },
              }}
              afterSignOutUrl="/"
            >
              {/* Дополнительные пункты меню в дропдауне Clerk */}
              <UserButton.MenuItems>
                <UserButton.Link
                  label="Organisation"
                  href={`/organization${search}`}
                  labelIcon="🏢"
                />
                {whoami?.role === "ADMIN" && (
                  <UserButton.Link
                    label="Users"
                    href={`/admin/users${search}`}
                    labelIcon="👥"
                  />
                )}
              </UserButton.MenuItems>
            </UserButton>
          </div>
        </div>
      </nav>
    </header>
  );
}