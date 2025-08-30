import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './i18n'

import { ClerkProvider } from '@clerk/clerk-react'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
  throw new Error('Missing Clerk publishable key')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      appearance={{
        variables: {
          colorPrimary: '#1976d2',
          colorBackground: '#ffffff',
          colorText: '#111827',                 // базовый текст
          colorTextSecondary: '#374151',        // вторичный
          colorNeutral: '#111827',              // для ghost/neutral кнопок
          colorTextOnPrimaryBackground: '#ffffff',
        },
        elements: {
          userButtonPopoverCard: {
            backgroundColor: '#ffffff',
            color: '#111827',
            boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
            borderRadius: '12px',
            zIndex: 9999,
          },
          userButtonPopoverActionButtonText: {
            color: '#111827',
            fontWeight: 500,
          },
          userButtonPopoverActionButtonIcon: {
            color: '#374151',
          },
          userButtonPopoverFooter: {
            color: '#6b7280',
          },
        },
      }}
    >
      <App />
    </ClerkProvider>
  </React.StrictMode>
)
