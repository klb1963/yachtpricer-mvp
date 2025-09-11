import { UserButton } from "@clerk/clerk-react";
import { Link, NavLink } from "react-router-dom";

export default function Navbar() {
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
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              [
                "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-white text-blue-600 shadow-sm" // активная вкладка
                  : "text-white/90 hover:text-white hover:bg-blue-500/50", // обычная
              ].join(" ")
            }
          >
            {label}
          </NavLink>
        ))}
      </div>

      {/* User */}
      <UserButton
        appearance={{
          elements: {
            avatarBox: { width: "60px", height: "60px" },
          },
        }}
      />
    </nav>
  );
}