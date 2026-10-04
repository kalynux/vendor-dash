import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowRight, CheckCircle2, Loader2, Store } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { SubPageHeader } from '@/components/layout/SubPageHeader';
import { MobilePageHeader } from '@/components/layout/MobilePageHeader';
import { PageSkeleton } from '@/components/layout/RouteSkeleton';
import { useIsMobile } from '@/hooks/use-mobile';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import {
  confirmClosureRequest,
  declineClosureRequest,
} from '@/services/closure-request.service';
import {
  refreshPendingClosureRequest,
  setPendingClosureRequest,
} from '@/lib/pending-closure-request';
import { ApiError } from '@/types/api';
import type {
  ClosureBlocker,
  ClosureBlockerCode,
  ClosureRequest,
  ClosureWarning,
} from '@/types/closure-request.types';
import { useApiError, useFormatters, useTranslation, type TranslationKey } from '@/i18n';

/**
 * The shop-closure request (ADR-A10, 2026-10-04).
 *
 * Reached from the `account/closure` deep link (`account.closure_requested`)
 * and from the dashboard banner. An administrator asked; this is where the
 * vendor answers. Confirming is irreversible — the shop goes offline and its
 * details are anonymised — so it sits behind a checkbox in a second step, and
 * the button stays disabled while anything is still in progress
 * (`canConfirm: false`). Copy says "close", never "delete".
 */

type BlockerCopy = { label: TranslationKey; fix: TranslationKey; to?: string };

/** The ten codes a vendor can receive, with where to go to settle each. */
const BLOCKER_COPY: Partial<Record<ClosureBlockerCode, BlockerCopy>> = {
  vendor_orders_in_flight: {
    label: 'account.closure.blockers.items.vendor_orders_in_flight.label',
    fix: 'account.closure.blockers.items.vendor_orders_in_flight.fix',
    to: '/dashboard/orders',
  },
  vendor_bookings_open: {
    label: 'account.closure.blockers.items.vendor_bookings_open.label',
    fix: 'account.closure.blockers.items.vendor_bookings_open.fix',
    to: '/dashboard/services/appointments',
  },
  cod_collections_pending: {
    label: 'account.closure.blockers.items.cod_collections_pending.label',
    fix: 'account.closure.blockers.items.cod_collections_pending.fix',
    to: '/dashboard/orders',
  },
  payout_request_held: {
    label: 'account.closure.blockers.items.payout_request_held.label',
    fix: 'account.closure.blockers.items.payout_request_held.fix',
    to: '/dashboard/account/payout',
  },
  earnings_balance: {
    label: 'account.closure.blockers.items.earnings_balance.label',
    fix: 'account.closure.blockers.items.earnings_balance.fix',
    to: '/dashboard/account/payout',
  },
  earnings_allocations_held: {
    label: 'account.closure.blockers.items.earnings_allocations_held.label',
    fix: 'account.closure.blockers.items.earnings_allocations_held.fix',
    to: '/dashboard/account/payout',
  },
  agency_stock_held: {
    label: 'account.closure.blockers.items.agency_stock_held.label',
    fix: 'account.closure.blockers.items.agency_stock_held.fix',
    to: '/dashboard/inventory',
  },
  storage_invoices_open: {
    label: 'account.closure.blockers.items.storage_invoices_open.label',
    fix: 'account.closure.blockers.items.storage_invoices_open.fix',
    to: '/dashboard/inventory/invoices',
  },
  negotiations_open: {
    label: 'account.closure.blockers.items.negotiations_open.label',
    fix: 'account.closure.blockers.items.negotiations_open.fix',
  },
  stock_requests_pending: {
    label: 'account.closure.blockers.items.stock_requests_pending.label',
    fix: 'account.closure.blockers.items.stock_requests_pending.fix',
    to: '/dashboard/inventory/requests',
  },
};

/** A code meant for another role, or one added after this build. Never shown raw. */
const OTHER_BLOCKER: BlockerCopy = {
  label: 'account.closure.blockers.items.other.label',
  fix: 'account.closure.blockers.items.other.fix',
};

function capitalize(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

export function AccountClosure() {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const apiError = useApiError();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { endClosedShopSession } = useOnboarding();

  const [request, setRequest] = useState<ClosureRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const [declineOpen, setDeclineOpen] = useState(false);
  const [note, setNote] = useState('');
  const [declining, setDeclining] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const next = await refreshPendingClosureRequest();
      setRequest(next && next.status === 'pending' ? next : null);
    } catch (err) {
      setLoadError(apiError.resolve(err, { fallbackKey: 'account.closure.loadFailed' }));
    } finally {
      setLoading(false);
    }
  }, [apiError]);

  useEffect(() => {
    void load();
  }, [load]);

  /** The request moved on under us (expired, answered elsewhere, new blockers): re-read it. */
  const handleAnswerError = (err: unknown) => {
    if (err instanceof ApiError && err.code === 'ROLE_CLOSURE_BLOCKED') {
      toast.error(t('account.closure.blockedToast'));
    } else {
      apiError.toast(err);
    }
    void load();
  };

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      const answered = await confirmClosureRequest();
      setConfirmOpen(false);
      // The server already cleared the session. `accountClosed` decides where
      // to go: sign-in (other roles remain) or the "account closed" screen.
      await endClosedShopSession(answered.outcome?.accountClosed ?? false);
    } catch (err) {
      setConfirmOpen(false);
      handleAnswerError(err);
    } finally {
      setConfirming(false);
    }
  };

  const handleDecline = async () => {
    setDeclining(true);
    try {
      const answered = await declineClosureRequest(note);
      setPendingClosureRequest(answered);
      setDeclineOpen(false);
      toast.success(t('account.closure.declined'));
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setDeclineOpen(false);
      handleAnswerError(err);
    } finally {
      setDeclining(false);
    }
  };

  const warningText = (w: ClosureWarning): string => {
    if (w.code === 'credit_balance_forfeited') {
      return t('account.closure.warnings.credits', { count: w.amount ?? 0 });
    }
    const plan = capitalize(w.planCode ?? '');
    return w.expiresAt
      ? t('account.closure.warnings.plan', { plan, date: fmt.date(w.expiresAt) })
      : t('account.closure.warnings.planNoDate', { plan });
  };

  const blockerLabel = (b: ClosureBlocker, copy: BlockerCopy): string => {
    if (b.code === 'earnings_balance') {
      return b.amount != null && b.currency
        ? t('account.closure.blockers.items.earnings_balance.label', {
          amount: fmt.currency(b.amount, b.currency),
        })
        : t('account.closure.blockers.items.earnings_balance.labelNoAmount');
    }
    return t(copy.label, { count: b.count });
  };

  let body: ReactNode;
  if (loading) {
    body = <PageSkeleton />;
  } else if (loadError) {
    body = (
      <div className="py-10 text-center">
        <p className="mb-4 text-sm text-muted-foreground">{loadError}</p>
        <Button variant="outline" onClick={() => { setLoading(true); void load(); }}>
          {t('common.actions.retry')}
        </Button>
      </div>
    );
  } else if (!request) {
    body = (
      <div className="py-12 text-center">
        <CheckCircle2 className="mx-auto mb-3 size-10 text-muted-foreground" />
        <h2 className="text-base font-semibold">{t('account.closure.none.title')}</h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{t('account.closure.none.body')}</p>
        <Button asChild variant="outline" className="mt-5">
          <Link to="/dashboard">{t('account.closure.none.back')}</Link>
        </Button>
      </div>
    );
  } else {
    const blockers = request.blockers ?? [];
    body = (
      <div className="max-w-2xl space-y-8">
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">{t('account.closure.reasonLabel')}</h2>
          {/* The administrator's own words — verbatim, never translated. */}
          <blockquote className="whitespace-pre-line border-l-2 border-border pl-4 text-base">
            {request.reason}
          </blockquote>
          <p className="text-sm text-muted-foreground">
            {t('account.closure.deadline', { date: fmt.dateTime(request.expiresAt) })}
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold">{t('account.closure.whatHappens.title')}</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>{t('account.closure.whatHappens.offline')}</li>
            <li>{t('account.closure.whatHappens.removed')}</li>
            <li>{t('account.closure.whatHappens.kept')}</li>
            <li>{t('account.closure.whatHappens.otherAccounts')}</li>
            <li className="font-medium">{t('account.closure.whatHappens.final')}</li>
          </ul>
        </section>

        {request.warnings.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-base font-semibold">{t('account.closure.warnings.title')}</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-amber-800 dark:text-amber-400">
              {request.warnings.map((w, i) => (
                <li key={`${w.code}-${i}`}>{warningText(w)}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-base font-semibold">{t('account.closure.blockers.title')}</h2>
          {blockers.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="size-4 shrink-0" />
              {t('account.closure.blockers.clear')}
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{t('account.closure.blockers.intro')}</p>
              <ul className="divide-y divide-border border-y border-border">
                {blockers.map((b, i) => {
                  const copy = BLOCKER_COPY[b.code] ?? OTHER_BLOCKER;
                  return (
                    <li key={`${b.code}-${i}`} className="flex items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{blockerLabel(b, copy)}</p>
                        <p className="text-sm text-muted-foreground">{t(copy.fix)}</p>
                      </div>
                      {copy.to && (
                        <Button asChild size="sm" variant="ghost" className="shrink-0">
                          <Link to={copy.to}>
                            {t('account.closure.blockers.open')}
                            <ArrowRight className="ml-1 size-3.5" />
                          </Link>
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>

        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button variant="outline" className="h-11 sm:h-10" onClick={() => setDeclineOpen(true)}>
            {t('account.closure.actions.decline')}
          </Button>
          <Button
            variant="destructive"
            className="h-11 sm:h-10"
            disabled={!request.canConfirm}
            onClick={() => { setUnderstood(false); setConfirmOpen(true); }}
          >
            {t('account.closure.actions.confirm')}
          </Button>
        </div>
      </div>
    );
  }

  const dialogs = (
    <>
      <AlertDialog open={confirmOpen} onOpenChange={confirming ? undefined : setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('account.closure.confirmDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('account.closure.confirmDialog.description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-start gap-3">
            <Checkbox
              id="closure-understood"
              checked={understood}
              onCheckedChange={(v) => setUnderstood(v === true)}
              disabled={confirming}
              className="mt-0.5"
            />
            <Label htmlFor="closure-understood" className="text-sm font-normal leading-snug">
              {t('account.closure.confirmDialog.checkbox')}
            </Label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirming}>{t('common.actions.cancel')}</AlertDialogCancel>
            {/* A plain Button, not AlertDialogAction: that one closes the dialog
                on click, before the answer is back. */}
            <Button
              variant="destructive"
              disabled={!understood || confirming}
              onClick={() => void handleConfirm()}
            >
              {confirming && <Loader2 className="mr-2 size-4 animate-spin" />}
              {t('account.closure.confirmDialog.confirm')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={declineOpen} onOpenChange={declining ? undefined : setDeclineOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('account.closure.declineDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('account.closure.declineDialog.description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="closure-note">{t('account.closure.declineDialog.noteLabel')}</Label>
            <Textarea
              id="closure-note"
              value={note}
              maxLength={500}
              rows={3}
              placeholder={t('account.closure.declineDialog.notePlaceholder')}
              onChange={(e) => setNote(e.target.value)}
              disabled={declining}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={declining}>{t('common.actions.cancel')}</AlertDialogCancel>
            <Button disabled={declining} onClick={() => void handleDecline()}>
              {declining && <Loader2 className="mr-2 size-4 animate-spin" />}
              {t('account.closure.declineDialog.confirm')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  if (isMobile) {
    return (
      <div className="-mx-6 -mt-6 animate-fade-in">
        <MobilePageHeader
          title={t('account.closure.crumb')}
          description={t('account.closure.subtitle')}
          onBack={() => navigate('/dashboard')}
        />
        <div className="px-6 pb-8 pt-4">{body}</div>
        {dialogs}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <SubPageHeader
        parent={t('nav.items.account')}
        current={t('account.closure.crumb')}
        description={t('account.closure.subtitle')}
        icon={
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400">
            <Store className="size-5" />
          </div>
        }
      />
      {body}
      {dialogs}
    </div>
  );
}
