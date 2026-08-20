import { Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useTranslation, useFormatters } from '@/i18n';
import { purchasesEnabled } from '@/platform/purchases';
import type { PricingPlan, CurrentPlanData } from '@/types/billing.types';
import { formatTerm, formatProductCap, planAccent } from './billing.constants';
import { PurchasesUnavailable } from './PurchasesUnavailable';

interface PlansCatalogProps {
  plans: PricingPlan[];
  current: CurrentPlanData | null;
  onBuy: (plan: PricingPlan) => void;
}

export function PlansCatalog({ plans, current, onBuy }: PlansCatalogProps) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const activeCode = current?.active.plan.code;
  const hasPending = !!current?.pending;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {plans.map((plan) => {
        const isCurrent = plan.code === activeCode;
        const isFree = plan.price === 0;
        return (
          <Card
            key={plan._id}
            className={cn('flex flex-col border-2', planAccent(plan.code), isCurrent && 'ring-1 ring-primary')}
          >
            <CardHeader className="space-y-1">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{plan.name}</CardTitle>
                {isCurrent && <Badge>{t('billing.plans.current')}</Badge>}
              </div>
              <div>
                <span className="text-2xl font-bold">
                  {isFree ? t('billing.plans.free') : fmt.currency(plan.price, plan.currency)}
                </span>
                {!isFree && (
                  <span className="text-sm text-muted-foreground">
                    {' · '}
                    {formatTerm(plan.term_days, t)}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-3">
              <ul className="space-y-2 text-sm">
                <Feature>
                  {t('billing.plans.creditsOnActivation', {
                    credits: fmt.number(plan.credit_allowance),
                  })}
                </Feature>
                <Feature>
                  {t('billing.plans.activeProductsFeature', {
                    cap: formatProductCap(plan.max_active_products, t, fmt.number),
                  })}
                </Feature>
                <Feature>
                  {t('billing.plans.commissionFeature', { percent: plan.commission_percent })}
                </Feature>
              </ul>
              <div className="mt-auto">
                {isCurrent ? (
                  <Button variant="outline" className="w-full" disabled>
                    {t('billing.plans.yourPlan')}
                  </Button>
                ) : isFree ? (
                  <Button variant="outline" className="w-full" disabled>
                    {t('billing.plans.defaultTier')}
                  </Button>
                ) : purchasesEnabled ? (
                  <Button
                    className="w-full"
                    onClick={() => onBuy(plan)}
                    disabled={hasPending}
                    title={hasPending ? t('billing.plans.queuedHint') : undefined}
                  >
                    {hasPending ? t('billing.plans.queued') : t('billing.plans.choose')}
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        );
      })}
      </div>

      {/* Once, under the grid, rather than a dead button on each paid card: the
          plans themselves are still worth reading on a phone — prices, caps and
          commission are the reason a vendor opens this screen — and only the act
          of buying moved (P5.2). A disabled "Choose" on every card would say the
          app was broken rather than that the purchase lives elsewhere. */}
      {!purchasesEnabled && <PurchasesUnavailable message={t('billing.mobile.plans')} />}
    </div>
  );
}

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <span>{children}</span>
    </li>
  );
}
