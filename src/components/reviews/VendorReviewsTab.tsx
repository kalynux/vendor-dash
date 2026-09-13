import { useCallback, useEffect, useMemo, useState } from 'react';
import { Info, Star } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
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
  FilterSection,
  FilterSheet,
  FilterTriggerButton,
  type ActiveFilterChip,
  type FilterOption,
} from '@/components/filters';
import { InventoryPagination } from '@/components/inventory/InventoryPagination';
import { ReviewStatusBadge } from '@/components/reviews/ReviewStatusBadge';
import { StarRating } from '@/components/reviews/StarRating';
import { listVendorReviews } from '@/services/reviews.service';
import type { ReviewStatus, VendorReview } from '@/types/reviews.types';
import type { InventoryPageMeta } from '@/types/inventory.types';
import { useIsMobile } from '@/hooks/use-mobile';
import { useApiError, useFormatters, useTranslation } from '@/i18n';

const PAGE_LIMIT = 20;
const EMPTY_META: InventoryPageMeta = { page: 1, limit: PAGE_LIMIT, total: 0, totalPages: 1 };

const STATUS_OPTIONS: FilterOption<ReviewStatus>[] = [
  { value: 'published', labelKey: 'agency.reviews.status.published' },
  { value: 'pending', labelKey: 'agency.reviews.status.pending' },
  { value: 'rejected', labelKey: 'agency.reviews.status.rejected' },
];

/**
 * A short, stable handle for a delivery.
 *
 * ⚠ A review carries **no targets** — no agent, no agency, no order, by design
 * (api-doc/vendor/reviews.md § 2). All it has is `subjectId`, a shipment id, and
 * there is no route that resolves one back to an order. So the row cannot say
 * "the delivery of order #1234" without scanning the whole order list, which is
 * not worth doing for a label.
 *
 * The last six characters are what support and the agency can both search on,
 * which is the actual job this string has to do.
 */
function deliveryRef(subjectId: string): string {
  return subjectId.slice(-6).toUpperCase();
}

/**
 * The delivery reviews this vendor has written.
 *
 * 🔴 **Write-once.** The router declares exactly three routes — no `PATCH`, no
 * `PUT`, no `DELETE`, no `/:id`. This surface therefore offers no row action of
 * any kind, and it must stay that way: an edit affordance here would have
 * nothing behind it.
 *
 * 🔴 **The list is scoped to the USER, not the vendor role.** It filters on the
 * author's user id, so a person holding both a vendor and a customer role gets
 * their customer *product* reviews back in the same payload. Those are filtered
 * out below — see the note on `filteredOut` for what that costs.
 *
 * There is deliberately no search field: the query schema is **strict**, so an
 * unknown parameter is a 400 rather than being ignored. `status` is the only
 * filter the endpoint has.
 */
export function VendorReviewsTab() {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const apiError = useApiError();
  const isMobile = useIsMobile();

  const [rows, setRows] = useState<VendorReview[]>([]);
  /**
   * How many rows this page returned that were not delivery reviews. Tracked
   * because `meta` counts the unfiltered set: on a dual-role account a whole
   * page can be product reviews, leaving this screen empty while the pager still
   * says "page 1 of 3". Without this the vendor reads that as a bug.
   */
  const [filteredOut, setFilteredOut] = useState(0);
  const [meta, setMeta] = useState<InventoryPageMeta>(EMPTY_META);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<ReviewStatus | undefined>();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // `includeOtherRoles` so the raw page is visible here and the filtering is
      // done where the count can be reported. The service's own filter would
      // hide how many rows it dropped.
      const res = await listVendorReviews(
        { page, limit: PAGE_LIMIT, status },
        { includeOtherRoles: true },
      );
      const deliveries = res.data.filter((r) => r.subjectType === 'delivery');
      setRows(deliveries);
      setFilteredOut(res.data.length - deliveries.length);
      setMeta(res.meta);
    } catch (err) {
      apiError.toast(err, { fallbackKey: 'agency.reviews.errors.loadFailed' });
    } finally {
      setLoading(false);
    }
  }, [page, status, apiError]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeFilterCount = status ? 1 : 0;

  const clearFilters = useCallback(() => {
    setStatus(undefined);
    setPage(1);
  }, []);

  const activeChips = useMemo<ActiveFilterChip[]>(() => {
    if (!status) return [];
    return [
      {
        key: 'status',
        label: t(`agency.reviews.status.${status}` as const),
        onRemove: () => {
          setStatus(undefined);
          setPage(1);
        },
      },
    ];
  }, [status, t]);

  /** The comment, or a placeholder — a rating on its own carries neither field. */
  const commentOf = useCallback(
    (r: VendorReview) => r.title || r.body || null,
    [],
  );

  return (
    <div className="space-y-3">
      {/*
        Two things a vendor cannot work out from the rows themselves: nothing here
        can be changed, and a rating with a comment is not live yet. Both are
        stated once, above the list, rather than repeated per row.
      */}
      <Alert>
        <Info className="size-4" />
        <AlertDescription>{t('agency.reviews.writeOnceNotice')}</AlertDescription>
      </Alert>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {t('agency.reviews.countSummary', { count: rows.length })}
          </p>
          <FilterTriggerButton
            onClick={() => setFiltersOpen(true)}
            activeCount={activeFilterCount}
            label={t('agency.reviews.filterTitle')}
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
              <Star className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground">
                {filteredOut > 0
                  ? t('agency.reviews.empty.otherRolesOnly')
                  : activeFilterCount > 0
                    ? t('agency.reviews.empty.filtered')
                    : t('agency.reviews.empty.none')}
              </p>
              {activeFilterCount === 0 && filteredOut === 0 && (
                <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                  {t('agency.reviews.empty.noneHint')}
                </p>
              )}
            </div>
          ) : isMobile ? (
            <DataCardList>
              {rows.map((r) => (
                <DataCard
                  key={r.id}
                  title={<StarRating value={r.rating} />}
                  subtitle={t('agency.reviews.deliveryRef', { ref: deliveryRef(r.subjectId) })}
                  trailing={<ReviewStatusBadge status={r.status} />}
                  fields={[
                    {
                      label: t('agency.reviews.columns.submitted'),
                      value: fmt.date(r.createdAt),
                    },
                  ]}
                  footer={
                    commentOf(r) && (
                      <p className="text-sm text-muted-foreground">{commentOf(r)}</p>
                    )
                  }
                />
              ))}
            </DataCardList>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('agency.reviews.columns.rating')}</TableHead>
                  <TableHead>{t('agency.reviews.columns.delivery')}</TableHead>
                  <TableHead>{t('agency.reviews.columns.comment')}</TableHead>
                  <TableHead>{t('agency.reviews.columns.submitted')}</TableHead>
                  <TableHead>{t('agency.reviews.columns.status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  // No `onClick`: there is no detail route and nothing to edit.
                  <TableRow key={r.id}>
                    <TableCell>
                      <StarRating value={r.rating} size="sm" />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {deliveryRef(r.subjectId)}
                    </TableCell>
                    <TableCell className="max-w-[320px] text-sm">
                      {commentOf(r) ? (
                        <span className="line-clamp-2">{commentOf(r)}</span>
                      ) : (
                        <span className="text-muted-foreground">
                          {t('agency.reviews.ratingOnly')}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {fmt.date(r.createdAt)}
                    </TableCell>
                    <TableCell>
                      <ReviewStatusBadge status={r.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/*
            Shown whenever rows were dropped, not only when the page came out
            empty: the pager's totals come from `meta`, which counts what the
            server returned rather than what is on screen, so the two disagree by
            exactly this many.
          */}
          {!loading && filteredOut > 0 && (
            <p className="border-t px-4 py-3 text-xs text-muted-foreground">
              {t('agency.reviews.otherRolesHidden', { count: filteredOut })}
            </p>
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
        <FilterSection title={t('agency.reviews.filters.status')}>
          <FilterChips
            options={STATUS_OPTIONS}
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            allLabel={t('agency.reviews.filters.anyStatus')}
          />
        </FilterSection>
      </FilterSheet>
    </div>
  );
}
