import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Boxes,
  AlertTriangle,
  Lock,
  History as HistoryIcon,
  Loader2,
  ChevronLeft,
  ChevronRight,
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
import { ApiError } from '@/types/api';
import type {
  StockAlert,
  StockReservation,
  StockHistoryLog,
  InventoryPageMeta,
  StockOperation,
  ReservationStatus,
  BulkStockRowError,
} from '@/types/inventory.types';

import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobilePageHeader } from '@/components/layout/MobilePageHeader';
import { cn } from '@/lib/utils';

const PAGE_LIMIT = 20;
const EMPTY_META: InventoryPageMeta = { page: 1, limit: PAGE_LIMIT, total: 0, totalPages: 1 };
const MAX_CSV_BYTES = 5 * 1024 * 1024; // Backend limit — see api-doc/vendor/inventory.md

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ─── Shared pagination footer ──────────────────────────────────────────────

function InventoryPagination({
  meta,
  page,
  onPage,
  loading,
}: {
  meta: InventoryPageMeta;
  page: number;
  onPage: (p: number) => void;
  loading: boolean;
}) {
  if (meta.totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t">
      <p className="text-sm text-muted-foreground">
        Page {meta.page} of {meta.totalPages} · {meta.total} total
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => onPage(page - 1)} className="gap-1">
          <ChevronLeft className="h-4 w-4" /> Prev
        </Button>
        <Button variant="outline" size="sm" disabled={page >= meta.totalPages || loading} onClick={() => onPage(page + 1)} className="gap-1">
          Next <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function TableSkeleton({ cols }: { cols: number }) {
  return (
    <div className="p-4 space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
      <span className="sr-only">Loading {cols} columns</span>
    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: typeof Boxes; message: string }) {
  return (
    <div className="py-12 text-center">
      <Icon className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}

// ─── Adjust-stock dialog (single-row bulk-update) ──────────────────────────

function AdjustStockDialog({
  alert,
  onClose,
  onSaved,
}: {
  alert: StockAlert | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (alert) setValue(String(alert.currentStock));
  }, [alert]);

  const save = useCallback(async () => {
    if (!alert) return;
    const qty = Number(value);
    if (!Number.isInteger(qty)) {
      toast.error('Enter a whole number.');
      return;
    }
    setSaving(true);
    try {
      const result = await bulkUpdateStock([{ variantId: alert.variantId, quantity: qty }]);
      toast.success(`Stock updated for ${alert.sku} (${result.updated} variant updated).`);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update stock.');
    } finally {
      setSaving(false);
    }
  }, [alert, value, onSaved, onClose]);

  return (
    <Dialog open={!!alert} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Adjust stock</DialogTitle>
          <DialogDescription>
            {alert ? <>Set the absolute stock level for <span className="font-medium">{alert.sku}</span> ({alert.productTitle}).</> : null}
          </DialogDescription>
        </DialogHeader>
        {alert && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground text-xs">Current stock</p>
                <p className="text-lg font-semibold">{alert.currentStock}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground text-xs">Reserved</p>
                <p className="text-lg font-semibold">{alert.activeReservations}</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-stock">New stock level (absolute)</Label>
              <Input
                id="new-stock"
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                This sets the total quantity — it is not added to the current stock.
              </p>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Import-CSV dialog (multipart bulk-update) ─────────────────────────────

function ImportCsvDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onImported: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [rowErrors, setRowErrors] = useState<BulkStockRowError[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setFile(null);
    setUploading(false);
    setRowErrors(null);
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  const pick = (f: File | null) => {
    setRowErrors(null);
    if (!f) {
      setFile(null);
      return;
    }
    const isCsv = f.name.toLowerCase().endsWith('.csv') || f.type === 'text/csv';
    if (!isCsv) {
      toast.error('Please choose a .csv file.');
      return;
    }
    if (f.size > MAX_CSV_BYTES) {
      toast.error('That file is larger than the 5MB limit.');
      return;
    }
    setFile(f);
  };

  const upload = useCallback(async () => {
    if (!file) return;
    setUploading(true);
    setRowErrors(null);
    try {
      const result = await bulkUpdateStockCsv(file);
      toast.success(`${result.updated} variant${result.updated === 1 ? '' : 's'} updated from ${file.name}.`);
      onImported();
      onOpenChange(false);
      reset();
    } catch (err) {
      // All-or-nothing: on any row failure nothing was changed. Surface the
      // per-row reasons inline so the vendor can fix and re-upload.
      if (err instanceof ApiError && err.rowErrors?.length) {
        setRowErrors(err.rowErrors);
      } else {
        toast.error(err instanceof ApiError ? err.message : 'Could not import the CSV file.');
      }
    } finally {
      setUploading(false);
    }
  }, [file, onImported, onOpenChange, reset]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import stock from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV with exactly two columns — <span className="font-mono">variantId</span> and{' '}
            <span className="font-mono">quantity</span> — to set absolute stock levels in one atomic batch.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Format hint */}
          <div className="rounded-lg border bg-muted/40 p-3">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Required format</p>
            <pre className="overflow-x-auto font-mono text-[11px] leading-relaxed">
{`variantId,quantity
507f1f77bcf86cd799439060,50
507f1f77bcf86cd799439061,0`}
            </pre>
            <p className="mt-2 text-xs text-muted-foreground">
              Max 5MB · up to 1,000 rows · quantities are absolute (they replace current stock, not added to it).
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
                <Upload className="h-4 w-4" /> Choose file
              </Button>
              <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                {file ? `${file.name} · ${formatBytes(file.size)}` : 'No file selected'}
              </span>
            </div>
          </div>

          {/* Per-row validation errors (nothing was changed) */}
          {rowErrors && rowErrors.length > 0 && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-destructive">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                {rowErrors.length} row{rowErrors.length === 1 ? '' : 's'} failed — no stock was changed.
              </p>
              <div className="max-h-48 space-y-1 overflow-y-auto">
                {rowErrors.map((e, i) => (
                  <div key={i} className="rounded bg-background/70 px-2 py-1.5 text-xs">
                    <span className="font-medium">Row {e.row ?? '—'}</span>
                    {e.variantId ? <span className="font-mono text-muted-foreground"> · {e.variantId}</span> : null}
                    <span className="text-destructive"> — {e.message ?? e.error}</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Fix the rows above and upload again — the batch is applied all-or-nothing.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
            disabled={uploading}
          >
            Cancel
          </Button>
          <Button onClick={upload} disabled={!file || uploading} className="gap-2">
            {uploading && <Loader2 className="h-4 w-4 animate-spin" />} Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Alerts tab ─────────────────────────────────────────────────────────────

function AlertsTab({ onCount, refreshToken }: { onCount: (n: number) => void; refreshToken: number }) {
  const [rows, setRows] = useState<StockAlert[]>([]);
  const [meta, setMeta] = useState<InventoryPageMeta>(EMPTY_META);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [adjust, setAdjust] = useState<StockAlert | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchStockAlerts({ page, limit: PAGE_LIMIT });
      setRows(res.data);
      setMeta(res.meta);
      onCount(res.meta.total);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not load stock alerts.');
    } finally {
      setLoading(false);
    }
    // refreshToken bumps after a CSV import to re-pull updated alert counts.
  }, [page, onCount, refreshToken]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card>
      <CardContent className="p-0">
        {loading ? (
          <TableSkeleton cols={6} />
        ) : rows.length === 0 ? (
          <EmptyState icon={AlertTriangle} message="No low-stock variants. You're all stocked up." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Available</TableHead>
                <TableHead className="text-right">In stock</TableHead>
                <TableHead className="text-right">Reserved</TableHead>
                <TableHead className="text-right">Threshold</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((a) => {
                const out = a.availableStock <= 0;
                return (
                  <TableRow key={a.variantId}>
                    <TableCell className="font-medium max-w-[220px] truncate">{a.productTitle}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{a.sku}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={out ? 'destructive' : 'secondary'} className={cn(!out && 'text-amber-600')}>
                        {a.availableStock}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{a.currentStock}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{a.activeReservations}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{a.threshold}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setAdjust(a)}>
                        <Pencil className="h-3.5 w-3.5" /> Adjust
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        <InventoryPagination meta={meta} page={page} onPage={setPage} loading={loading} />
      </CardContent>
      <AdjustStockDialog alert={adjust} onClose={() => setAdjust(null)} onSaved={load} />
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

function ReservationsTab({ onTotalReserved }: { onTotalReserved: (n: number) => void }) {
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
      onTotalReserved(res.totalReserved);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not load reservations.');
    } finally {
      setLoading(false);
    }
  }, [page, onTotalReserved]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card>
      <CardContent className="p-0">
        {loading ? (
          <TableSkeleton cols={5} />
        ) : rows.length === 0 ? (
          <EmptyState icon={Lock} message="No active reservations right now." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Qty locked</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expires</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.reservationId}>
                  <TableCell className="font-medium max-w-[220px] truncate">{r.productTitle}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{r.sku}</TableCell>
                  <TableCell className="text-right">{r.quantity}</TableCell>
                  <TableCell>
                    <span className={cn('capitalize text-sm', RESERVATION_STATUS_STYLES[r.status])}>{r.status}</span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.expiresAt ? new Date(r.expiresAt).toLocaleString() : '—'}
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
      toast.error(err instanceof ApiError ? err.message : 'Could not load stock history.');
    } finally {
      setLoading(false);
    }
    // refreshToken bumps after a CSV import — a `bulk` audit entry appears here.
  }, [page, refreshToken]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card>
      <CardContent className="p-0">
        {loading ? (
          <TableSkeleton cols={5} />
        ) : rows.length === 0 ? (
          <EmptyState icon={HistoryIcon} message="No stock changes recorded yet." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Change</TableHead>
                <TableHead className="text-right">Before → After</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {new Date(l.timestamp).toLocaleString()}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{l.sku}</TableCell>
                  <TableCell>
                    <span className={cn('font-medium', l.delta < 0 ? 'text-red-600' : 'text-emerald-600')}>
                      {l.delta > 0 ? `+${l.delta}` : l.delta}
                    </span>{' '}
                    <span className={cn('text-xs capitalize', OPERATION_STYLES[l.operation])}>({l.operation})</span>
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {l.previousQuantity} → {l.newQuantity}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {l.metadata?.reason ?? l.metadata?.orderId ?? l.metadata?.batchId ?? '—'}
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

export function Inventory() {
  const isMobile = useIsMobile();
  const [alertCount, setAlertCount] = useState<number | null>(null);
  const [totalReserved, setTotalReserved] = useState<number | null>(null);
  const [csvOpen, setCsvOpen] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  const handleImported = useCallback(() => setRefreshToken((n) => n + 1), []);

  return (
    <div className={cn('animate-fade-in', isMobile ? '-mx-6 -mt-6' : 'space-y-6')}>
      {isMobile ? (
        <MobilePageHeader
          title="Inventory"
          actions={
            <Button variant="ghost" size="icon" onClick={() => setCsvOpen(true)} aria-label="Import stock from CSV">
              <Upload className="h-5 w-5" />
            </Button>
          }
        />
      ) : (
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Inventory</h1>
            <p className="text-muted-foreground">Monitor low stock, active reservations, and stock history for your physical products.</p>
          </div>
          <Button variant="outline" onClick={() => setCsvOpen(true)} className="gap-2 flex-shrink-0">
            <Upload className="h-4 w-4" /> Import CSV
          </Button>
        </div>
      )}

      <ImportCsvDialog open={csvOpen} onOpenChange={setCsvOpen} onImported={handleImported} />

      {/* Summary */}
      {!isMobile && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Low-stock variants</p>
                <p className="text-2xl font-bold">{alertCount ?? '—'}</p>
              </div>
              <div className="p-3 bg-amber-100 rounded-lg"><AlertTriangle className="w-5 h-5 text-amber-600" /></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Units reserved</p>
                <p className="text-2xl font-bold">{totalReserved ?? '—'}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg"><Lock className="w-5 h-5 text-blue-600" /></div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="alerts" className={cn('w-full', isMobile && 'px-4 pt-3 pb-28')}>
        <TabsList>
          <TabsTrigger value="alerts" className="gap-2">
            <AlertTriangle className="w-4 h-4" /> Alerts
            {alertCount ? <Badge variant="destructive">{alertCount}</Badge> : null}
          </TabsTrigger>
          <TabsTrigger value="reservations" className="gap-2">
            <Lock className="w-4 h-4" /> Reservations
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <HistoryIcon className="w-4 h-4" /> History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="alerts" className="mt-4">
          <AlertsTab onCount={setAlertCount} refreshToken={refreshToken} />
        </TabsContent>
        <TabsContent value="reservations" className="mt-4">
          <ReservationsTab onTotalReserved={setTotalReserved} />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <HistoryTab refreshToken={refreshToken} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
