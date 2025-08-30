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

            // Карточка поповера: задаём общий цвет текста и фон
            userButtonPopoverCard: {
              backgroundColor: '#ffffff',
              color: '#111827',      // <- главный фикс: тёмный базовый цвет внутри поповера
              boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
              borderRadius: 12,
              zIndex: 9999,
            },

            // Иконки строк
            userButtonPopoverActionButtonIcon: { color: '#374151' },

            // Текст строк
            userButtonPopoverActionButtonText: {
              color: '#111827',      // <- принудительно тёмный текст
              fontWeight: 500,
            },

            // Ховер строки
            userButtonPopoverActionButton: {
              backgroundColor: 'transparent',
            },
            userButtonPopoverActionButton__hover: {
              backgroundColor: '#f3f4f6',
            },

            // Футер
            userButtonPopoverFooter: { color: '#6b7280' },
          },
        }}
      />
    </nav>
  );
}