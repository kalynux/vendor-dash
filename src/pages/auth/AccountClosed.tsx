import { Button } from '@/components/ui/button';
import { AppLogo } from '@/components/layout/AppLogo';
import { useTranslation } from '@/i18n';
import { storefrontUrl } from '@/lib/storefront/urls';

/**
 * Where the vendor lands after closing their shop when it was the last role on
 * their account — the whole account closed with it (ADR-A10, `accountClosed:
 * true`). There is nothing to sign in to, so unlike `/login` this offers no
 * sign-in: only the way out to the main site. Public, no session needed.
 */
export function AccountClosed() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4 pt-[calc(1rem+env(safe-area-inset-top))] dark:from-background dark:to-muted/30">
      <div className="max-w-sm space-y-4 text-center">
        <AppLogo alt="Wi-Mall" className="mx-auto size-20" />
        <h1 className="text-2xl font-bold">{t('account.closure.closed.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('account.closure.closed.body')}</p>
        <Button asChild variant="outline" className="h-11 w-full">
          <a href={storefrontUrl('/')}>{t('account.closure.closed.action')}</a>
        </Button>
      </div>
    </div>
  );
}
