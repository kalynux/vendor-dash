import { useLocation } from 'react-router-dom';
import { Store } from 'lucide-react';

import { useTranslation } from '@/i18n';
import { readSignedOutNotice } from '@/lib/signed-out-notice';

/**
 * "Your shop is closed" on the sign-in screen — after the vendor closed it
 * here, or when a session opened before the closure was refused with
 * `AUTH_ROLE_CLOSED`. Without it, being signed out reads as an ordinary
 * expired session. Router state only, so it never survives a reload.
 */
export function ShopClosedNotice() {
  const { t } = useTranslation();
  const { state } = useLocation();
  if (readSignedOutNotice(state) !== 'shopClosed') return null;

  return (
    <p
      role="status"
      className="flex items-start gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left text-sm"
    >
      <Store className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <span>{t('account.closure.signedOut')}</span>
    </p>
  );
}
