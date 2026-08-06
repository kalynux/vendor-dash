import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { StoreProvider } from '@/store'
import { I18nProvider } from '@/i18n'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      {/* Outermost so every screen — including login and onboarding, which
          render before a session exists — can translate. The vendor's saved
          language is applied by <SessionLocaleSync> once /auth/me resolves. */}
      <I18nProvider>
        <StoreProvider>
          <App />
        </StoreProvider>
      </I18nProvider>
    </BrowserRouter>
  </StrictMode>,
)
