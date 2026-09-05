import { Button } from '@/components/ui/button';
import { AppLogo } from '@/components/layout/AppLogo';
import { useTranslation } from '@/i18n';
import { storefrontUrl } from '@/lib/storefront/urls';
import { useBearerAuth } from '@/platform/env';
import { Login } from './Login';

export { Register } from './Register';
export { ForgotPassword } from './ForgotPassword';
export { ResetPassword } from './ResetPassword';
// `ConfirmEmailChange` is GONE — the main site serves /account/confirm-email for
// all four apps. See the note where its route used to be in App.tsx.

/**
 * The web build's sign-in card — what `/login` has always rendered.
 *
 * Authentication happens on the main site (wi-mall.com in production) and this
 * dashboard inherits the session cookie, so there has never been a form here.
 * The destination is derived from `VITE_STOREFRONT_BASE_URL` rather than
 * hardcoded, so a deployed build sends the vendor to the real sign-in page
 * instead of a dev server that isn't there.
 */
function WebLoginRedirect() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-background dark:to-muted/30 flex items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-sm">
        <AppLogo alt="Wi-Mall" className="w-20 h-20 mx-auto" />
        <h1 className="text-2xl font-bold">{t('auth.web.title')}</h1>
        <p className="text-muted-foreground text-sm">{t('auth.web.description')}</p>
        <Button asChild className="h-11 w-full">
          <a href={storefrontUrl('/login')}>{t('auth.web.goToLogin')}</a>
        </Button>
      </div>
    </div>
  );
}

/**
 * Which sign-in the app shows.
 *
 * ── Why the web keeps its redirect ────────────────────────────────────────────
 *
 * A packaged app has nowhere to come back to: the main site would set a cookie
 * on an origin the WebView is not, so it signs in for itself. The web build has
 * a working flow that predates all of this, and the rule for the mobile work is
 * that the browser stays the control group — so it is left exactly as it was.
 *
 * Moving the web onto the in-app form is a one-line change here, and the form
 * already works on the cookie transport (`/auth/login` sets cookies just as the
 * main site's does). It is a product decision — whether the marketing site
 * remains the front door — rather than a technical blocker, which is why it is
 * a switch and not a rewrite.
 */
export function LoginScreen() {
  return useBearerAuth ? <Login /> : <WebLoginRedirect />;
}
