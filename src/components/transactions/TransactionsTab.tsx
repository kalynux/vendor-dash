import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ActiveFilterChips,
  FilterChips,
  FilterSection,
  FilterSheet,
  SearchFilterBar,
} from '@/components/filters';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { fetchTransactions } from '@/services/transactions.service';
import type {
  Transaction,
  TransactionCategory,
  TransactionsListMeta,
} from '@/types/transactions.types';
import { LedgerSkeleton } from '@/components/billing/BillingSkeletons';
import { GATEWAYS } from '@/components/billing/billing.constants';
import { useTranslation, useFormatters, useApiError, type TranslationKey } from '@/i18n';
import {
  TRANSACTION_CATEGORY_TABS,
  categoryLabel,
  transactionStatusMeta,
  transactionAmount,
  isReversalTransaction,
} from './transactions.constants';

const PAGE_LIMIT = 20;

type CategoryFilter = TransactionCategory | 'all';

/**
 * Unified account-activity feed: plan purchases, credit top-ups & usage, and sales
 * earnings in one place. Sub-tabs filter by `category` via the same endpoint.
 *
 * `refreshKey` bumps to force a reload after a successful purchase elsewhere.
 */
export function TransactionsTab({ refreshKey = 0 }: { refreshKey?: number }) {
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const fmt = useFormatters();
  const apiError = useApiError();

  // The gateway catalog lives in billing; resolve its label key for display.
  const gatewayLabel = (gateway: string) => {
    const meta = GATEWAYS.find((g) => g.value === gateway);
    return meta ? t(meta.labelKey) : gateway;
  };
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [search, setSearch] = useState('');
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [rows, setRows] = useState<Transaction[]>([]);
  const [meta, setMeta] = useState<TransactionsListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (p: number, cat: CategoryFilter) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchTransactions({
          page: p,
          limit: PAGE_LIMIT,
          category: cat === 'all' ? undefined : cat,
        });
        setRows(res.data);
        setMeta(res.meta);
      } catch (err) {
        setError(apiError.resolve(err, { fallbackKey: 'transactions.errors.loadFailed' }));
        setRows([]);
        setMeta(null);
      } finally {
        setLoading(false);
      }
    },
    [apiError],
  );

  // Reset to page 1 when the category changes or a purchase succeeds.
  useEffect(() => {
    setPage(1);
  }, [category, refreshKey]);

  useEffect(() => {
    load(page, category);
  }, [load, page, category, refreshKey]);

  const activeFilterCount = category === 'all' ? 0 : 1;
  const categoryLabelFor = (value: CategoryFilter) => {
    const tab = TRANSACTION_CATEGORY_TABS.find((entry) => entry.value === value);
    return tab ? t(tab.labelKey) : value;
  };

  // The endpoint takes no `search` param, so matching is local — it only covers
  // the page currently loaded, which the hint below the bar spells out.
  const query = search.trim().toLowerCase();
  const visibleRows = query
    ? rows.filter((tx) =>
      [
        tx.description,
        categoryLabel(tx.category, t),
        transactionStatusMeta(tx.status, t).label,
        tx.gateway ? gatewayLabel(tx.gateway) : '',
      ].some((field) => field.toLowerCase().includes(query)))
    : rows;
  const searchIsPartial = Boolean(query) && (meta?.totalPages ?? 1) > 1;

  const toolbar = (
    <div
      className={cn(
        'space-y-3',
        // Full-bleed on mobile: the row sits directly on the page with the same
        // 16px gutter as the list below it, no card inset.
        isMobile && 'border-b px-4 py-3',
      )}
    >
      <SearchFilterBar
        value={search}
        onChange={setSearch}
        placeholder={t('transactions.searchPlaceholder')}
        activeFilterCount={activeFilterCount}
        onOpenFilters={() => setFilterSheetOpen(true)}
        filterLabel={t('transactions.filterTitle')}
      />
      {searchIsPartial && (
        <p className="text-xs text-muted-foreground">
          {t('transactions.searchPartial', {
            page: meta?.page ?? 1,
            total: meta?.totalPages ?? 1,
          })}
        </p>
      )}
      <ActiveFilterChips
        chips={category === 'all'
          ? []
          : [{
            key: 'category',
            label: categoryLabelFor(category),
            onRemove: () => setCategory('all'),
          }]}
      />
    </div>
  );

  const filterSheet = (
    <FilterSheet
      open={filterSheetOpen}
      onOpenChange={setFilterSheetOpen}
      title={t('transactions.filterTitle')}
      activeCount={activeFilterCount}
      onClear={() => setCategory('all')}
      applyLabel={t('transactions.applyFilters')}
    >
      <FilterSection title={t('transactions.categorySection')}>
        <FilterChips
          options={TRANSACTION_CATEGORY_TABS
            .filter((tab) => tab.value !== 'all')
            .map((tab) => ({
              value: tab.value as TransactionCategory,
              labelKey: tab.labelKey as TranslationKey,
            }))}
          value={category === 'all' ? undefined : category}
          onChange={(v) => setCategory(v ?? 'all')}
          allLabel={t('transactions.allActivity')}
        />
      </FilterSection>
    </FilterSheet>
  );

  const paginationBar = meta && (
    <div
      className={cn(
        'flex items-center justify-between text-sm text-muted-foreground',
        isMobile && 'px-4 py-3',
      )}
    >
      <span>
        {t('common.pagination.pageOf', { page: meta.page, total: meta.totalPages || 1 })}
      </span>
      {meta.totalPages > 1 && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={meta.page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {t('common.pagination.previous')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={meta.page >= meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('common.pagination.next')}
          </Button>
        </div>
      )}
    </div>
  );

  // ─── Mobile: edge-to-edge rows separated by hairlines, no card chrome ───────
  if (isMobile) {
    return (
      <div>
        {toolbar}
        {filterSheet}

        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b px-4 py-3">
              <div className="flex-1 space-y-2">
                <div className="h-4 w-2/5 animate-pulse rounded bg-muted" />
                <div className="h-3 w-24 animate-pulse rounded bg-muted" />
              </div>
              <div className="h-4 w-16 animate-pulse rounded bg-muted" />
            </div>
          ))
        ) : error ? (
          <div className="border-b bg-destructive/5 px-4 py-4 text-sm text-destructive">
            {error}{' '}
            <button className="underline" onClick={() => load(page, category)}>
              {t('common.actions.retry')}
            </button>
          </div>
        ) : visibleRows.length === 0 ? (
          <p className="px-4 py-16 text-center text-sm text-muted-foreground">
            {query ? t('transactions.empty.filtered') : t('transactions.empty.none')}
          </p>
        ) : (
          <>
            {visibleRows.map((tx) => {
              const amount = transactionAmount(tx, t, fmt.number, fmt.currency);
              return (
                <div key={tx.id} className="border-b px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{tx.description}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {fmt.date(tx.createdAt)}
                        {tx.gateway && ` · ${gatewayLabel(tx.gateway)}`}
                      </p>
                      <div className="mt-1">
                        <CategoryChip category={tx.category} />
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 flex-col items-end gap-1">
                      <p className={cn('text-sm font-semibold', amount.className)}>{amount.text}</p>
                      <StatusBadge status={tx.status} />
                    </div>
                  </div>
                  {isReversalTransaction(tx) && (
                    <p className="mt-2 text-xs text-orange-600">
                      {t('transactions.reversalNote')}
                    </p>
                  )}
                </div>
              );
            })}
            {paginationBar}
          </>
        )}
      </div>
    );
  }

  // ─── Desktop ────────────────────────────────────────────────────────────────
  // No card header: the page above already carries the title and subtitle, and
  // repeating them here read as two headings for one list.
  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        {toolbar}
        {filterSheet}

        {loading ? (
          <LedgerSkeleton />
        ) : error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}{' '}
            <button className="underline" onClick={() => load(page, category)}>
              {t('common.actions.retry')}
            </button>
          </div>
        ) : visibleRows.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            {query ? t('transactions.empty.filtered') : t('transactions.empty.none')}
          </p>
        ) : (
          <>
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">{t('transactions.columns.activity')}</th>
                    <th className="px-4 py-2.5 font-medium">{t('transactions.columns.date')}</th>
                    <th className="px-4 py-2.5 text-right font-medium">{t('transactions.columns.amount')}</th>
                    <th className="px-4 py-2.5 text-right font-medium">{t('transactions.columns.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((tx) => {
                    const amount = transactionAmount(tx, t, fmt.number, fmt.currency);
                    return (
                      <tr key={tx.id} className="border-b align-top last:border-0">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{tx.description}</span>
                            <CategoryChip category={tx.category} />
                          </div>
                          {tx.gateway && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {t('transactions.via', { gateway: gatewayLabel(tx.gateway) })}
                            </p>
                          )}
                          {isReversalTransaction(tx) && (
                            <p className="mt-0.5 text-xs text-orange-600">
                              {t('transactions.reversalNote')}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{fmt.date(tx.createdAt)}</td>
                        <td className={cn('px-4 py-2.5 text-right font-medium', amount.className)}>
                          {amount.text}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <StatusBadge status={tx.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {paginationBar}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function CategoryChip({ category }: { category: TransactionCategory }) {
  const { t } = useTranslation();
  return (
    <span className="rounded-full border bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
      {categoryLabel(category, t)}
    </span>
  );
}

function StatusBadge({ status }: { status: Transaction['status'] }) {
  const { t } = useTranslation();
  const meta = transactionStatusMeta(status, t);
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium', meta.class)}>
      {meta.label}
    </span>
  );
}
