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
import { Button } from '@/components/ui/button';
import { canOpenAppSettings } from '@/platform/permissions';
import { useTranslation, type TranslationKey } from '@/i18n';

/** Why "use my location" stopped — the three reasons the vendor can fix. */
export type LocationAccessProblem = 'denied' | 'blocked' | 'off';

/**
 * Shown when "use my location" could not go ahead, in place of the old one-line
 * "permission denied" toast — most vendors do not know how to re-allow a
 * permission by hand, so every version of this dialog ends in an action that
 * asks again or takes them to the switch:
 *
 * - `denied` — refused this time. "Allow" raises the phone's prompt again.
 * - `blocked` — the OS will not prompt any more. In the app, "Open settings"
 *   goes to the app's settings page (the address fills in when they come back);
 *   "Try again" stays beside it, because a prompt that was merely swiped away
 *   reads as blocked too. In a browser there is no screen we can open, so the
 *   copy says where the browser's switch is.
 * - `off` — the phone's location switch is off. "Try again" raises Google's
 *   "turn on location" dialog again.
 */
export function LocationAccessDialog({
  open,
  problem,
  onOpenChange,
  onRetry,
  onOpenSettings,
}: {
  open: boolean;
  /** Kept apart from `open` so the text does not blank out while the dialog animates shut. */
  problem: LocationAccessProblem;
  onOpenChange: (open: boolean) => void;
  onRetry: () => void;
  onOpenSettings: () => void;
}) {
  const { t } = useTranslation();
  const settingsReachable = problem === 'blocked' && canOpenAppSettings;

  const copy: Record<LocationAccessProblem, [TranslationKey, TranslationKey]> = {
    denied: ['common.address.access.deniedTitle', 'common.address.access.deniedBody'],
    blocked: settingsReachable
      ? ['common.address.access.blockedTitle', 'common.address.access.blockedBody']
      : ['common.address.access.blockedBrowserTitle', 'common.address.access.blockedBrowserBody'],
    off: ['common.address.access.offTitle', 'common.address.access.offBody'],
  };
  const [titleKey, bodyKey] = copy[problem];

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t(titleKey)}</AlertDialogTitle>
          <AlertDialogDescription>{t(bodyKey)}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.address.access.notNow')}</AlertDialogCancel>
          {settingsReachable ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  onRetry();
                }}
              >
                {t('common.actions.retry')}
              </Button>
              <AlertDialogAction onClick={onOpenSettings}>
                {t('common.address.openSettings')}
              </AlertDialogAction>
            </>
          ) : (
            <AlertDialogAction onClick={onRetry}>
              {problem === 'denied' ? t('common.address.access.allow') : t('common.actions.retry')}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
