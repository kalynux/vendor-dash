import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { StoreProvider } from '@/store'
import { I18nProvider } from '@/i18n'
import { hideSplashWhenPainted } from '@/platform/shell/splash'
import { initStatusBar } from '@/platform/shell/statusBar'
import { initKeyboard } from '@/platform/shell/keyboard'
import { installExternalLinkInterceptor } from '@/platform/browser'
import { isNative } from '@/platform/env'

// Opts the document into the native-only touch rules in index.css (see its
// 'Touch behaviour' block). Suppressing the tap flash and the double-tap-zoom
// delay is right on the web too, so those are unscoped; killing pull-to-refresh
// and text selection is not, so those hang off this class. Set before render so
// the first painted frame already has them.
if (isNative) document.documentElement.classList.add('native')

// Native shell behaviour (CAPACITOR-PLAN.md → Phase 3). All three are no-ops
// off native, and all three run BEFORE render: the system bars should already
// match the theme in the first painted frame, the keyboard listeners should
// exist before a screen can focus a field, and a link should never be able to
// navigate the WebView away — not even one clicked during the first second.
initStatusBar()
initKeyboard()
installExternalLinkInterceptor()

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
