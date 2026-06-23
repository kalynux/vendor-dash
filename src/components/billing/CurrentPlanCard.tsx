import { CalendarClock, Package, Percent, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { CurrentPlanData } from '@/types/billing.types';
import {
  formatMoney,
  formatDate,
  formatTerm,
  formatCredits,
  formatProductCap,
  vendorPlanStatusLabel,
} from './billing.constants';

interface CurrentPlanCardProps {
  data: CurrentPlanData;
  /** Active product count (for slot usage); null while loading/unknown. */
  productCount: number | null;
}

export function CurrentPlanCard({ data, productCount }: CurrentPlanCardProps) {
  const { plan, vendorPlan } = data.active;
  const cap = plan.max_active_products;
  const used = productCount ?? 0;
  const pct = cap && cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;
  const isFree = plan.price === 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              {plan.name}
              <Badge variant={vendorPlan.status === 'active' ? 'default' : 'secondary'}>
                {vendorPlanStatusLabel(vendorPlan.status)}
              </Badge>
            </CardTitle>
            <CardDescription>
              {isFree ? 'Free plan' : `${formatMoney(plan.price, plan.currency)} · ${formatTerm(plan.term_days)}`}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat
            icon={<CalendarClock className="h-4 w-4" />}
            label="Renews / expires"
            value={vendorPlan.expires_at ? formatDate(vendorPlan.expires_at) : 'Never expires'}
          />
          <Stat
            icon={<Percent className="h-4 w-4" />}
            label="Commission"
            value={`${plan.commission_percent}%`}
          />
          <Stat
            icon={<Sparkles className="h-4 w-4" />}
            label="Credit allowance"
            value={formatCredits(plan.credit_allowance)}
          />
        </div>

        {/* Product slots */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Package className="h-4 w-4" /> Active products
            </span>
            <span className="font-medium">
              {productCount === null ? '—' : used} / {formatProductCap(cap)}
            </span>
          </div>
          {cap !== null && <Progress value={pct} />}
        </div>

        {/* Pending plan banner */}
        {data.pending && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
            <p className="font-medium text-primary">
              {data.pending.plan.name} queued
            </p>
            <p className="text-muted-foreground">
              Starts when your current plan ends
              {data.pending.vendorPlan.started_at
                ? ` on ${formatDate(data.pending.vendorPlan.started_at)}`
                : ''}
              .
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
