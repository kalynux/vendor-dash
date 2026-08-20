import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Star, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { SettingsSection } from '@/components/vendor-settings/SettingsSection';
import { Button } from '@/components/ui/button';
import { purchasesEnabled } from '@/platform/purchases';
import { PurchasesUnavailable } from './PurchasesUnavailable';
import { Badge } from '@/components/ui/badge';
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
import type { SavedPaymentMethod } from '@/types/payment-method.types';
import {
  fetchPaymentMethods,
  setDefaultPaymentMethod,
  deletePaymentMethod,
} from '@/services/payment-methods.service';
import { PaymentBrandLogo, brandForSavedMethod } from '@/components/payment-methods';
import { useTranslation, useApiError } from '@/i18n';
import { CardSkeleton } from './BillingSkeletons';
import { methodTypeLabel } from './billing.constants';
import { AddPaymentMethodDialog } from './AddPaymentMethodDialog';

const MAX_METHODS = 10;

export function SavedPaymentMethodsCard() {
  const { t } = useTranslation();
  const apiError = useApiError();
  const [methods, setMethods] = useState<SavedPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [pendingDefaultId, setPendingDefaultId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SavedPaymentMethod | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setMethods(await fetchPaymentMethods());
    } catch (err) {
      setError(
        apiError.resolve(err, { context: 'billing', fallbackKey: 'billing.errors.loadMethodsFailed' }),
      );
    } finally {
      setLoading(false);
    }
  }, [apiError]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSetDefault(id: string) {
    setPendingDefaultId(id);
    try {
      await setDefaultPaymentMethod(id);
      setMethods((prev) => prev.map((m) => ({ ...m, is_default: m.id === id })));
    } catch (err) {
      apiError.toast(err, { context: 'billing', fallbackKey: 'billing.errors.defaultFailed' });
    } finally {
      setPendingDefaultId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const wasDefault = deleteTarget.is_default;
    setDeleting(true);
    try {
      await deletePaymentMethod(deleteTarget.id);
      const remaining = methods.filter((m) => m.id !== deleteTarget.id);
      setMethods(remaining);
      toast.success(t('billing.toast.methodRemoved'));
      // Deleting the default does not auto-promote another (per the API docs).
      if (wasDefault && remaining.length > 0) {
        toast.info(t('billing.toast.pickNewDefault'));
      }
    } catch (err) {
      apiError.toast(err, { context: 'billing', fallbackKey: 'billing.errors.removeMethodFailed' });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  const atLimit = methods.length >= MAX_METHODS;

  return (
    <SettingsSection
      title={t('billing.methods.title')}
      info={t('billing.methods.info', { max: MAX_METHODS })}
      action={
        purchasesEnabled ? (
          <Button
            size="sm"
            className="gap-1"
            onClick={() => setAddOpen(true)}
            disabled={atLimit}
            title={atLimit ? t('billing.methods.atLimit', { max: MAX_METHODS }) : undefined}
          >
            <Plus className="h-4 w-4" /> {t('common.actions.add')}
          </Button>
        ) : undefined
      }
    >
        {/* Read-only on a packaged app: saved cards are still listed, and
            "Set default" and "Remove" still work — managing what is already
            stored is not a purchase. Only adding one is, because it is the first
            step of a checkout the store would want its cut of (P5.2). */}
        {!purchasesEnabled && (
          <PurchasesUnavailable className="mb-3" message={t('billing.mobile.methods')} />
        )}
        {loading ? (
          <CardSkeleton lines={3} />
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <AlertCircle className="h-6 w-6 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={load}>
              {t('common.actions.retry')}
            </Button>
          </div>
        ) : methods.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t('billing.methods.empty')}
          </p>
        ) : (
          <ul className="divide-y">
            {methods.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                {/* The brand is spelled out in `display_label` next to it. */}
                <PaymentBrandLogo brand={brandForSavedMethod(m)} size="md" decorative />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{m.display_label}</span>
                    {m.is_default && <Badge variant="secondary">{t('billing.methods.default')}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {methodTypeLabel(m.method_type, t)}
                    {m.method_type === 'card' && m.exp_month && m.exp_year
                      ? ` · ${t('billing.methods.expires', {
                          date: `${String(m.exp_month).padStart(2, '0')}/${String(m.exp_year).slice(-2)}`,
                        })}`
                      : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {!m.is_default && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1"
                      onClick={() => handleSetDefault(m.id)}
                      disabled={pendingDefaultId === m.id}
                    >
                      {pendingDefaultId === m.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Star className="h-4 w-4" />
                      )}
                      <span className="hidden sm:inline">{t('billing.methods.setDefault')}</span>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteTarget(m)}
                    aria-label={t('billing.methods.removeAria')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

      {/* Never mounted on a packaged app — this is what keeps `StripeCardField`,
          `CardPreview` and `lib/stripe.ts` off the screen and out of the network
          log entirely, rather than merely hiding the button that opens them. */}
      {purchasesEnabled && (
        <AddPaymentMethodDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          forceDefault={methods.length === 0}
          onAdded={(created) => {
            // A new default clears the previous one locally; first method is always default.
            setMethods((prev) =>
              created.is_default ? [created, ...prev.map((m) => ({ ...m, is_default: false }))] : [...prev, created],
            );
          }}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('billing.methods.removeTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('billing.methods.removeDescription', {
                label: deleteTarget?.display_label ?? '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t('common.actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common.actions.remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsSection>
  );
}
