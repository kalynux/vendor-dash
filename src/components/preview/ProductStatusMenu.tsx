import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import {
  ArchiveRestore,
  ChevronDown,
  Loader2,
  Pencil,
  Send,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ACTIVATION_ERROR_KEYS,
  STATUS_TRANSITIONS,
  runActivationPreflight,
  updateProductStatus,
  type StatusTransition,
  type StatusTransitionIntent,
} from '@/services/products.service';
import { ApiError } from '@/types/api';
import { Trans, useApiError, useTranslation, type TranslationKey } from '@/i18n';
import { cn } from '@/lib/utils';
import type { ApiProductStatus } from '@/types/product.types';

/**
 * Status transitions, from the preview page.
 *
 * Publishing is the action a vendor most wants while looking at a preview — it
 * is the whole reason they came to check — so it has to be reachable here rather
 * than only from the list. The rules are not re-stated: `STATUS_TRANSITIONS`
 * remains the single source of what may follow what, and the activation
 * preflight is the same call the list makes, so a product that cannot be
 * published fails here for exactly the reasons it fails there.
 *
 * `Products.tsx` keeps its own richer dialog (it also drives bulk selection and
 * the delete flow). Only the decision table and the service calls are shared.
 */

const INTENT_ICON: Record<StatusTransitionIntent, typeof Send> = {
  activate: Send,
  demote_to_draft: Pencil,
  restore: ArchiveRestore,
  archive: Trash2,
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

const STATUS_LABEL_KEYS: Record<ApiProductStatus, TranslationKey> = {
  active: 'products.status.active',
  draft: 'products.status.draft',
  archived: 'products.status.archived',
  pending_review: 'products.status.pendingReview',
  suspended: 'products.status.suspended',
};

interface ProductStatusMenuProps {
  productId: string;
  productTitle: string;
  status: ApiProductStatus;
  /** Called after the status actually changed, so the caller can refetch. */
  onChanged: () => void;
  /** Renders the single most useful transition as its own button. */
  primaryIntent?: StatusTransitionIntent;
  className?: string;
}

type PendingState = {
  transition: StatusTransition;
  loading?: boolean;
  preflightErrors?: TranslationKey[];
};

export function ProductStatusMenu({
  productId,
  productTitle,
  status,
  onChanged,
  primaryIntent,
  className,
}: ProductStatusMenuProps) {
  const { t } = useTranslation();
  const apiError = useApiError();
  const [pending, setPending] = useState<PendingState | null>(null);
  const [busy, setBusy] = useState(false);

  const transitions = STATUS_TRANSITIONS[status] ?? [];
  const primary = primaryIntent
    ? transitions.find((tr) => tr.intent === primaryIntent)
    : undefined;
  const rest = primary ? transitions.filter((tr) => tr !== primary) : transitions;

  const request = useCallback(
    async (transition: StatusTransition) => {
      if (!transition.needsPreflight) {
        setPending({ transition });
        return;
      }
      setPending({ transition, loading: true });
      try {
        const errors = await runActivationPreflight(productId);
        setPending({ transition, ...(errors.length > 0 ? { preflightErrors: errors } : {}) });
      } catch (err) {
        toast.error(apiError.resolve(err, { fallbackKey: 'products.errors.validateFailed' }));
        setPending(null);
      }
    },
    [productId, apiError],
  );

  const confirm = useCallback(async () => {
    if (!pending || pending.preflightErrors) return;
    const { transition } = pending;
    setBusy(true);
    try {
      await updateProductStatus(productId, transition.target);
      toast.success(
        t('products.toast.statusChanged', {
          name: productTitle,
          status: t(STATUS_LABEL_KEYS[transition.target] ?? 'products.status.draft'),
        }),
      );
      setPending(null);
      onChanged();
    } catch (err) {
      // Activation failures carry their own codes with actionable copy; only
      // fall back to the generic resolver when the code is not one of them.
      const activationKey = err instanceof ApiError ? ACTIVATION_ERROR_KEYS[err.code] : undefined;
      toast.error(
        activationKey
          ? t(activationKey)
          : apiError.resolve(err, { fallbackKey: 'products.errors.statusChangeFailed' }),
      );
      setPending(null);
    } finally {
      setBusy(false);
    }
  }, [pending, productId, onChanged, t, apiError]);

  if (transitions.length === 0) return null;

  const isErrorState = !!pending?.preflightErrors?.length;

  return (
    <>
      <div className={cn('flex items-center gap-1.5', className)}>
        {primary && (
          <Button
            type="button"
            size="sm"
            className="gap-1.5"
            onClick={() => void request(primary)}
            disabled={busy}
          >
            {(() => {
              const Icon = INTENT_ICON[primary.intent];
              return <Icon className="size-4" />;
            })()}
            <span className="hidden sm:inline">{t(primary.labelKey)}</span>
          </Button>
        )}

        {rest.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1"
                disabled={busy}
                aria-label={t('common.preview.statusActions')}
              >
                <span className="hidden sm:inline">{t('common.preview.statusActions')}</span>
                <ChevronDown className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {rest.map((transition) => {
                const Icon = INTENT_ICON[transition.intent];
                return (
                  <DropdownMenuItem
                    key={transition.intent}
                    onClick={() => void request(transition)}
                    className={cn(transition.destructive && 'text-destructive')}
                  >
                    <Icon className="mr-2 size-4" />
                    {t(transition.labelKey)}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <Dialog
        open={!!pending}
        onOpenChange={(open) => {
          if (!open && !busy) setPending(null);
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
                    const Icon = INTENT_ICON[pending.transition.intent];
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
            <Button type="button" variant="outline" onClick={() => setPending(null)} disabled={busy}>
              {t(isErrorState ? 'common.actions.gotIt' : 'common.actions.cancel')}
            </Button>
            {!isErrorState && (
              <Button
                type="button"
                variant={pending?.transition.destructive ? 'destructive' : 'default'}
                onClick={() => void confirm()}
                disabled={busy || pending?.loading}
              >
                {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
                {pending ? t(INTENT_CTA[pending.transition.intent]) : ''}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
