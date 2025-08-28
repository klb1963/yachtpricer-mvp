import { UserButton } from '@clerk/clerk-react';
import { Link, NavLink } from 'react-router-dom';

const linkStyle: React.CSSProperties = {
  color: 'white',
  textDecoration: 'none',
  padding: '0.4rem 0.75rem',
  borderRadius: '8px',
  fontWeight: 500,
};

export default function Navbar() {
  return (
    <nav
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.5rem 1rem',
        backgroundColor: '#1976d2',
        color: 'white',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      {/* Brand */}
      <Link
        to="/"
        style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'white', textDecoration: 'none' }}
      >
        ⛵ YachtPricer
      </Link>

      {/* Nav links */}
      <div style={{ display: 'flex', gap: '0.25rem' }}>
        <NavLink
          to="/dashboard"
          style={({ isActive }) => ({
            ...linkStyle,
            backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : 'transparent',
          })}
        >
          Dashboard
        </NavLink>

        <NavLink
          to="/pricing"
          style={({ isActive }) => ({
            ...linkStyle,
            backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : 'transparent',
          })}
        >
          Pricing
        </NavLink>
      </div>

      {/* User */}
      <UserButton
        appearance={{
          elements: {
            avatarBox: { width: '60px', height: '60px' },
          },
        }}
      />
    </nav>
  );
}