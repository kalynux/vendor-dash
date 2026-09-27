import { Skeleton } from '@/components/ui/skeleton';
import { InfoHint } from '@/components/ui/info-hint';
import { useAnalyticsStore } from '@/store';
import { cn } from '@/lib/utils';
import { useTranslation, useFormatters } from '@/i18n';

/**
 * The dashboard endpoint's money, read top to bottom like a statement: gross
 * sales, each deduction on its own line, net revenue in bold — then bookings
 * and adjustments down to net earnings. Refunds to customers sit underneath as
 * information only; their effect is already in "earnings taken back".
 */
export function EarningsSummary() {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const { summary, isLoading } = useAnalyticsStore();

  if (!summary) {
    if (!isLoading) return null;
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
    );
  }

  const { sales, bookings, adjustments, netEarnings, refunds } = summary;
  // Analytics amounts carry no per-row currency: platform default (XAF).
  const money = (value: number) => fmt.currency(value);
  const minus = (value: number) => (value === 0 ? money(0) : `−${money(value)}`);
  const plus = (value: number) => (value === 0 ? money(0) : `+${money(value)}`);
  // Either one null means a COD sale had no recorded delivery fee, so the two
  // cannot be told apart — only the combined figure is reliable.
  const splitFees = sales.deliveryFee !== null && sales.codFee !== null;

  return (
    <div className="space-y-4 text-sm">
      <dl className="space-y-2">
        <Row label={t('analytics.earnings.grossSales')} value={money(sales.grossSales)} />
        <Row label={t('analytics.earnings.bargainFee')} value={minus(sales.bargainFee)} muted />
        <Row label={t('analytics.earnings.commission')} value={minus(sales.commission)} muted />
        {splitFees ? (
          <>
            <Row label={t('analytics.earnings.deliveryFee')} value={minus(sales.deliveryFee ?? 0)} muted />
            <Row label={t('analytics.earnings.codFee')} value={minus(sales.codFee ?? 0)} muted />
          </>
        ) : (
          <Row
            label={t('analytics.earnings.deliveryAndCodFees')}
            value={minus(sales.deliveryAndCodFees)}
            muted
          />
        )}
        <Row
          label={t('analytics.earnings.netRevenue')}
          hint={t('analytics.earnings.netRevenueHint')}
          value={money(sales.netRevenue)}
          strong
          divided
        />
      </dl>

      <dl className="space-y-2">
        <Row label={t('analytics.earnings.bookings')} value={plus(bookings.netRevenue)} muted />
        <Row
          label={t('analytics.earnings.deliveryFeesReturned')}
          value={plus(adjustments.deliveryFeesReturned)}
          muted
        />
        <Row
          label={t('analytics.earnings.earningsReversed')}
          value={minus(adjustments.earningsReversed)}
          muted
        />
        <Row
          label={t('analytics.earnings.netEarnings')}
          hint={t('analytics.earnings.netEarningsHint')}
          value={money(netEarnings)}
          strong
          divided
        />
      </dl>

      {refunds.count > 0 && (
        <p className="text-xs text-muted-foreground">
          {t('analytics.earnings.refunds')}: {money(refunds.amount)} ·{' '}
          {t('analytics.earnings.refundsCount', { count: refunds.count })}.{' '}
          {t('analytics.earnings.refundsNote')}
        </p>
      )}
    </div>
  );
}

interface RowProps {
  label: string;
  value: string;
  hint?: string;
  muted?: boolean;
  strong?: boolean;
  divided?: boolean;
}

function Row({ label, value, hint, muted, strong, divided }: RowProps) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-3',
        divided && 'border-t pt-2',
      )}
    >
      <dt className={cn('flex items-center gap-1', muted && 'text-muted-foreground', strong && 'font-semibold')}>
        {label}
        {hint && <InfoHint label={label}>{hint}</InfoHint>}
      </dt>
      <dd
        className={cn(
          'shrink-0 tabular-nums',
          muted && 'text-muted-foreground',
          strong && 'text-base font-bold',
        )}
      >
        {value}
      </dd>
    </div>
  );
}
