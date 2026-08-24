import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Boxes,
  AlertTriangle,
  Lock,
  History as HistoryIcon,
  Loader2,
  PackageSearch,
  Pencil,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  fetchStockAlerts,
  fetchReservations,
  fetchStockHistory,
  bulkUpdateStock,
  bulkUpdateStockCsv,
} from '@/services/inventory.service';
import {
  fetchAwaitingMyDecisionCount,
  fetchStockRequests,
} from '@/services/stockRequests.service';
import { ApiError } from '@/types/api';
import type {
  StockAlert,
  StockReservation,
  StockHistoryLog,
  InventoryPageMeta,
  StockOperation,
  ReservationStatus,
  BulkStockRowError,
  BulkStockUpdateResult,
} from '@/types/inventory.types';
import type { StockRequestDto } from '@/types/stock-requests.types';

import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
// Both of this page's modals are `ResponsiveModal`, not `Dialog`: each is
// reached from a card on mobile, and a centred popup over a list of cards is the
// one place a bottom sheet obviously belongs.
import { ResponsiveModal } from '@/components/services/ResponsiveModal';
import { DataCard, DataCardList } from '@/components/ui/data-card';
import { useIsMobile } from '@/hooks/use-mobile';
import { useRouteSwipe } from '@/hooks/use-route-swipe';
import { MobilePageHeader } from '@/components/layout/MobilePageHeader';
import { SubPageHeader } from '@/components/layout/SubPageHeader';
import { StatTile } from '@/components/features/StatTile';
import { InventoryPagination } from '@/components/inventory/InventoryPagination';
import { StockRequestsTab } from '@/components/inventory/StockRequestsTab';
import { cn } from '@/lib/utils';
import { Trans, useApiError, useFormatters, useTranslation, type TranslationKey } from '@/i18n';

const PAGE_LIMIT = 20;
const EMPTY_META: InventoryPageMeta = { page: 1, limit: PAGE_LIMIT, total: 0, totalPages: 1 };
const MAX_CSV_BYTES = 5 * 1024 * 1024; // Backend limit — see api-doc/vendor/inventory.md

function TableSkeleton() {
  const { t } = useTranslation();
  return (
    <div className="p-4 space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
      <span className="sr-only">{t('common.a11y.loading')}</span>
    </div>
  );
}

function EmptyState({ icon: Icon, messageKey }: { icon: typeof Boxes; messageKey: TranslationKey }) {
  const { t } = useTranslation();
  return (
    <div className="py-12 text-center">
      <Icon className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
      <p className="text-muted-foreground">{t(messageKey)}</p>
    </div>
  );
}

// ─── Adjust-stock dialog (single-row bulk-update) ──────────────────────────

function AdjustStockDialog({
  alert,
  pendingRequest,
  onClose,
  onSaved,
  onViewRequest,
}: {
  alert: StockAlert | null;
  /** An open request on this SKU, if any — you cannot have two. */
  pendingRequest: StockRequestDto | null;
  onClose: () => void;
  onSaved: () => void;
  onViewRequest: (requestId: string) => void;
}) {
  const { t, tDynamic, hasKey } = useTranslation();
  const apiError = useApiError();
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (alert) setValue(String(alert.currentStock));
  }, [alert]);

  const save = useCallback(async () => {
    if (!alert) return;
    const qty = Number(value);
    if (!Number.isInteger(qty)) {
      toast.error(t('inventory.adjust.wholeNumber'));
      return;
    }
    setSaving(true);
    try {
      const result = await bulkUpdateStock([{ variantId: alert.variantId, quantity: qty }]);

      // Three groups, and only one of them means "the number changed".
      const refused = result.notRequested[0];
      if (refused) {
        // Almost always STOCK_REQUEST_ALREADY_PENDING — the vendor has to go
        // resolve that one first, so keep the dialog open.
        const key = `errors.codes.${refused.error}`;
        toast.error(hasKey(key) ? tDynamic(key) : t('inventory.errors.updateFailed'));
        onSaved();
        return;
      }

      const queued = result.requested[0];
      if (queued) {
        // An agency warehouses this SKU: nothing was written, a request was
        // raised. Saying "Stock updated" here is exactly the lie to avoid.
        toast.info(
          t('inventory.adjust.queued', {
            sku: alert.sku,
            from: alert.currentStock,
            to: queued.requestedQuantity,
          }),
        );
      } else {
        toast.success(t('inventory.adjust.updated', { sku: alert.sku, count: result.updated }));
      }
      onSaved();
      onClose();
    } catch (err) {
      apiError.toast(err, { fallbackKey: 'inventory.errors.updateFailed' });
    } finally {
      setSaving(false);
    }
  }, [alert, value, onSaved, onClose, t, tDynamic, hasKey, apiError]);

  return (
    <ResponsiveModal
      open={!!alert}
      onOpenChange={(o) => !o && onClose()}
      title={t('inventory.adjust.title')}
      description={
        alert ? (
          <Trans
            i18nKey="inventory.adjust.description"
            params={{ sku: alert.sku, product: alert.productTitle }}
            components={[<span className="font-medium" />]}
          />
        ) : null
      }
      desktopClassName="sm:max-w-sm"
      // A four-field form — a full-height sheet would be mostly empty.
      mobileClassName="h-auto max-h-[92dvh]"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t('common.actions.cancel')}
          </Button>
          {/* One open request per SKU — offer the way out rather than a Save
              that can only come back as STOCK_REQUEST_ALREADY_PENDING. */}
          {pendingRequest ? (
            <Button
              onClick={() => {
                onClose();
                onViewRequest(pendingRequest.id);
              }}
            >
              {t('inventory.adjust.viewRequest')}
            </Button>
          ) : (
            <Button onClick={save} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} {t('common.actions.save')}
            </Button>
          )}
        </>
      }
    >
      {alert && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground text-xs">{t('inventory.adjust.currentStock')}</p>
              <p className="text-lg font-semibold">{alert.currentStock}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground text-xs">{t('inventory.adjust.reserved')}</p>
              <p className="text-lg font-semibold">{alert.activeReservations}</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-stock">{t('inventory.adjust.newLevel')}</Label>
            <Input
              id="new-stock"
              type="number"
              // 16px on mobile: anything smaller and the WebView zooms the
              // viewport on focus, which leaves the sheet mis-scaled behind the
              // keyboard.
              className="h-11 text-base sm:h-9 sm:text-sm"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={!!pendingRequest}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              {pendingRequest
                ? t('inventory.adjust.hasOpenRequest')
                : t('inventory.adjust.newLevelHint')}
            </p>
          </div>
        </div>
      )}
    </ResponsiveModal>
  );
}

// ─── Import-CSV dialog (multipart bulk-update) ─────────────────────────────

const RESULT_GROUP_TONES = {
  success: 'border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400',
  warning: 'border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-400',
  destructive: 'border-destructive/40 bg-destructive/5 text-destructive',
} as const;

function ResultGroup({
  tone,
  heading,
  hint,
  children,
}: {
  tone: keyof typeof RESULT_GROUP_TONES;
  heading: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('rounded-lg border p-3', RESULT_GROUP_TONES[tone])}>
      <p className="text-sm font-medium">{heading}</p>
      {hint && <p className="mt-0.5 text-xs opacity-80">{hint}</p>}
      <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">{children}</div>
    </div>
  );
}

function ResultRow({ sku, detail }: { sku: string; detail: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 rounded bg-background/70 px-2 py-1.5 text-xs">
      <span className="truncate font-mono">{sku}</span>
      <span className="shrink-0 tabular-nums">{detail}</span>
    </div>
  );
}

function ImportCsvDialog({
  open,
  onOpenChange,
  onImported,
  onGoToRequests,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onImported: () => void;
  /** Queued/refused rows are resolved in the requests tab — send them there. */
  onGoToRequests: () => void;
}) {
  const { t, tDynamic, hasKey } = useTranslation();
  const fmt = useFormatters();
  const apiError = useApiError();
  /** Row failures ship a machine code; never print the backend's English text. */
  const rowErrorText = (e: BulkStockRowError) => {
    const key = `errors.codes.${e.error}`;
    return hasKey(key) ? tDynamic(key) : t('inventory.bulk.rowUnknownError');
  };
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [rowErrors, setRowErrors] = useState<BulkStockRowError[] | null>(null);
  const [result, setResult] = useState<BulkStockUpdateResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setFile(null);
    setUploading(false);
    setRowErrors(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  const pick = (f: File | null) => {
    setRowErrors(null);
    setResult(null);
    if (!f) {
      setFile(null);
      return;
    }
    const isCsv = f.name.toLowerCase().endsWith('.csv') || f.type === 'text/csv';
    if (!isCsv) {
      toast.error(t('inventory.bulk.notCsv'));
      return;
    }
    if (f.size > MAX_CSV_BYTES) {
      toast.error(t('inventory.bulk.tooLarge'));
      return;
    }
    setFile(f);
  };

  const upload = useCallback(async () => {
    if (!file) return;
    setUploading(true);
    setRowErrors(null);
    setResult(null);
    try {
      const res = await bulkUpdateStockCsv(file);
      onImported();

      // Only a batch where every row was WRITTEN can be reported as a plain
      // success and dismissed. Queued and refused rows have to be read, not
      // flashed — so the dialog stays open and shows the three groups.
      if (res.requested.length === 0 && res.notRequested.length === 0) {
        toast.success(t('inventory.bulk.imported', { count: res.updated, name: file.name }));
        onOpenChange(false);
        reset();
        return;
      }
      setResult(res);
    } catch (err) {
      // All-or-nothing: on any row failure nothing was changed. Surface the
      // per-row reasons inline so the vendor can fix and re-upload.
      if (err instanceof ApiError && err.rowErrors?.length) {
        setRowErrors(err.rowErrors);
      } else {
        apiError.toast(err, { fallbackKey: 'inventory.errors.csvInvalid' });
      }
    } finally {
      setUploading(false);
    }
  }, [file, onImported, onOpenChange, reset, t, apiError]);

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
      title={t('inventory.bulk.title')}
      description={
        <Trans
          i18nKey="inventory.bulk.description"
          components={[<span className="font-mono" />, <span className="font-mono" />]}
        />
      }
      desktopClassName="sm:max-w-lg"
      footer={
            result ? (
              <>
                {(result.requested.length > 0 || result.notRequested.length > 0) && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      reset();
                      onOpenChange(false);
                      onGoToRequests();
                    }}
                  >
                    {t('inventory.bulk.result.goToRequests')}
                  </Button>
                )}
                <Button
                  onClick={() => {
                    reset();
                    onOpenChange(false);
                  }}
                >
                  {t('inventory.bulk.result.done')}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    reset();
                    onOpenChange(false);
                  }}
                  disabled={uploading}
                >
                  {t('common.actions.cancel')}
                </Button>
                <Button onClick={upload} disabled={!file || uploading} className="gap-2">
                  {uploading && <Loader2 className="h-4 w-4 animate-spin" />}{' '}
                  {t('inventory.bulk.upload')}
                </Button>
              </>
            )
      }
    >

        <div className="space-y-4">
          {/* Format hint */}
          <div className="rounded-lg border bg-muted/40 p-3">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t('inventory.bulk.requiredFormat')}</p>
            <pre className="overflow-x-auto font-mono text-[11px] leading-relaxed">
{`variantId,quantity
507f1f77bcf86cd799439060,50
507f1f77bcf86cd799439061,0`}
            </pre>
            <p className="mt-2 text-xs text-muted-foreground">
              {t('inventory.bulk.limits')}
            </p>
          </div>

          {/* File picker */}
          <div className="space-y-2">
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => pick(e.target.files?.[0] ?? null)}
            />
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading} className="gap-2">
                <Upload className="h-4 w-4" /> {t('inventory.bulk.chooseFile')}
              </Button>
              <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                {file
                  ? `${file.name} · ${fmt.fileSize(file.size)}`
                  : t('inventory.bulk.noFileSelected')}
              </span>
            </div>
          </div>

          {/* Per-row validation errors (nothing was changed) */}
          {rowErrors && rowErrors.length > 0 && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-destructive">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                {t('inventory.bulk.rowsFailed', { count: rowErrors.length })}
              </p>
              <div className="max-h-48 space-y-1 overflow-y-auto">
                {rowErrors.map((e, i) => (
                  <div key={i} className="rounded bg-background/70 px-2 py-1.5 text-xs">
                    <span className="font-medium">
                      {t('inventory.bulk.rowLabel', { row: e.row ?? '—' })}
                    </span>
                    {e.variantId ? <span className="font-mono text-muted-foreground"> · {e.variantId}</span> : null}
                    <span className="text-destructive"> — {rowErrorText(e)}</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {t('inventory.bulk.fixAndRetry')}
              </p>
            </div>
          )}

          {/* Mixed batch: some rows written, some queued, some refused.
              Reported as three separate groups because `updated` counts only
              the first — calling a queued row updated is the one way to make
              this response lie. */}
          {result && (
            <div className="space-y-3">
              <p className="text-sm font-medium">{t('inventory.bulk.result.title')}</p>

              {result.variants.length > 0 && (
                <ResultGroup
                  tone="success"
                  heading={t('inventory.bulk.result.updated', { count: result.variants.length })}
                >
                  {result.variants.map((v) => (
                    <ResultRow
                      key={v.variantId}
                      sku={v.sku}
                      detail={t('inventory.requests.change', {
                        from: fmt.number(v.previousStock),
                        to: fmt.number(v.newStock),
                      })}
                    />
                  ))}
                </ResultGroup>
              )}

              {result.requested.length > 0 && (
                <ResultGroup
                  tone="warning"
                  heading={t('inventory.bulk.result.requested', { count: result.requested.length })}
                  hint={t('inventory.bulk.result.requestedHint')}
                >
                  {result.requested.map((r) => (
                    <ResultRow
                      key={r.variantId}
                      sku={r.sku}
                      detail={t('inventory.pending.requestedTo', {
                        to: fmt.number(r.requestedQuantity),
                      })}
                    />
                  ))}
                </ResultGroup>
              )}

              {result.notRequested.length > 0 && (
                <ResultGroup
                  tone="destructive"
                  heading={t('inventory.bulk.result.notRequested', {
                    count: result.notRequested.length,
                  })}
                  hint={t('inventory.bulk.result.notRequestedHint')}
                >
                  {result.notRequested.map((r) => {
                    const key = `errors.codes.${r.error}`;
                    return (
                      <ResultRow
                        key={r.variantId}
                        sku={r.sku}
                        detail={hasKey(key) ? tDynamic(key) : t('inventory.bulk.rowUnknownError')}
                      />
                    );
                  })}
                </ResultGroup>
              )}
            </div>
          )}
        </div>

    </ResponsiveModal>
  );
}

// ─── Alerts tab ─────────────────────────────────────────────────────────────

function AlertsTab({
  onStockChanged,
  refreshToken,
  onViewRequest,
}: {
  /** Fired after an adjust so the page re-pulls the summary counts. */
  onStockChanged: () => void;
  refreshToken: number;
  onViewRequest: (requestId: string) => void;
}) {
  const { t } = useTranslation();
  const apiError = useApiError();
  const isMobile = useIsMobile();
  const [rows, setRows] = useState<StockAlert[]>([]);
  const [meta, setMeta] = useState<InventoryPageMeta>(EMPTY_META);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [adjust, setAdjust] = useState<StockAlert | null>(null);
  /**
   * Open stock requests by variantId, so a warehoused SKU can show what is
   * pending on it. `StockAlert` carries nothing about warehousing, so this is a
   * second cheap query rather than a field.
   *
   * Partial by construction: /inventory/alerts only lists variants at or below
   * their threshold and never lists unlimited-stock ones, so a warehoused SKU
   * with a healthy quantity has no row here to badge. The requests tab is the
   * complete view.
   */
  const [pending, setPending] = useState<Record<string, StockRequestDto>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, requests] = await Promise.all([
        fetchStockAlerts({ page, limit: PAGE_LIMIT }),
        fetchStockRequests({ status: 'pending', limit: 100 }).catch(() => ({ data: [] })),
      ]);
      setRows(res.data);
      setMeta(res.meta);
      setPending(
        Object.fromEntries(requests.data.map((r) => [r.variantId, r])) as Record<
          string,
          StockRequestDto
        >,
      );
    } catch (err) {
      apiError.toast(err, { fallbackKey: 'inventory.errors.loadAlertsFailed' });
    } finally {
      setLoading(false);
    }
    // refreshToken bumps after a CSV import to re-pull updated alert counts.
  }, [page, refreshToken, apiError]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card>
      <CardContent className="p-0">
        {loading ? (
          <TableSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState icon={AlertTriangle} messageKey="inventory.empty.alerts" />
        ) : isMobile ? (
          // Seven columns do not fit a phone, so each row names its own values
          // instead of relying on a header that isn't there. The whole card is
          // the tap target — it opens the same adjust sheet the desktop row's
          // button does, which is the only action a row has.
          <DataCardList>
            {rows.map((a) => {
              const out = a.availableStock <= 0;
              const openRequest = pending[a.variantId] ?? null;
              return (
                <DataCard
                  key={a.variantId}
                  title={a.productTitle}
                  subtitle={a.sku}
                  trailing={
                    <Badge variant={out ? 'destructive' : 'secondary'} className={cn(!out && 'text-amber-600')}>
                      {a.availableStock}
                    </Badge>
                  }
                  fields={[
                    { label: t('inventory.columns.inStock'), value: a.currentStock },
                    { label: t('inventory.columns.reserved'), value: a.activeReservations },
                    { label: t('inventory.columns.threshold'), value: a.threshold },
                  ]}
                  footer={
                    openRequest ? (
                      // The proposed number has not been written — it is a
                      // request the agency still has to accept.
                      <span className="inline-block rounded border border-amber-500/40 bg-amber-500/5 px-1.5 py-0.5 text-[11px] tabular-nums text-amber-700 dark:text-amber-400">
                        {t('inventory.pending.badge', {
                          from: a.currentStock,
                          to: openRequest.requestedQuantity,
                        })}
                      </span>
                    ) : undefined
                  }
                  onClick={() => (openRequest ? onViewRequest(openRequest.id) : setAdjust(a))}
                  actionLabel={
                    openRequest ? t('inventory.adjust.viewRequest') : t('inventory.adjust.action')
                  }
                />
              );
            })}
          </DataCardList>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('inventory.columns.product')}</TableHead>
                <TableHead>{t('inventory.columns.sku')}</TableHead>
                <TableHead className="text-right">{t('inventory.columns.available')}</TableHead>
                <TableHead className="text-right">{t('inventory.columns.inStock')}</TableHead>
                <TableHead className="text-right">{t('inventory.columns.reserved')}</TableHead>
                <TableHead className="text-right">{t('inventory.columns.threshold')}</TableHead>
                <TableHead className="text-right">{t('inventory.columns.action')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((a) => {
                const out = a.availableStock <= 0;
                const openRequest = pending[a.variantId] ?? null;
                return (
                  <TableRow key={a.variantId}>
                    <TableCell className="font-medium max-w-[220px] truncate">{a.productTitle}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{a.sku}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={out ? 'destructive' : 'secondary'} className={cn(!out && 'text-amber-600')}>
                        {a.availableStock}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {a.currentStock}
                      {/* The number above is what the agency has on record; the
                          proposed one has not been written. */}
                      {openRequest && (
                        <button
                          type="button"
                          onClick={() => onViewRequest(openRequest.id)}
                          className="mt-1 block w-full rounded border border-amber-500/40 bg-amber-500/5 px-1.5 py-0.5 text-[11px] text-amber-700 tabular-nums hover:bg-amber-500/10 dark:text-amber-400"
                        >
                          {t('inventory.pending.badge', {
                            from: a.currentStock,
                            to: openRequest.requestedQuantity,
                          })}
                        </button>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">{a.activeReservations}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{a.threshold}</TableCell>
                    <TableCell className="text-right">
                      {openRequest ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => onViewRequest(openRequest.id)}
                        >
                          <PackageSearch className="h-3.5 w-3.5" />{' '}
                          {t('inventory.adjust.viewRequest')}
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setAdjust(a)}>
                          <Pencil className="h-3.5 w-3.5" /> {t('inventory.adjust.action')}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        <InventoryPagination meta={meta} page={page} onPage={setPage} loading={loading} />
      </CardContent>
      <AdjustStockDialog
        alert={adjust}
        pendingRequest={adjust ? pending[adjust.variantId] ?? null : null}
        onClose={() => setAdjust(null)}
        onSaved={() => {
          load();
          onStockChanged();
        }}
        onViewRequest={onViewRequest}
      />
    </Card>
  );
}

// ─── Reservations tab ───────────────────────────────────────────────────────

const RESERVATION_STATUS_STYLES: Record<ReservationStatus, string> = {
  active: 'text-blue-600',
  released: 'text-muted-foreground',
  committed: 'text-emerald-600',
  expired: 'text-muted-foreground',
};

function ReservationsTab() {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const apiError = useApiError();
  const isMobile = useIsMobile();
  const [rows, setRows] = useState<StockReservation[]>([]);
  const [meta, setMeta] = useState<InventoryPageMeta>(EMPTY_META);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchReservations({ page, limit: PAGE_LIMIT, status: 'active' });
      setRows(res.data);
      setMeta(res.meta);
    } catch (err) {
      apiError.toast(err, { fallbackKey: 'inventory.errors.loadReservationsFailed' });
    } finally {
      setLoading(false);
    }
  }, [page, apiError]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card>
      <CardContent className="p-0">
        {loading ? (
          <TableSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState icon={Lock} messageKey="inventory.empty.reservations" />
        ) : isMobile ? (
          <DataCardList>
            {rows.map((r) => (
              <DataCard
                key={r.reservationId}
                title={r.productTitle}
                subtitle={r.sku}
                trailing={
                  <span className={cn('text-xs font-medium', RESERVATION_STATUS_STYLES[r.status])}>
                    {t(`inventory.reservationStatus.${r.status}` as TranslationKey)}
                  </span>
                }
                fields={[
                  { label: t('inventory.columns.quantityLocked'), value: r.quantity },
                  {
                    label: t('inventory.columns.expiresAt'),
                    value: r.expiresAt ? fmt.dateTime(r.expiresAt) : t('common.labels.emptyValue'),
                  },
                ]}
              />
            ))}
          </DataCardList>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('inventory.columns.product')}</TableHead>
                <TableHead>{t('inventory.columns.sku')}</TableHead>
                <TableHead className="text-right">{t('inventory.columns.quantityLocked')}</TableHead>
                <TableHead>{t('inventory.columns.status')}</TableHead>
                <TableHead>{t('inventory.columns.expiresAt')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.reservationId}>
                  <TableCell className="font-medium max-w-[220px] truncate">{r.productTitle}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{r.sku}</TableCell>
                  <TableCell className="text-right">{r.quantity}</TableCell>
                  <TableCell>
                    <span className={cn('text-sm', RESERVATION_STATUS_STYLES[r.status])}>
                      {t(`inventory.reservationStatus.${r.status}` as TranslationKey)}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.expiresAt ? fmt.dateTime(r.expiresAt) : t('common.labels.emptyValue')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <InventoryPagination meta={meta} page={page} onPage={setPage} loading={loading} />
      </CardContent>
    </Card>
  );
}

// ─── History tab ────────────────────────────────────────────────────────────

const OPERATION_STYLES: Record<StockOperation, string> = {
  order: 'text-blue-600',
  reservation: 'text-amber-600',
  release: 'text-emerald-600',
  bulk: 'text-violet-600',
  manual: 'text-foreground',
  adjustment: 'text-muted-foreground',
};

function HistoryTab({ refreshToken }: { refreshToken: number }) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const apiError = useApiError();
  const isMobile = useIsMobile();
  const [rows, setRows] = useState<StockHistoryLog[]>([]);
  const [meta, setMeta] = useState<InventoryPageMeta>(EMPTY_META);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchStockHistory({ page, limit: PAGE_LIMIT });
      setRows(res.data);
      setMeta(res.meta);
    } catch (err) {
      apiError.toast(err, { fallbackKey: 'inventory.errors.loadHistoryFailed' });
    } finally {
      setLoading(false);
    }
    // refreshToken bumps after a CSV import — a `bulk` audit entry appears here.
  }, [page, refreshToken, apiError]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card>
      <CardContent className="p-0">
        {loading ? (
          <TableSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState icon={HistoryIcon} messageKey="inventory.empty.history" />
        ) : isMobile ? (
          <DataCardList>
            {rows.map((l) => (
              <DataCard
                key={l.id}
                // The SKU leads on a phone: history is scanned to answer "what
                // happened to this item", and the timestamp is the qualifier.
                title={l.sku}
                subtitle={fmt.dateTime(l.timestamp)}
                trailing={
                  <span
                    className={cn(
                      'text-sm font-semibold tabular-nums',
                      l.delta < 0 ? 'text-red-600' : 'text-emerald-600',
                    )}
                  >
                    {l.delta > 0 ? `+${l.delta}` : l.delta}
                  </span>
                }
                fields={[
                  {
                    label: t('inventory.columns.beforeAfter'),
                    // JSX rather than a template literal, to match the desktop
                    // cell — the i18n audit flags any interpolated string as
                    // candidate prose, and two numbers with an arrow are not.
                    value: (
                      <>
                        {l.previousQuantity} → {l.newQuantity}
                      </>
                    ),
                  },
                  {
                    label: t('inventory.columns.reason'),
                    value: (
                      <span className={OPERATION_STYLES[l.operation]}>
                        {l.metadata?.reason ??
                          l.metadata?.orderId ??
                          l.metadata?.batchId ??
                          t(`inventory.operation.${l.operation}` as TranslationKey)}
                      </span>
                    ),
                  },
                ]}
              />
            ))}
          </DataCardList>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('inventory.columns.timestamp')}</TableHead>
                <TableHead>{t('inventory.columns.sku')}</TableHead>
                <TableHead>{t('inventory.columns.change')}</TableHead>
                <TableHead className="text-right">{t('inventory.columns.beforeAfter')}</TableHead>
                <TableHead>{t('inventory.columns.reason')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {fmt.dateTime(l.timestamp)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{l.sku}</TableCell>
                  <TableCell>
                    <span className={cn('font-medium', l.delta < 0 ? 'text-red-600' : 'text-emerald-600')}>
                      {l.delta > 0 ? `+${l.delta}` : l.delta}
                    </span>{' '}
                    <span className={cn('text-xs', OPERATION_STYLES[l.operation])}>
                      ({t(`inventory.operation.${l.operation}` as TranslationKey)})
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {l.previousQuantity} → {l.newQuantity}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {l.metadata?.reason ??
                      l.metadata?.orderId ??
                      l.metadata?.batchId ??
                      t('common.labels.emptyValue')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <InventoryPagination meta={meta} page={page} onPage={setPage} loading={loading} />
      </CardContent>
    </Card>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

const VALID_TABS = ['alerts', 'reservations', 'history', 'requests'] as const;

/** The same four, as routes — what a sideways swipe walks. Order matters. */
const TAB_RING = VALID_TABS.map((tab) => `/dashboard/inventory/${tab}`);
type InventoryTab = (typeof VALID_TABS)[number];
const DEFAULT_TAB: InventoryTab = 'alerts';

const TAB_ICONS: Record<InventoryTab, typeof Boxes> = {
  alerts: AlertTriangle,
  reservations: Lock,
  history: HistoryIcon,
  requests: PackageSearch,
};

const isValidTab = (v: string | null | undefined): v is InventoryTab =>
  !!v && (VALID_TABS as readonly string[]).includes(v);

export function Inventory() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { tab: tabParam } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [alertCount, setAlertCount] = useState<number | null>(null);
  const [totalReserved, setTotalReserved] = useState<number | null>(null);
  const [awaitingCount, setAwaitingCount] = useState<number | null>(null);
  const [csvOpen, setCsvOpen] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [openRequestId, setOpenRequestId] = useState<string | null>(null);
  /** Re-pulls the three summary totals without reloading the open list. */
  const [countsToken, setCountsToken] = useState(0);

  const bumpRefresh = useCallback(() => setRefreshToken((n) => n + 1), []);
  const bumpCounts = useCallback(() => setCountsToken((n) => n + 1), []);

  const tab: InventoryTab | null = isValidTab(tabParam) ? tabParam : null;

  // Before the bare-path redirect below — a hook cannot sit behind an early
  // return. The sub-tab strip itself scrolls horizontally, and `useSwipeNavigate`
  // leaves gestures that start inside a horizontal scroller alone, so dragging
  // the strip still just scrolls the strip.
  useRouteSwipe(TAB_RING);

  /**
   * The summary row belongs to the PAGE, not to the tabs.
   *
   * Each surface is its own route now, so only one list is ever mounted — a
   * total read off the open list would leave the other two tiles at "—" until
   * the vendor happened to walk through every sub-tab. `limit: 1` reads each
   * figure off `meta` (and `meta.totalReserved`) without pulling a single row.
   */
  useEffect(() => {
    if (!tab) return;
    let cancelled = false;
    // A vendor with no warehoused products has nothing to show in the third
    // tile, and a failed count is not worth a toast on a page that otherwise
    // loaded fine — each of the three fails to "—" on its own.
    fetchStockAlerts({ page: 1, limit: 1 })
      .then((res) => !cancelled && setAlertCount(res.meta.total))
      .catch(() => { });
    fetchReservations({ page: 1, limit: 1, status: 'active' })
      .then((res) => !cancelled && setTotalReserved(res.totalReserved))
      .catch(() => { });
    fetchAwaitingMyDecisionCount()
      .then((n) => !cancelled && setAwaitingCount(n))
      .catch(() => { });
    return () => {
      cancelled = true;
    };
  }, [tab, refreshToken, countsToken]);

  const goToTab = useCallback(
    (next: InventoryTab) => navigate(`/dashboard/inventory/${next}`),
    [navigate],
  );

  // Deep-link from a notification: /dashboard/inventory/requests?view=<id>.
  // Hand the id to the inbox, then strip the param so a refresh or a back-nav
  // doesn't reopen the sheet — same convention as Orders.
  //
  // Held back until a tab is resolved: on the bare path the redirect below is
  // what carries `?view=` across, and stripping it here first would race it.
  useEffect(() => {
    const viewId = searchParams.get('view');
    if (!tab || !viewId) return;
    setOpenRequestId(viewId);
    const next = new URLSearchParams(searchParams);
    next.delete('view');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, tab]);

  // Bare `/dashboard/inventory` (or a bogus segment) lands on the default tab.
  // Redirecting from inside the component rather than with a `<Route element=
  // {<Navigate/>}>` is what carries the query string over — including `?view=`
  // and the legacy `?tab=requests` that older links still use.
  if (!tab) {
    const legacy = searchParams.get('tab');
    const target = isValidTab(legacy) ? legacy : DEFAULT_TAB;
    const rest = new URLSearchParams(searchParams);
    rest.delete('tab');
    const query = rest.toString();
    return (
      <Navigate to={`/dashboard/inventory/${target}${query ? `?${query}` : ''}`} replace />
    );
  }

  const importButton = (
    <Button variant="outline" onClick={() => setCsvOpen(true)} className="gap-2 flex-shrink-0">
      <Upload className="h-4 w-4" /> {t('inventory.bulk.importCsv')}
    </Button>
  );

  /**
   * Mobile sub-navigation. The sidebar's sub-tabs live behind "More" on a phone,
   * so the four surfaces would otherwise be three taps deep — this strip puts
   * them back one tap away. It scrolls horizontally rather than squeezing four
   * labels into 360px.
   */
  const mobileTabStrip = (
    <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex w-max gap-2">
        {VALID_TABS.map((value) => {
          const Icon = TAB_ICONS[value];
          const active = value === tab;
          const badge =
            value === 'alerts' ? alertCount : value === 'requests' ? awaitingCount : null;
          return (
            <button
              key={value}
              type="button"
              onClick={() => goToTab(value)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                active
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border bg-background',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t(`inventory.tabs.${value}` as TranslationKey)}
              {badge ? (
                <span
                  className={cn(
                    'rounded-full px-1.5 text-[10px] font-bold leading-4',
                    active ? 'bg-background/25' : 'bg-destructive text-destructive-foreground',
                  )}
                >
                  {badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );

  // Desktop only. Three tiles across a 360px phone leaves ~100px each, which
  // truncates every label to noise — the numbers are glanceable context, and on
  // mobile the list itself is worth that vertical space.
  const summary = (
    <div className="grid grid-cols-3 gap-3">
      <StatTile
        label={t('inventory.stats.lowStockVariants')}
        value={alertCount ?? '—'}
        icon={AlertTriangle}
        accentClassName="bg-amber-100 text-amber-600"
      />
      <StatTile
        label={t('inventory.stats.unitsReserved')}
        value={totalReserved ?? '—'}
        icon={Lock}
        accentClassName="bg-blue-100 text-blue-600"
      />
      <StatTile
        label={t('inventory.stats.awaitingApproval')}
        value={awaitingCount ?? '—'}
        icon={PackageSearch}
        accentClassName="bg-amber-100 text-amber-600"
      />
    </div>
  );

  const pane = (
    <>
      {tab === 'alerts' && (
        <AlertsTab
          onStockChanged={bumpCounts}
          refreshToken={refreshToken}
          onViewRequest={(id) => {
            setOpenRequestId(id);
            goToTab('requests');
          }}
        />
      )}
      {tab === 'reservations' && <ReservationsTab />}
      {tab === 'history' && <HistoryTab refreshToken={refreshToken} />}
      {tab === 'requests' && (
        <StockRequestsTab
          refreshToken={refreshToken}
          onRequestsChanged={bumpCounts}
          onStockWritten={() => {
            bumpRefresh();
            bumpCounts();
          }}
          openRequestId={openRequestId}
          onOpenRequestIdHandled={() => setOpenRequestId(null)}
        />
      )}
    </>
  );

  const csvDialog = (
    <ImportCsvDialog
      open={csvOpen}
      onOpenChange={setCsvOpen}
      onImported={() => {
        bumpRefresh();
        bumpCounts();
      }}
      onGoToRequests={() => goToTab('requests')}
    />
  );

  // ─── Mobile: pinned header carries the sub-tab strip, content runs full-bleed ─
  if (isMobile) {
    return (
      <div className="animate-fade-in -mx-6 -mt-6">
        <MobilePageHeader
          title={t(`inventory.tabs.${tab}` as TranslationKey)}
          description={t(`inventory.tabSubtitles.${tab}` as TranslationKey)}
          actions={[
            {
              id: 'import',
              icon: Upload,
              label: t('inventory.bulk.importCsv'),
              onClick: () => setCsvOpen(true),
            },
          ]}
          subheader={mobileTabStrip}
        />
        {csvDialog}
        <div className="px-4 pt-3 pb-28">{pane}</div>
      </div>
    );
  }

  // ─── Desktop ────────────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in space-y-5">
      {/* "Inventory › <tab>" — the sidebar sub-tab you opened names the page. */}
      <div className="flex items-start justify-between gap-4">
        <SubPageHeader
          parent={t('inventory.title')}
          current={t(`inventory.tabs.${tab}` as TranslationKey)}
          description={t(`inventory.tabSubtitles.${tab}` as TranslationKey)}
        />
        {importButton}
      </div>

      {csvDialog}

      {summary}

      {pane}
    </div>
  );
}
