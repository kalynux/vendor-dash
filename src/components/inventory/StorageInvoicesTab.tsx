import { useCallback, useEffect, useMemo, useState } from 'react';
import { Info, Receipt } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DataCard, DataCardList } from '@/components/ui/data-card';
import {
  ActiveFilterChips,
  FilterChips,
  FilterField,
  FilterSection,
  FilterSheet,
  FilterTriggerButton,
  type ActiveFilterChip,
  type FilterOption,
} from '@/components/filters';
import { InventoryPagination } from '@/components/inventory/InventoryPagination';
import { StorageInvoiceDetailSheet } from '@/components/inventory/StorageInvoiceDetailSheet';
import { StorageInvoiceStatusBadge } from '@/components/inventory/StorageInvoiceStatusBadge';
import { listStorageInvoices, storageInvoicePeriod } from '@/services/storage-invoices.service';
import { getActiveConnectedAgencies } from '@/services/agency-connections.service';
import type { StorageInvoice, StorageInvoiceStatus } from '@/types/storage-invoices.types';
import type { InventoryPageMeta } from '@/types/inventory.types';
import { useIsMobile } from '@/hooks/use-mobile';
import { useApiError, useFormatters, useTranslation } from '@/i18n';

const PAGE_LIMIT = 20;
const EMPTY_META: InventoryPageMeta = { page: 1, limit: PAGE_LIMIT, total: 0, totalPages: 1 };

const STATUS_OPTIONS: FilterOption<StorageInvoiceStatus>[] = [
  { value: 'open', labelKey: 'inventory.invoices.status.open' },
  { value: 'settled', labelKey: 'inventory.invoices.status.settled' },
  { value: 'void', labelKey: 'inventory.invoices.status.void' },
];

/** `YYYY-MM` — what both the API's `periodKey` and `<input type="month">` speak. */
const PERIOD_KEY = /^\d{4}-\d{2}$/;

/**
 * Monthly warehousing rent, one invoice per (agency, vendor) pair.
 *
 * 🔴 **No money moves through the platform.** No ledger entry, no wallet debit,
 * no payout, no commission — this rent is settled directly between the two
 * businesses. The banner saying so is not decoration: without it a vendor
 * reasonably assumes the amount comes out of their earnings, and it does not.
 *
 * 🔴 **Read-only.** Both routes are `GET`. There is no settle, dispute, pay or
 * download verb, so this surface renders and points disagreements at the agency.
 *
 * There is deliberately no search field: the list query schema is **strict**, so
 * an unknown parameter is a 400 — a search box would have nothing to send. The
 * two filters below are the entire supported set (`vendorId` is accepted and
 * ignored, since the caller is already the scope).
 */
export function StorageInvoicesTab() {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const apiError = useApiError();
  const isMobile = useIsMobile();

  const [rows, setRows] = useState<StorageInvoice[]>([]);
  const [meta, setMeta] = useState<InventoryPageMeta>(EMPTY_META);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StorageInvoiceStatus | undefined>();
  const [period, setPeriod] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [detail, setDetail] = useState<StorageInvoice | null>(null);
  /** agencyId → display name. Best-effort; an invoice outlives its connection. */
  const [agencyNames, setAgencyNames] = useState<Record<string, string>>({});

  // A half-typed month is not a filter. Sending `2026-0` would be a 400 on a
  // strict schema, so the value is only applied once it is a complete YYYY-MM.
  const appliedPeriod = PERIOD_KEY.test(period) ? period : undefined;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listStorageInvoices({
        page,
        limit: PAGE_LIMIT,
        status,
        periodKey: appliedPeriod,
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (err) {
      apiError.toast(err, { fallbackKey: 'inventory.invoices.errors.loadFailed' });
    } finally {
      setLoading(false);
    }
  }, [page, status, appliedPeriod, apiError]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Agency names, resolved once per mount and only when there is something to
   * name — the invoice itself carries `agencyId` and nothing else, and a raw
   * ObjectId is not an answer to "who is billing me".
   *
   * Best-effort by design: this resolves *active* connections, and an invoice
   * outlives the relationship that produced it. An unresolved id falls back to a
   * neutral label rather than to the id.
   */
  useEffect(() => {
    if (rows.length === 0) return;
    const missing = rows.some((r) => !agencyNames[r.agencyId]);
    if (!missing) return;
    let cancelled = false;
    getActiveConnectedAgencies()
      .then(({ agencies }) => {
        if (cancelled) return;
        setAgencyNames((prev) => {
          const next = { ...prev };
          for (const agency of agencies) next[agency.id] = agency.agencyName;
          return next;
        });
      })
      .catch(() => {
        // A missing name degrades to "Storage agency" — not worth a toast on a
        // list that otherwise loaded.
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const agencyLabel = useCallback(
    (agencyId: string) => agencyNames[agencyId] ?? t('inventory.invoices.unknownAgency'),
    [agencyNames, t],
  );

  const periodLabel = useCallback(
    (invoice: StorageInvoice) => {
      // 🔴 From `periodKey`, never `periodEnd` — that boundary is exclusive, so
      // a July invoice carries 1 August and would render as the wrong month.
      const date = storageInvoicePeriod(invoice);
      return date ? fmt.date(date, 'monthYear') : invoice.periodKey;
    },
    [fmt],
  );

  const activeFilterCount = (status ? 1 : 0) + (appliedPeriod ? 1 : 0);

  const clearFilters = useCallback(() => {
    setStatus(undefined);
    setPeriod('');
    setPage(1);
  }, []);

  const activeChips = useMemo<ActiveFilterChip[]>(() => {
    const chips: ActiveFilterChip[] = [];
    if (status) {
      chips.push({
        key: 'status',
        label: t(`inventory.invoices.status.${status}` as const),
        onRemove: () => {
          setStatus(undefined);
          setPage(1);
        },
      });
    }
    if (appliedPeriod) {
      chips.push({
        key: 'period',
        label: appliedPeriod,
        onRemove: () => {
          setPeriod('');
          setPage(1);
        },
      });
    }
    return chips;
  }, [status, appliedPeriod, t]);

  return (
    <div className="space-y-3">
      {/*
        The one thing a vendor must not get wrong about this screen. Placed above
        the list rather than inside the detail sheet, because the misconception
        ("this comes out of my payouts") forms from the totals in the list.
      */}
      <Alert>
        <Info className="size-4" />
        <AlertDescription>{t('inventory.invoices.settlementNotice')}</AlertDescription>
      </Alert>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {t('inventory.invoices.countSummary', { count: meta.total })}
          </p>
          <FilterTriggerButton
            onClick={() => setFiltersOpen(true)}
            activeCount={activeFilterCount}
            label={t('inventory.invoices.filterTitle')}
          />
        </div>
        <ActiveFilterChips chips={activeChips} onClearAll={clearFilters} />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
              <span className="sr-only">{t('common.a11y.loading')}</span>
            </div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center">
              <Receipt className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground">
                {activeFilterCount > 0
                  ? t('inventory.invoices.empty.filtered')
                  : t('inventory.invoices.empty.none')}
              </p>
              {activeFilterCount === 0 && (
                <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                  {t('inventory.invoices.empty.noneHint')}
                </p>
              )}
            </div>
          ) : isMobile ? (
            <DataCardList>
              {rows.map((invoice) => (
                <DataCard
                  key={invoice.id}
                  title={periodLabel(invoice)}
                  subtitle={agencyLabel(invoice.agencyId)}
                  trailing={<StorageInvoiceStatusBadge status={invoice.status} />}
                  onClick={() => setDetail(invoice)}
                  actionLabel={t('inventory.invoices.viewBreakdown')}
                  fields={[
                    {
                      label: t('inventory.invoices.fields.skus'),
                      value: fmt.number(invoice.skuCount),
                    },
                    {
                      label: t('inventory.invoices.fields.total'),
                      value: fmt.currency(invoice.total),
                    },
                  ]}
                />
              ))}
            </DataCardList>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('inventory.invoices.columns.period')}</TableHead>
                  <TableHead>{t('inventory.invoices.columns.agency')}</TableHead>
                  <TableHead className="text-right">
                    {t('inventory.invoices.fields.skus')}
                  </TableHead>
                  <TableHead className="text-right">
                    {t('inventory.invoices.fields.units')}
                  </TableHead>
                  <TableHead className="text-right">
                    {t('inventory.invoices.fields.total')}
                  </TableHead>
                  <TableHead>{t('inventory.invoices.fields.status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((invoice) => (
                  <TableRow
                    key={invoice.id}
                    className="cursor-pointer"
                    onClick={() => setDetail(invoice)}
                  >
                    <TableCell className="font-medium">{periodLabel(invoice)}</TableCell>
                    <TableCell className="max-w-[220px] truncate text-sm">
                      {agencyLabel(invoice.agencyId)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {fmt.number(invoice.skuCount)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {fmt.number(invoice.unitCount)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {fmt.currency(invoice.total)}
                    </TableCell>
                    <TableCell>
                      <StorageInvoiceStatusBadge status={invoice.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <InventoryPagination meta={meta} page={page} onPage={setPage} loading={loading} />
        </CardContent>
      </Card>

      <FilterSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        activeCount={activeFilterCount}
        onClear={clearFilters}
      >
        <FilterSection title={t('inventory.invoices.filters.status')}>
          <FilterChips
            options={STATUS_OPTIONS}
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            allLabel={t('inventory.invoices.filters.anyStatus')}
          />
        </FilterSection>
        <FilterSection title={t('inventory.invoices.filters.period')}>
          <FilterField htmlFor="storage-invoice-period">
            <Input
              id="storage-invoice-period"
              type="month"
              value={period}
              onChange={(e) => {
                setPeriod(e.target.value);
                setPage(1);
              }}
            />
          </FilterField>
        </FilterSection>
      </FilterSheet>

      <StorageInvoiceDetailSheet
        invoiceId={detail?.id ?? null}
        seed={detail}
        agencyName={detail ? agencyLabel(detail.agencyId) : undefined}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
      />
    </div>
  );
}
