import { Link } from 'react-router-dom';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useFormatters, useTranslation, type TranslationKey } from '@/i18n';
import type { CodLimitExceededDetails, CodLimitKind } from '@/types/cod-limits.types';

/** Where the COD terms card lives — Settings → Policies. */
const COD_TERMS_PATH = '/dashboard/settings/policies#cod-terms';

const TITLE_KEYS: Record<string, TranslationKey> = {
  agency_limit: 'orders.codLimit.title.agency_limit',
  vendor_terms: 'orders.codLimit.title.vendor_terms',
};

/** Title by `kind`; a kind this build doesn't know gets neutral copy. */
function codLimitTitleKey(kind: CodLimitKind): TranslationKey {
  return TITLE_KEYS[kind] ?? 'orders.codLimit.title.unknown';
}

interface CodLimitDialogProps {
  /** The refused hand-off's figures; the dialog is open while this is set. */
  details: CodLimitExceededDetails | null;
  currency: string;
  /** `dispatch` = dispatch / bulk dispatch, `move` = change agency. */
  mode: 'dispatch' | 'move';
  forcing: boolean;
  onForce: () => void;
  onClose: () => void;
  /** Offered on dispatch: the vendor re-routes the parcel instead of forcing it. */
  onChooseAnotherAgency?: () => void;
}

/**
 * Shown on `422 COD_AGENCY_LIMIT_EXCEEDED`. The agency would hold more
 * un-remitted cash than a cap allows; the vendor may force the hand-off
 * (recorded as `codLimitForce`), pick another agency, or leave it.
 */
export function CodLimitDialog({
  details,
  currency,
  mode,
  forcing,
  onForce,
  onClose,
  onChooseAnotherAgency,
}: CodLimitDialogProps) {
  const { t } = useTranslation();
  const fmt = useFormatters();

  return (
    <Dialog open={details !== null} onOpenChange={(open) => !open && !forcing && onClose()}>
      <DialogContent className="sm:max-w-md">
        {details && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 flex-shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <DialogTitle>{t(codLimitTitleKey(details.kind))}</DialogTitle>
              </div>
              <DialogDescription className="pt-3 space-y-2" asChild>
                <div>
                  <p className="text-foreground">
                    {t(mode === 'move' ? 'orders.codLimit.bodyMove' : 'orders.codLimit.body', {
                      current: fmt.currency(details.currentExposure, currency),
                      added: fmt.currency(details.additionalAmount, currency),
                      limit: fmt.currency(details.limit, currency),
                    })}
                  </p>
                  <p>{t(mode === 'move' ? 'orders.codLimit.forceNoteMove' : 'orders.codLimit.forceNote')}</p>
                  {details.kind === 'vendor_terms' && (
                    <Link to={COD_TERMS_PATH} className="inline-block font-medium text-primary underline-offset-4 hover:underline">
                      {t('orders.codLimit.openCodTerms')}
                    </Link>
                  )}
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" onClick={onClose} disabled={forcing}>
                {t('common.actions.cancel')}
              </Button>
              {onChooseAnotherAgency && (
                <Button variant="outline" onClick={onChooseAnotherAgency} disabled={forcing}>
                  {t('orders.codLimit.chooseAnotherAgency')}
                </Button>
              )}
              <Button onClick={onForce} disabled={forcing} className="gap-2">
                {forcing && <Loader2 className="w-4 h-4 animate-spin" />}
                {t(mode === 'move' ? 'orders.codLimit.moveAnyway' : 'orders.codLimit.dispatchAnyway')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
