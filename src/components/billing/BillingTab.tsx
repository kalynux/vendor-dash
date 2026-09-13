import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  fetchCurrentPlan,
  fetchPlans,
  fetchCreditBalance,
  fetchCreditPacks,
  initiatePlanPurchase,
  authorizePlanPurchase,
  verifyPlanPurchase,
  initiateTopup,
  authorizeTopup,
  verifyTopup,
} from '@/services/billing.service';
import { fetchProducts } from '@/services/products.service';
import { useProductStore } from '@/store';
import { fetchStorageUsage } from '@/services/files.service';
import { useTranslation, useFormatters, useApiError, type TranslationKey } from '@/i18n';
import type {
  CurrentPlanData,
  PricingPlan,
  CreditPack,
  PaymentAuthorizeResult,
  PaymentChannel,
  PaymentGateway,
  PaymentInitResult,
  PaymentStatus,
} from '@/types/billing.types';
import type { StorageUsage } from '@/types/file.types';
import { purchasesEnabled } from '@/platform/purchases';
import { CurrentPlanCard } from './CurrentPlanCard';
import { StorageUsageCard } from './StorageUsageCard';
import { CreditWalletCard } from './CreditWalletCard';
import { PlansCatalog } from './PlansCatalog';
import { BillingSettingsCard } from './BillingSettingsCard';
import { SavedPaymentMethodsCard } from './SavedPaymentMethodsCard';
import { PaymentDialog } from './PaymentDialog';
import { CardSkeleton, PlansSkeleton } from './BillingSkeletons';
import {
  SettingsSection,
  SettingsSections,
} from '@/components/vendor-settings/SettingsSection';
import {
  readStripeResume,
  clearStripeResume,
  type StripeResumeKind,
} from './billing.constants';

interface PaymentRequest {
  title: string;
  summary: string;
  amount: number;
  currency: string;
  successLabelKey: TranslationKey;
  paymentKind: StripeResumeKind;
  initiate: (gateway: PaymentGateway, channel: PaymentChannel) => Promise<PaymentInitResult>;
  // Plans and top-ups authorize on their OWN route — `/plan-purchases/:id/authorize`
  // and `/credits/topups/:id/authorize`. Neither is `POST /payments/:id/authorize`,
  // which only knows `PaymentTransaction` rows and 404s on everything billing.
  authorize: (id: string, code: string) => Promise<PaymentAuthorizeResult>;
  verify: (id: string) => Promise<{ status: PaymentStatus }>;
}

export function BillingTab() {
  const { t } = useTranslation();
  // The shared list the Products page renders — refreshed after a plan change so
  // the quota sweep's un-suspensions are visible when the vendor walks back.
  const { fetchProducts: refreshProducts } = useProductStore();
  const fmt = useFormatters();
  const apiError = useApiError();
  const [current, setCurrent] = useState<CurrentPlanData | null>(null);
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [productCount, setProductCount] = useState<number | null>(null);
  const [storage, setStorage] = useState<StorageUsage | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const plansRef = useRef<HTMLElement>(null);

  const [payment, setPayment] = useState<PaymentRequest | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [planData, planList, bal, packList, storageData] = await Promise.all([
        fetchCurrentPlan(),
        fetchPlans(),
        fetchCreditBalance(),
        fetchCreditPacks(),
        fetchStorageUsage(),
      ]);
      setCurrent(planData);
      setPlans(planList);
      setBalance(bal);
      setPacks(packList);
      setStorage(storageData);
    } catch (err) {
      setError(
        apiError.resolve(err, { context: 'billing', fallbackKey: 'billing.errors.loadFailed' }),
      );
    } finally {
      setLoading(false);
    }
    // Product count is non-critical — load it separately so a failure here
    // doesn't block the whole tab.
    try {
      const res = await fetchProducts({ status: 'active', limit: 1 });
      setProductCount(res.meta.total);
    } catch {
      setProductCount(null);
    }
  }, [apiError]);

  useEffect(() => {
    load();
  }, [load]);

  // Resume a Stripe card payment that left the SPA for 3-D Secure. On return we
  // re-verify the purchase for immediate feedback; the Stripe webhook is the
  // authoritative finalizer, so the plan/credits apply server-side regardless.
  useEffect(() => {
    const marker = readStripeResume();
    if (!marker) return;
    clearStripeResume();
    let cancelled = false;
    (async () => {
      const verify = marker.kind === 'plan' ? verifyPlanPurchase : verifyTopup;
      // Poll a few times — the webhook usually finalizes within seconds of return.
      for (let i = 0; i < 5 && !cancelled; i++) {
        try {
          const { status } = await verify(marker.id);
          if (status === 'paid') {
            if (!cancelled) {
              toast.success(
                marker.kind === 'plan'
                  ? t('billing.toast.planPurchased')
                  : t('billing.toast.creditsAdded'),
              );
              await refreshAfterPayment();
            }
            return;
          }
          if (status === 'failed' || status === 'reversed') {
            if (!cancelled) toast.error(t('billing.checkout.resumeFailed'));
            return;
          }
        } catch {
          // transient — retry
        }
        await new Promise((r) => setTimeout(r, 3000));
      }
      if (!cancelled) {
        toast.info(t('billing.checkout.resumePending'));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh the live figures after a successful payment.
  const refreshAfterPayment = useCallback(async () => {
    try {
      // A plan upgrade can raise max_storage_bytes, so refresh storage too.
      const [planData, bal, storageData] = await Promise.all([
        fetchCurrentPlan(),
        fetchCreditBalance(),
        fetchStorageUsage(),
      ]);
      setCurrent(planData);
      setBalance(bal);
      setStorage(storageData);
    } catch {
      // best-effort
    }
    // A plan change re-runs the quota sweep, which un-suspends products and
    // un-blocks files — but it is NOT on the request path, so the purchase
    // response predates it. The store keeps the product list across navigation
    // (Products only fetches on mount when it is empty), so without this the
    // vendor walks back to a list still showing everything as suspended.
    // Best-effort and deliberately un-awaited: it must not delay the receipt.
    void refreshProducts().catch(() => {});
  }, [refreshProducts]);

  const scrollToPlans = useCallback(() => {
    plansRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Both openers are guarded as well as their buttons being hidden (P5.2). The
  // buttons are the door; this is the lock — a future caller that reaches for
  // one of these from somewhere new fails closed rather than opening a checkout
  // the store has not been told about.
  function openPlanPurchase(plan: PricingPlan) {
    if (!purchasesEnabled) return;
    setPayment({
      title: t('billing.plans.switchTo', { name: plan.name }),
      summary: t('billing.plans.planSummary', { name: plan.name }),
      amount: plan.price,
      currency: plan.currency,
      successLabelKey: 'billing.toast.planPurchased',
      paymentKind: 'plan',
      initiate: (gateway, channel) => initiatePlanPurchase(plan._id, { gateway, channel }),
      authorize: authorizePlanPurchase,
      verify: verifyPlanPurchase,
    });
    setPaymentOpen(true);
  }

  function openPackPurchase(pack: CreditPack) {
    if (!purchasesEnabled) return;
    setPayment({
      title: t('billing.credits.buyTitle'),
      summary: t('billing.credits.packCredits', { credits: fmt.number(pack.credits) }),
      amount: pack.price,
      currency: pack.currency,
      successLabelKey: 'billing.toast.creditsAdded',
      paymentKind: 'topup',
      initiate: (gateway, channel) => initiateTopup({ packCode: pack.code, gateway, channel }),
      authorize: authorizeTopup,
      verify: verifyTopup,
    });
    setPaymentOpen(true);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <CardSkeleton lines={4} />
          <CardSkeleton lines={4} />
        </div>
        <PlansSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={load}>
          {t('common.actions.retry')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SettingsSections>
        {/* Plan + wallet sit side by side from lg; below that they are two
            sections in the same flow, separated by a rule on mobile. */}
        <div className="grid max-md:divide-y md:gap-6 lg:grid-cols-2">
          {current && <CurrentPlanCard data={current} productCount={productCount} />}
          {balance !== null && (
            <CreditWalletCard balance={balance} packs={packs} onBuyPack={openPackPurchase} />
          )}
        </div>

        {storage && <StorageUsageCard storage={storage} onViewPlans={scrollToPlans} />}

        <SettingsSection
          ref={plansRef}
          title={t('billing.plans.title')}
          info={t('billing.plans.info')}
        >
          <PlansCatalog plans={plans} current={current} onBuy={openPlanPurchase} />
        </SettingsSection>

        <SavedPaymentMethodsCard />

        <BillingSettingsCard />
      </SettingsSections>

      {purchasesEnabled && payment && (
        <PaymentDialog
          open={paymentOpen}
          onOpenChange={setPaymentOpen}
          title={payment.title}
          summary={payment.summary}
          amount={payment.amount}
          currency={payment.currency}
          successLabelKey={payment.successLabelKey}
          paymentKind={payment.paymentKind}
          initiate={payment.initiate}
          authorize={payment.authorize}
          verify={payment.verify}
          onPaid={refreshAfterPayment}
        />
      )}
    </div>
  );
}
