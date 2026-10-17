import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTranslation } from '@/i18n';

interface CodAgencyRestrictedDialogProps {
  open: boolean;
  onClose: () => void;
  /** Take the vendor to the change-agency picker — the only way forward. */
  onChooseAnotherAgency?: () => void;
}

/**
 * Shown on `422 COD_AGENCY_RESTRICTED`: the agency is barred from cash on
 * delivery and nothing of the order was dispatched. Unlike `CodLimitDialog`
 * there is no "anyway" — `force: true` does not get past this one — and no
 * reason, which the API never sends.
 */
export function CodAgencyRestrictedDialog({ open, onClose, onChooseAnotherAgency }: CodAgencyRestrictedDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 flex-shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <DialogTitle>{t('orders.codLimit.title.agency_restricted')}</DialogTitle>
          </div>
          <DialogDescription className="pt-3">{t('orders.codLimit.restrictedBody')}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose}>
            {t(onChooseAnotherAgency ? 'common.actions.cancel' : 'common.actions.close')}
          </Button>
          {onChooseAnotherAgency && (
            <Button onClick={onChooseAnotherAgency}>{t('orders.codLimit.chooseAnotherAgency')}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
