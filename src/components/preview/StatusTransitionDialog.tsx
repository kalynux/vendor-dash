import { Loader2, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { STATUS_INTENT_ICON } from '@/components/products/statusIntentIcons';
import { Trans, useTranslation, type TranslationKey } from '@/i18n';
import { cn } from '@/lib/utils';
import type { StatusTransition, StatusTransitionIntent } from '@/services/products.service';

/**
 * "Are you sure?" for a product status change, plus the activation preflight's
 * verdict when publishing is the thing being asked for.
 *
 * One dialog for both because they are the same moment from the vendor's side —
 * they pressed Publish and the app is answering. Splitting them would mean a
 * dialog that opens, thinks, closes and is replaced by a different dialog.
 *
 * Driven entirely by `pending`; it owns no state. `useProductStatusActions` runs
 * the calls and decides what goes in here.
 */

export type PendingStatusTransition = {
  transition: StatusTransition;
  /** The preflight is still running. */
  loading?: boolean;
  /** What the preflight found. Non-empty means the transition cannot proceed. */
  preflightErrors?: TranslationKey[];
};

const INTENT_CONFIRM: Record<StatusTransitionIntent, TranslationKey> = {
  activate: 'products.transitions.confirm.activate',
  demote_to_draft: 'products.transitions.confirm.demote_to_draft',
  restore: 'products.transitions.confirm.restore',
  archive: 'products.transitions.confirm.archive',
};

const INTENT_CTA: Record<StatusTransitionIntent, TranslationKey> = {
  activate: 'products.transitions.cta.activate',
  demote_to_draft: 'products.transitions.cta.demote_to_draft',
  restore: 'products.transitions.cta.restore',
  archive: 'products.transitions.cta.archive',
};

export function StatusTransitionDialog({
  productTitle,
  pending,
  busy,
  onCancel,
  onConfirm,
}: {
  productTitle: string;
  pending: PendingStatusTransition | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  const isErrorState = !!pending?.preflightErrors?.length;

  return (
    <Dialog
      open={!!pending}
      onOpenChange={(open) => {
        if (!open && !busy) onCancel();
      }}
    >
      <DialogContent>
        <DialogHeader className="text-left">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-full',
                isErrorState
                  ? 'bg-orange-100 text-orange-600'
                  : pending?.transition.destructive
                    ? 'bg-red-100 text-red-600'
                    : 'bg-primary/10 text-primary',
              )}
            >
              {isErrorState ? (
                <TriangleAlert className="size-5" />
              ) : pending?.loading ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                pending &&
                (() => {
                  const Icon = STATUS_INTENT_ICON[pending.transition.intent];
                  return <Icon className="size-5" />;
                })()
              )}
            </div>
            <DialogTitle>
              {isErrorState
                ? t('products.activation.cannotPublishTitle')
                : t('products.transitions.confirmTitle', {
                    action: pending ? t(pending.transition.labelKey) : '',
                  })}
            </DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            {isErrorState ? (
              <Trans
                i18nKey="products.activation.cannotPublishDescription"
                params={{ name: productTitle }}
                components={[<span className="font-semibold text-foreground" />]}
              />
            ) : pending ? (
              <>
                <span className="font-semibold text-foreground">{productTitle}</span>
                {' — '}
                {t(pending.transition.confirmKey ?? INTENT_CONFIRM[pending.transition.intent])}
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        {isErrorState && (
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {pending!.preflightErrors!.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
            {t(isErrorState ? 'common.actions.gotIt' : 'common.actions.cancel')}
          </Button>
          {!isErrorState && (
            <Button
              type="button"
              variant={pending?.transition.destructive ? 'destructive' : 'default'}
              onClick={onConfirm}
              disabled={busy || pending?.loading}
            >
              {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
              {pending ? t(INTENT_CTA[pending.transition.intent]) : ''}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
