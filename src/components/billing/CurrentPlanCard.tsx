import { CalendarClock, Package, Percent, Sparkles } from 'lucide-react';
import { SettingsSection } from '@/components/vendor-settings/SettingsSection';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useTranslation, useFormatters } from '@/i18n';
import type { CurrentPlanData } from '@/types/billing.types';
import {
  formatTerm,
  formatProductCap,
  subscriberPlanStatusLabel,
} from './billing.constants';

interface CurrentPlanCardProps {
  data: CurrentPlanData;
  /** Active product count (for slot usage); null while loading/unknown. */
  productCount: number | null;
}

export function CurrentPlanCard({ data, productCount }: CurrentPlanCardProps) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const { plan, subscriberPlan } = data.active;
  const cap = plan.max_active_products;
  const used = productCount ?? 0;
  const pct = cap && cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;
  const isFree = plan.price === 0;

  return (
    <SettingsSection
      title={
        <span className="flex items-center gap-2">
          {plan.name}
          <Badge variant={subscriberPlan.status === 'active' ? 'default' : 'secondary'}>
            {subscriberPlanStatusLabel(subscriberPlan.status, t)}
          </Badge>
        </span>
      }
      description={
        isFree
          ? t('billing.plan.freePlan')
          : t('billing.plan.price', {
              price: fmt.currency(plan.price, plan.currency),
              term: formatTerm(plan.term_days, t),
            })
      }
      info={t('billing.plan.info')}
      contentClassName="space-y-4"
    >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-3">
          <Stat
            icon={<CalendarClock className="h-4 w-4" />}
            label={t('billing.plan.renewsOrExpires')}
            value={
              subscriberPlan.expires_at
                ? fmt.date(subscriberPlan.expires_at)
                : t('billing.plan.neverExpires')
            }
          />
          <Stat
            icon={<Percent className="h-4 w-4" />}
            label={t('billing.plan.commission')}
            value={`${plan.commission_percent}%`}
          />
          <Stat
            icon={<Sparkles className="h-4 w-4" />}
            label={t('billing.plan.creditAllowance')}
            value={fmt.number(plan.credit_allowance)}
          />
        </div>

        {/* Product slots */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Package className="h-4 w-4" /> {t('billing.plan.activeProducts')}
            </span>
            <span className="font-medium">
              {productCount === null ? t('common.labels.emptyValue') : fmt.number(used)}
              {' / '}
              {formatProductCap(cap, t, fmt.number)}
            </span>
          </div>
          {cap !== null && <Progress value={pct} />}
        </div>

        {/* Pending plan banner */}
        {data.pending && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
            <p className="font-medium text-primary">
              {t('billing.plan.pendingQueued', { name: data.pending.plan.name })}
            </p>
            <p className="text-muted-foreground">
              {data.pending.subscriberPlan.started_at
                ? t('billing.plan.pendingStartsOn', {
                    date: fmt.date(data.pending.subscriberPlan.started_at),
                  })
                : t('billing.plan.pendingStarts')}
            </p>
          </div>
        )}
    </SettingsSection>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg p-0 sm:border sm:bg-muted/30 sm:p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="shrink-0">{icon}</span>
        <span className="min-w-0 truncate">{label}</span>
      </div>
      <p className="mt-1 text-sm font-semibold sm:text-base">{value}</p>
    </div>
  );
}
