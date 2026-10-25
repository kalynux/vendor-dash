import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { SettingsSection } from '@/components/vendor-settings/SettingsSection';
import { CardSkeleton } from '@/components/billing/BillingSkeletons';
import { cn } from '@/lib/utils';
import { useFormatters, useTranslation, type TranslationKey } from '@/i18n';
import { fetchEarningsAdjustments, fetchVendorAgencyClaims } from '@/services/earnings.service';
import type {
  EarningsAdjustment,
  EarningsPage,
  EarningsPageMeta,
  VendorAgencyClaim,
} from '@/types/earnings.types';
import { earningsErrorMessage } from './earnings.constants';
import {
  adjustmentDebt,
  adjustmentKindLabel,
  adjustmentSentence,
  takenFromSentence,
} from './earningsAdjustments';

const PAGE_SIZE = 10;

/** First page on mount, then "Load more" appends the next one. */
function usePagedList<T>(fetchPage: (page: number, limit: number) => Promise<EarningsPage<T>>) {
  const [items, setItems] = useState<T[]>([]);
  const [meta, setMeta] = useState<EarningsPageMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchPage(1, PAGE_SIZE);
      setItems(res.items);
      setMeta(res.meta);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [fetchPage]);

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = useCallback(async () => {
    if (!meta) return;
    setLoadingMore(true);
    try {
      const res = await fetchPage(meta.page + 1, PAGE_SIZE);
      setItems((prev) => [...prev, ...res.items]);
      setMeta(res.meta);
    } catch (err) {
      toast.error(earningsErrorMessage(err, 'account.earnings.adjustments.loadFailed'));
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, meta]);

  const hasMore = !!meta && meta.page < meta.pages;
  return { items, loading, loadingMore, error, hasMore, load, loadMore };
}

interface PagedSectionProps<T> {
  list: ReturnType<typeof usePagedList<T>>;
  titleKey: TranslationKey;
  infoKey: TranslationKey;
  emptyKey: TranslationKey;
  renderItem: (item: T) => ReactNode;
  getKey: (item: T) => string;
}

function PagedSection<T>({ list, titleKey, infoKey, emptyKey, renderItem, getKey }: PagedSectionProps<T>) {
  const { t } = useTranslation();

  if (list.loading) return <CardSkeleton lines={2} />;

  return (
    <SettingsSection title={t(titleKey)} info={<p>{t(infoKey)}</p>}>
      {list.error ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-destructive">
            {earningsErrorMessage(list.error, 'account.earnings.adjustments.loadFailed')}
          </p>
          <Button variant="outline" size="sm" onClick={list.load}>
            {t('common.actions.retry')}
          </Button>
        </div>
      ) : list.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t(emptyKey)}</p>
      ) : (
        <div className="space-y-3">
          <ul className="divide-y">
            {list.items.map((item) => (
              <li key={getKey(item)} className="space-y-1 py-3 first:pt-0">
                {renderItem(item)}
              </li>
            ))}
          </ul>
          {list.hasMore && (
            <Button
              variant="outline"
              size="sm"
              onClick={list.loadMore}
              disabled={list.loadingMore}
              className="w-full gap-2 sm:w-auto"
            >
              {list.loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('common.actions.loadMore')}
            </Button>
          )}
        </div>
      )}
    </SettingsSection>
  );
}

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
