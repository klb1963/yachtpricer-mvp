// frontend/src/components/Navbar.tsx

import { UserButton } from "@clerk/clerk-react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useWhoami } from "@/hooks/useWhoami";
import LanguageSwitcher from "./LanguageSwitcher";

// Простая утилита для классов
function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const MAIN_ITEMS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/pricing", label: "Pricing" },
] as const;

export default function Navbar() {
  const { whoami } = useWhoami();
  const location = useLocation();
  const search = location.search || "";

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
        {/* Logo */}
        <Link
          to="/"
          className="flex items-center gap-2 min-w-0 truncate font-bold text-lg leading-none no-underline"
        >
          <img src="/logo.svg" alt="YachtPricer logo" className="h-10 w-10" />
          <span className="hidden sm:inline text-white">YP</span>
        </Link>

        {/* Навигация */}
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

        {/* Справа: выбор языка + аватар */}
        <div className="flex items-center gap-3 shrink-0 mt-[3px]">
          {/* 🌐 Language switcher */}
          <LanguageSwitcher />

          {/* 👤 User avatar / menu */}
          <UserButton
            appearance={{
              elements: {
                avatarBox: { width: "50px", height: "50px" },
              },
            }}
            afterSignOutUrl="/"
          >
            <UserButton.MenuItems>
              <UserButton.Link
                label="Organisation"
                labelIcon="🏢"
                href={`/organization${search}`}
              />
              {whoami?.role === "ADMIN" && (
                <UserButton.Link
                  label="Users"
                  labelIcon="👥"
                  href={`/admin/users${search}`}
                />
              )}
            </UserButton.MenuItems>
          </UserButton>
        </div>
      </nav>
    </header>
  );
}