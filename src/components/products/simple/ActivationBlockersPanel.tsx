import { Link } from 'react-router-dom';
import { AlertCircle, CircleDashed, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getPickupGuidance } from '@/services/products.service';
import { useTranslation } from '@/i18n';
import { PickupAddressPicker } from './PickupAddressPicker';
import type { ApiPickupLocation, SimpleActivationMeta } from '@/types/product.types';

interface ActivationBlockersPanelProps {
  activation: SimpleActivationMeta;
  /** The server's own summary, e.g. "Product saved as a draft. Resolve 2 issue(s) to publish." */
  message?: string;
  /** True when reporting a demotion caused by an edit rather than a fresh create. */
  demoted?: boolean;
  isBusy?: boolean;
  onRetryPublish: () => void | Promise<void>;
  onPickupLocationChosen: (location: ApiPickupLocation) => void | Promise<void>;
  onDone: () => void;
}

/**
 * Renders `meta.activation.blockers` as a to-do list. The product exists and is
 * not lost — it is simply a draft until the checklist is clear.
 */
export function ActivationBlockersPanel({
  activation,
  message,
  demoted = false,
  isBusy = false,
  onRetryPublish,
  onPickupLocationChosen,
  onDone,
}: ActivationBlockersPanelProps) {
  const { t } = useTranslation();
  if (activation.published) return null;

  const guidance = getPickupGuidance(activation.pickupReason);

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="font-medium text-sm">
            {t(demoted ? 'products.blockers.demoted' : 'products.blockers.savedAsDraft')}
          </p>
          {message && <p className="text-sm text-muted-foreground mt-0.5">{message}</p>}
        </div>
      </div>

      {activation.blockers.length > 0 && (
        // The backend writes these for a vendor to read, and they are more
        // specific than anything we could remap them to — render verbatim.
        <ul className="space-y-2 pl-8">
          {activation.blockers.map((blocker) => (
            <li key={blocker.code} className="flex items-start gap-2 text-sm">
              <CircleDashed className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <span>{blocker.message}</span>
            </li>
          ))}
        </ul>
      )}

      {guidance && (
        <div className="pl-8 space-y-2 pt-1 border-t border-border/60">
          <div className="pt-3">
            <p className="text-sm font-medium">{t(guidance.titleKey)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t(guidance.bodyKey)}</p>
          </div>

          {guidance.action.kind === 'address_picker' && (
            <PickupAddressPicker disabled={isBusy} onChoose={onPickupLocationChosen} />
          )}

          {guidance.action.kind === 'link' && (
            <Button asChild size="sm" variant="outline">
              <Link to={guidance.action.to}>{t(guidance.action.labelKey)}</Link>
            </Button>
          )}
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-2 pl-8 pt-1">
        <Button size="sm" variant="outline" onClick={onDone} disabled={isBusy}>
          {t('products.blockers.done')}
        </Button>
        <Button size="sm" onClick={() => void onRetryPublish()} disabled={isBusy}>
          {isBusy && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
          {t('products.blockers.retryPublish')}
        </Button>
      </div>
    </div>
  );
}
