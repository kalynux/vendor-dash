import { useState } from 'react';
import { Loader2 } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { useTranslation } from '@/i18n';

/**
 * "Sign out?" — the one confirmation, shared by the desktop header menu and the
 * mobile profile screen.
 *
 * ⚠ It calls **`useOnboarding().logout`**, not the legacy `useAuth().logout`
 * shim in App.tsx. The shim only routes to `/login`; the session, the drafts,
 * the refresh scheduler and the registered push device all survive it — so on
 * the web the guard would send the vendor straight back to the dashboard, and
 * on a device the phone would keep receiving that account's notifications after
 * they had signed out of it. The real teardown is the store's.
 *
 * Confirmed rather than immediate because on a phone this is a full-screen
 * action reachable from the profile header, and signing back in means finding a
 * password — a mis-tap is expensive in a way most mis-taps are not.
 */
export function SignOutDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const { logout } = useOnboarding();
  const [busy, setBusy] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={busy ? undefined : onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('nav.header.logoutTitle')}</AlertDialogTitle>
          <AlertDialogDescription>{t('nav.header.logoutDescription')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t('common.actions.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={(e) => {
              // The dialog closes itself on select; hold it open instead so the
              // spinner is visible for the device-unregister round trip that
              // `logout()` makes before the session goes.
              e.preventDefault();
              setBusy(true);
              void logout().finally(() => setBusy(false));
            }}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
            {t('nav.header.logout')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
