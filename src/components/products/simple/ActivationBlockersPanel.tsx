import { Link } from 'react-router-dom';
import { AlertCircle, CircleDashed, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getPickupGuidance } from '@/services/products.service';
import { useTranslation } from '@/i18n';
import { PickupAddressPicker } from './PickupAddressPicker';
import type { ApiPickupLocation, SimpleActivationMeta } from '@/types/product.types';

interface ActivationBlockersPanelProps {
  activation: SimpleActivationMeta;
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
  demoted = false,
  isBusy = false,
  onRetryPublish,
  onPickupLocationChosen,
  onDone,
}: ActivationBlockersPanelProps) {
  const { t, tDynamic, hasKey } = useTranslation();
  if (activation.published) return null;

  const guidance = getPickupGuidance(activation.pickupReason);

  // Deduplicated because the backend emits one blocker per offending variant for
  // some codes, and they collapse onto the same sentence once localized.
  const lines = Array.from(
    new Set(
      activation.blockers.map((blocker) => {
        const contextKey = `errors.contexts.simpleProduct.${blocker.code}`;
        if (hasKey(contextKey)) return tDynamic(contextKey);
        const codeKey = `errors.codes.${blocker.code}`;
        if (hasKey(codeKey)) return tDynamic(codeKey);
        return t('products.blockers.unknown');
      }),
    ),
  );

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="font-medium text-sm">
            {t(demoted ? 'products.blockers.demoted' : 'products.blockers.savedAsDraft')}
          </p>
          {lines.length > 0 && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {t('products.blockers.summary', { count: lines.length })}
            </p>
          )}
        </div>
      </div>

      {lines.length > 0 && (
        // Localized from `blocker.code` rather than rendered from
        // `blocker.message`: the backend writes that message for a vendor to
        // read, but only ever in English.
        <ul className="space-y-2 pl-8">
          {lines.map((line) => (
            <li key={line} className="flex items-start gap-2 text-sm">
              <CircleDashed className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <span>{line}</span>
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
