import { UserButton } from "@clerk/clerk-react";
import { Link, NavLink } from "react-router-dom";
import { useWhoami } from "../hooks/useWhoami";

export default function Navbar() {
  const { whoami, loading } = useWhoami();

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    [
      "px-3 py-2 rounded-md text-sm font-medium transition-colors",
      isActive
        ? "bg-white text-blue-600 shadow-sm"
        : "text-white/90 hover:text-white hover:bg-blue-500/50",
    ].join(" ");

  return (
    <nav className="flex justify-between items-center px-4 py-2 bg-blue-500 sticky top-0 z-10">
      {/* Brand */}
      <Link to="/" className="font-bold text-lg text-white no-underline">
        ⛵ YP
      </Link>

      {/* Nav links */}
      <div className="flex gap-1">
        {[
          { to: "/dashboard", label: "Dashboard" },
          { to: "/pricing", label: "Pricing" },
          { to: "/organization", label: "Organization" },
        ].map(({ to, label }) => (
          <NavLink key={to} to={to} className={navLinkClass}>
            {label}
          </NavLink>
        ))}

        {/* 👇 условная ссылка для ADMIN */}
        {!loading && whoami?.role === "ADMIN" && (
          <NavLink to="/admin/users" className={navLinkClass}>
            Users
          </NavLink>
        )}
      </div>

      {/* User */}
      <UserButton
        appearance={{
          elements: { avatarBox: { width: "60px", height: "60px" } },
        }}
      />
    </nav>
  );
}
