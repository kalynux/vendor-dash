import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { StoreProvider } from '@/store'
import { I18nProvider } from '@/i18n'
import { hideSplashWhenPainted } from '@/platform/shell/splash'

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

// Native only — a no-op in a browser, so the web build is untouched. Must come
// after render() so there is a commit for the second rAF to land behind
// (CAPACITOR-PLAN.md → P2.9).
hideSplashWhenPainted()
