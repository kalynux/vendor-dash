import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Loader2, PackageSearch } from 'lucide-react';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StockRequestActions } from './StockRequestActions';
import {
  STATUS_BADGE_CLASSES,
  STATUS_DOT_CLASSES,
  STATUS_LABEL_KEYS,
  shortVariantId,
} from './stockRequest.constants';
import { fetchStockRequestById } from '@/services/stockRequests.service';
import { cn } from '@/lib/utils';
import type { StockRequestDto } from '@/types/stock-requests.types';
import { useApiError, useFormatters, useTranslation } from '@/i18n';

export interface StockRequestDetailSheetProps {
  /** The request to show. `null` closes the sheet. */
  requestId: string | null;
  /** Already-loaded row, when the caller has it — skips the fetch on open. */
  seed?: StockRequestDto | null;
  onOpenChange: (open: boolean) => void;
  pendingKey: string | null;
  onApprove: (id: string, requestedQuantity: number) => void;
  onReject: (id: string, reason?: string) => void;
  onWithdraw: (id: string) => void;
  /** Filters the list to this SKU's whole negotiation history, and closes. */
  onFilterByVariant?: (variantId: string) => void;
}

/**
 * One request in full.
 *
 * A sheet rather than an inline row expand, because the `?view=<id>` deep-link
 * from a notification must open a request that is not on the loaded page (and
 * may already be terminal) — so it needs its own fetch. `seed` is an
 * optimization for the case where the caller already has the row.
 */
export function StockRequestDetailSheet({
  requestId,
  seed,
  onOpenChange,
  pendingKey,
  onApprove,
  onReject,
  onWithdraw,
  onFilterByVariant,
}: StockRequestDetailSheetProps) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const apiError = useApiError();

  const [fetched, setFetched] = useState<StockRequestDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // The seed is only good for the row it came from, so it is DERIVED rather than
  // copied into state — copying would need a sync setState in the effect below,
  // and would go stale the moment an action updates the parent's rows.
  const seedMatches = !!seed && seed.id === requestId;
  const request = seedMatches ? seed : fetched?.id === requestId ? fetched : null;

  const load = useCallback(async () => {
    if (!requestId) return;
    setLoading(true);
    setLoadError(null);
    try {
      setFetched(await fetchStockRequestById(requestId));
    } catch (err) {
      setFetched(null);
      setLoadError(apiError.resolve(err, { fallbackKey: 'inventory.requests.detail.loadFailed' }));
    } finally {
      setLoading(false);
    }
  }, [requestId, apiError]);

  useEffect(() => {
    // Nothing to fetch when the caller already handed us the row. A late
    // response for a previous id lands in `fetched` but is filtered out by the
    // `fetched?.id === requestId` check above, so no cancel flag is needed.
    if (!requestId || seedMatches) return;
    void load();
  }, [requestId, seedMatches, load]);

  // An action taken from inside this sheet updates the parent's rows, which
  // flows straight back down as a fresh `seed`.

  const quantityLabel = (value: number | null, infinite: boolean | null) => {
    if (infinite) return t('inventory.requests.unlimitedBefore');
    return value === null ? '—' : fmt.number(value);
  };

  const drifted =
    request &&
    request.currentQuantity !== null &&
    request.currentQuantity !== request.quantityBefore;

  return (
    <Sheet open={!!requestId} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <PackageSearch className="w-4 h-4 shrink-0" />
            {t('inventory.requests.detail.title')}
          </SheetTitle>
          <SheetDescription>
            {request
              ? request.sku ??
                t('inventory.requests.unknownSku', { id: shortVariantId(request.variantId) })
              : ''}
          </SheetDescription>
        </SheetHeader>

        <SheetBody className="space-y-5">
          {loading && (
            <div className="space-y-2">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          )}

          {!loading && loadError && (
            <div className="flex items-start gap-2 text-sm text-destructive">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{loadError}</span>
            </div>
          )}

          {!loading && request && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={cn('gap-1.5', STATUS_BADGE_CLASSES[request.status])}>
                  <span className={cn('size-1.5 rounded-full', STATUS_DOT_CLASSES[request.status])} />
                  {t(STATUS_LABEL_KEYS[request.status])}
                </Badge>
                {request.productTitle && (
                  <span className="text-sm text-muted-foreground truncate">{request.productTitle}</span>
                )}
              </div>

              {/* The three quantities. quantityBefore ≠ currentQuantity is DRIFT,
                  not an error — somebody moved the number after the proposal.
                  Showing both is the one thing an approver has to notice. */}
              <section className="space-y-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t('inventory.requests.detail.quantities')}
                </h3>
                <dl className="grid grid-cols-3 gap-2 rounded-lg border p-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      {t('inventory.requests.detail.quantityBefore')}
                    </dt>
                    <dd className="font-medium tabular-nums">
                      {quantityLabel(request.quantityBefore, request.infiniteBefore)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      {t('inventory.requests.detail.currentQuantity')}
                    </dt>
                    <dd className={cn('font-medium tabular-nums', drifted && 'text-amber-600')}>
                      {quantityLabel(request.currentQuantity, request.currentInfinite)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      {t('inventory.requests.detail.requestedQuantity')}
                    </dt>
                    <dd className="font-medium tabular-nums">
                      {quantityLabel(request.requestedQuantity, request.requestedInfinite)}
                    </dd>
                  </div>
                </dl>
                {drifted && (
                  <p className="flex items-start gap-1.5 text-xs text-amber-600">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    {t('inventory.requests.driftHint')}
                  </p>
                )}
              </section>

              {/* The proposer's own words — vendor/agency-authored, not a
                  backend error string, so it is safe to render verbatim. */}
              {request.note && (
                <section className="space-y-1.5">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t('inventory.requests.detail.note')}
                  </h3>
                  <p className="rounded-lg bg-muted/50 p-3 text-sm whitespace-pre-wrap">{request.note}</p>
                </section>
              )}

              {request.approval && (
                <p className="text-sm text-muted-foreground">
                  {t('inventory.requests.detail.approvedAt', {
                    date: fmt.dateTime(request.approval.at),
                  })}
                  {request.approval.quantityAtApply !== null && (
                    <>
                      {' '}
                      {t('inventory.requests.detail.approvedApplied', {
                        quantity: fmt.number(request.approval.quantityAtApply),
                      })}
                    </>
                  )}
                </p>
              )}
              {request.rejection && (
                <p className="text-sm text-muted-foreground">
                  {t('inventory.requests.detail.rejectedAt', {
                    date: fmt.dateTime(request.rejection.at),
                  })}
                  {request.rejection.reason && (
                    <>
                      {' '}
                      {t('inventory.requests.detail.rejectionReason', {
                        reason: request.rejection.reason,
                      })}
                    </>
                  )}
                </p>
              )}
              {request.withdrawal && (
                <p className="text-sm text-muted-foreground">
                  {t('inventory.requests.detail.withdrawnAt', {
                    date: fmt.dateTime(request.withdrawal.at),
                  })}
                </p>
              )}

              {request.statusHistory.length > 0 && (
                <section className="space-y-2">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t('inventory.requests.detail.history')}
                  </h3>
                  <ol className="space-y-2 border-l pl-4">
                    {request.statusHistory.map((event, i) => (
                      <li key={`${event.status}-${event.changedAt}-${i}`} className="relative text-sm">
                        <span
                          className={cn(
                            'absolute -left-[1.4rem] top-1.5 size-2 rounded-full',
                            STATUS_DOT_CLASSES[event.status],
                          )}
                        />
                        <p className="font-medium">{t(STATUS_LABEL_KEYS[event.status])}</p>
                        <p className="text-xs text-muted-foreground">
                          {fmt.dateTime(event.changedAt)} ·{' '}
                          {event.changedByRole === 'vendor'
                            ? t('inventory.requests.raisedByYou')
                            : t('inventory.requests.raisedByAgency')}
                        </p>
                        {event.note && (
                          <p className="mt-0.5 text-xs text-muted-foreground whitespace-pre-wrap">
                            {event.note}
                          </p>
                        )}
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link to={`/dashboard/product-edit/${request.productId}`}>
                    {t('inventory.requests.detail.viewProduct')}
                  </Link>
                </Button>
                {onFilterByVariant && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onFilterByVariant(request.variantId)}
                  >
                    {t('inventory.requests.detail.skuHistory')}
                  </Button>
                )}
              </div>
            </>
          )}
        </SheetBody>

        <SheetFooter>
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : request && request.availableActions.length > 0 ? (
            <StockRequestActions
              request={request}
              pendingKey={pendingKey}
              onApprove={onApprove}
              onReject={onReject}
              onWithdraw={onWithdraw}
            />
          ) : request ? (
            <p className="text-xs text-muted-foreground">{t('inventory.requests.detail.noActions')}</p>
          ) : null}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export default StockRequestDetailSheet;
