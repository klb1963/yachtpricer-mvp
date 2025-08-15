import { UserButton } from '@clerk/clerk-react'
import { Link } from 'react-router-dom'

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
      }}
    >
      <Link
        to="/"
        style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'white', textDecoration: 'none' }}
      >
        ⛵ YachtPricer 💲
      </Link>

      <UserButton
        appearance={{
          elements: {
            avatarBox: {
              width: '60px',
              height: '60px',
            },
          },
        }}
      />
    </nav>
  )
}
