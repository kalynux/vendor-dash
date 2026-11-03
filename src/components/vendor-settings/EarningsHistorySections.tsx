import { cn } from '@/lib/utils';
import { useFormatters, useTranslation } from '@/i18n';
import { fetchEarningsAdjustments, fetchVendorAgencyClaims } from '@/services/earnings.service';
import type { EarningsAdjustment, VendorAgencyClaim } from '@/types/earnings.types';
import {
  adjustmentDebt,
  adjustmentKindLabel,
  adjustmentSentence,
  takenFromSentence,
} from './earningsAdjustments';
import { PagedSection } from './PagedSection';
import { usePagedList } from './usePagedList';

/** "Money taken back" — GET /vendor/earnings/adjustments (FRONTEND-CHANGELOG-refund-fees). */
export function EarningsAdjustmentsSection() {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const list = usePagedList<EarningsAdjustment>(fetchEarningsAdjustments);

  return (
    <PagedSection
      list={list}
      titleKey="account.earnings.adjustments.title"
      infoKey="account.earnings.adjustments.info"
      emptyKey="account.earnings.adjustments.empty"
      getKey={(row) => row.id}
      renderItem={(row) => {
        const takenBack = row.kind === 'refund_clawback';
        const from = takenFromSentence(row, t, fmt);
        const debt = adjustmentDebt(row);
        return (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-medium">
                {adjustmentKindLabel(row.kind, t)}
                <span className="font-normal text-muted-foreground"> · {fmt.date(row.createdAt)}</span>
              </p>
              <p className={cn('shrink-0 text-sm font-semibold tabular-nums', takenBack && 'text-destructive')}>
                {fmt.currency(takenBack ? -row.amount : row.amount, row.currency)}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">{adjustmentSentence(row, t, fmt)}</p>
            {from && <p className="text-xs text-muted-foreground">{from}</p>}
            {debt > 0 && (
              <p className="text-xs font-medium text-destructive">
                {t('account.earnings.adjustments.nowOwe', { amount: fmt.currency(debt, row.currency) })}
              </p>
            )}
          </>
        );
      }}
    />
  );
}

/** "Damage compensation" — GET /vendor/earnings/agency-claims. */
export function DamageCompensationSection() {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const list = usePagedList<VendorAgencyClaim>(fetchVendorAgencyClaims);

  return (
    <PagedSection
      list={list}
      titleKey="account.earnings.damageClaims.title"
      infoKey="account.earnings.damageClaims.info"
      emptyKey="account.earnings.damageClaims.empty"
      getKey={(claim) => claim.id}
      renderItem={(claim) => {
        const heading = [
          claim.orderNumber && t('account.earnings.damageClaims.rowOrder', { number: claim.orderNumber }),
          claim.trackingNumber && t('account.earnings.damageClaims.rowParcel', { number: claim.trackingNumber }),
        ]
          .filter(Boolean)
          .join(' · ');
        return (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 break-words text-sm font-medium">{heading || fmt.date(claim.createdAt)}</p>
              <p className="shrink-0 text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                {fmt.currency(claim.amount, claim.currency, { signDisplay: 'always' })}
              </p>
            </div>
            {/* ⛔ Not `claim.explanation`: the server words it for the agency
                ("your investigation fee…"). */}
            <p className="text-sm text-muted-foreground">
              {t('account.earnings.damageClaims.sentence', { count: claim.itemCount })}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('account.earnings.damageClaims.credited')} · {fmt.date(claim.createdAt)}
            </p>
          </>
        );
      }}
    />
  );
}
