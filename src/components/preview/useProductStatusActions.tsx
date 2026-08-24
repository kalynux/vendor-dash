import { useCallback, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import {
  ACTIVATION_ERROR_KEYS,
  STATUS_TRANSITIONS,
  runActivationPreflight,
  updateProductStatus,
  type StatusTransition,
  type StatusTransitionIntent,
} from '@/services/products.service';
import { ApiError } from '@/types/api';
import { STATUS_INTENT_ICON } from '@/components/products/statusIntentIcons';
import { useApiError, useTranslation, type TranslationKey } from '@/i18n';
import type { ApiProductStatus } from '@/types/product.types';
import type { PreviewAction } from './PreviewBanner';
import {
  StatusTransitionDialog,
  type PendingStatusTransition,
} from './StatusTransitionDialog';

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
 *
 * ── Why a hook and not a component ───────────────────────────────────────────
 *
 * It used to render its own button plus its own dropdown, which meant the
 * preview bar carried *two* menus on a handset — one for the page's actions and
 * one for these — on a bar that already had no room. Handing the transitions
 * back as `PreviewAction`s lets `PreviewBanner` put them wherever they fit,
 * beside everything else the page can do. The confirmation still belongs to this
 * flow, so it comes back alongside them, for the caller to render.
 */

const STATUS_LABEL_KEYS: Record<ApiProductStatus, TranslationKey> = {
  active: 'products.status.active',
  draft: 'products.status.draft',
  archived: 'products.status.archived',
  pending_review: 'products.status.pendingReview',
  suspended: 'products.status.suspended',
};

interface ProductStatusActionsOptions {
  productId: string;
  productTitle: string;
  status: ApiProductStatus;
  /** Called after the status actually changed, so the caller can refetch. */
  onChanged: () => void;
  /** The one transition worth a labelled button on a wide screen. */
  primaryIntent?: StatusTransitionIntent;
}

export function useProductStatusActions({
  productId,
  productTitle,
  status,
  onChanged,
  primaryIntent,
}: ProductStatusActionsOptions): { actions: PreviewAction[]; dialog: ReactNode } {
  const { t } = useTranslation();
  const apiError = useApiError();
  const [pending, setPending] = useState<PendingStatusTransition | null>(null);
  const [busy, setBusy] = useState(false);

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
  }, [pending, productId, productTitle, onChanged, t, apiError]);

  const actions: PreviewAction[] = (STATUS_TRANSITIONS[status] ?? []).map((transition) => ({
    id: `status-${transition.intent}`,
    icon: STATUS_INTENT_ICON[transition.intent],
    label: t(transition.labelKey),
    onClick: () => void request(transition),
    disabled: busy,
    destructive: transition.destructive,
    ...(transition.intent === primaryIntent ? { emphasis: 'primary' as const } : {}),
  }));

  return {
    actions,
    dialog: (
      <StatusTransitionDialog
        productTitle={productTitle}
        pending={pending}
        busy={busy}
        onCancel={() => setPending(null)}
        onConfirm={() => void confirm()}
      />
    ),
  };
}
