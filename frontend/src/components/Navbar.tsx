// frontend/src/components/Navbar.tsx
import { UserButton } from "@clerk/clerk-react";
import { Link, NavLink } from "react-router-dom";
import { useWhoami } from "@/hooks/useWhoami"; // ← алиас @

// Небольшая утилита для классов (если у тебя уже есть cn — можно использовать её)
function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function Navbar() {
  const { whoami, loading } = useWhoami();

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cx(
      // компактнее на мобильном
      "px-2 py-1.5 md:px-3 md:py-2 rounded-md text-sm font-medium transition-colors",
      isActive
        ? "bg-white text-blue-600 shadow-sm"
        : "text-white/90 hover:text-white hover:bg-blue-500/50"
    );

  return (
    <nav className="sticky top-0 z-20 bg-blue-500 text-white">
      <div className="mx-auto flex h-14 max-w-screen-xl items-center gap-2 px-3 sm:px-4">
       
        {/* Logo */}
        <Link
          to="/"
          className="flex items-center gap-2 min-w-0 truncate font-bold text-lg leading-none no-underline"
        >
          <img
            src="/logo.svg"
            alt="YachtPricer"
            className="h-10 w-10"
          />
          <span className="hidden sm:inline text-white">YP</span>
        </Link>

        {/* Nav links */}
        <div
          className={cx(
            // даём меню занять доступную ширину и скроллиться по горизонтали на узких экранах
            'flex-1 flex items-center gap-1 overflow-x-auto whitespace-nowrap',
            // чуть смещаем визуально от бренда
            'pl-1'
          )}
        >
          {[
            { to: '/dashboard', label: 'Dashboard' },
            { to: '/pricing', label: 'Pricing' },
            { to: '/organization', label: 'Organization' },
          ].map(({ to, label }) => (
            <NavLink key={to} to={to} className={navLinkClass}>
              {label}
            </NavLink>
          ))}

          {/* ADMIN-only */}
          {loading ? (
            // маленький плейсхолдер, чтобы не мигало
            <span className="px-2 py-1.5 md:px-3 md:py-2 rounded-md text-sm text-white/70 select-none">
              …
            </span>
          ) : whoami?.role === 'ADMIN' ? (
            <NavLink to="/admin/users" className={navLinkClass}>
              Users
            </NavLink>
          ) : null}
        </div>

        {/* User (не даём аватару сжиматься, держим справа) */}
        <div className="shrink-0">
          <UserButton
            appearance={{
              elements: {
                // компактный аватар, чтобы не «давил» меню
                avatarBox: { width: '60px', height: '60px' },
              },
            }}
            afterSignOutUrl="/"
          />
        </div>
      </div>
    </nav>
  )
}