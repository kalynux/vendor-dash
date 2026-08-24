import { useEffect, useState } from 'react';
import { Info, Loader2 } from 'lucide-react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ResponsiveModal } from '@/components/services/ResponsiveModal';
import { fetchStorageInvoice, storageInvoicePeriod } from '@/services/storage-invoices.service';
import type { StorageInvoice } from '@/types/storage-invoices.types';
import { useApiError, useFormatters, useTranslation } from '@/i18n';
import { StorageInvoiceStatusBadge } from '@/components/inventory/StorageInvoiceStatusBadge';

interface StorageInvoiceDetailSheetProps {
  /** `null` closes the sheet. */
  invoiceId: string | null;
  onOpenChange: (open: boolean) => void;
  /**
   * The list row that was clicked. Renders the header immediately so the sheet
   * is not a spinner over known values — only `lines` needs the round trip.
   */
  seed?: StorageInvoice | null;
  agencyName?: string;
}

/**
 * One storage invoice, with its per-SKU breakdown.
 *
 * 🔴 `lines` is **absent** on the list — not empty, absent — so the detail is
 * fetched even when the caller already has the row.
 *
 * 🔴 There is no action in the footer, and that is not an oversight. The two
 * routes are both `GET`: no settle, no dispute, no pay, no download. The agency
 * issues and marks settled out of band, and the platform is not a party to the
 * money, so a Pay button would have nothing behind it and a Dispute button would
 * record a dispute nobody can resolve.
 */
export function StorageInvoiceDetailSheet({
  invoiceId,
  onOpenChange,
  seed,
  agencyName,
}: StorageInvoiceDetailSheetProps) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const apiError = useApiError();
  const [invoice, setInvoice] = useState<StorageInvoice | null>(seed ?? null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!invoiceId) return;
    let cancelled = false;
    setInvoice(seed ?? null);
    setLoading(true);
    fetchStorageInvoice(invoiceId)
      .then((full) => !cancelled && setInvoice(full))
      .catch((err) => {
        if (cancelled) return;
        apiError.toast(err, { fallbackKey: 'inventory.invoices.errors.loadDetailFailed' });
        onOpenChange(false);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // `seed` is a render-fresh object; keying on the id is what makes this fire once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  // Derived from `periodKey`, never from `periodEnd` — that boundary is
  // EXCLUSIVE, so a July invoice carries 1 August and printing it raw names the
  // wrong month.
  const period = invoice ? storageInvoicePeriod(invoice) : null;
  const lines = invoice?.lines ?? [];

  return (
    <ResponsiveModal
      open={!!invoiceId}
      onOpenChange={onOpenChange}
      title={
        period
          ? t('inventory.invoices.detailTitle', {
              period: fmt.date(period, 'monthYear'),
            })
          : t('inventory.invoices.detailTitleFallback')
      }
      description={agencyName ?? undefined}
      desktopClassName="sm:max-w-3xl"
      footer={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t('common.actions.close')}
        </Button>
      }
    >
      {!invoice ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t('common.a11y.loading')}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Figure label={t('inventory.invoices.fields.status')}>
              <StorageInvoiceStatusBadge status={invoice.status} />
            </Figure>
            <Figure label={t('inventory.invoices.fields.skus')}>
              {fmt.number(invoice.skuCount)}
            </Figure>
            <Figure label={t('inventory.invoices.fields.units')}>
              {fmt.number(invoice.unitCount)}
            </Figure>
            <Figure label={t('inventory.invoices.fields.total')}>
              <span className="font-semibold">{fmt.currency(invoice.total)}</span>
            </Figure>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
            <p>{t('inventory.invoices.issuedOn', { date: fmt.date(invoice.issuedAt) })}</p>
            {invoice.settledAt && (
              <p>{t('inventory.invoices.settledOn', { date: fmt.date(invoice.settledAt) })}</p>
            )}
          </div>

          {invoice.note && (
            <p className="rounded-lg border border-border p-3 text-sm">{invoice.note}</p>
          )}

          {/*
            The per-SKU table. 🔴 There is deliberately no "quantity × rate"
            column: `lineTotal` IS `monthlyRatePerSku`, because the charge is per
            SKU held rather than per unit. Quantity is context, not a multiplier,
            and a column implying otherwise would not reconcile with the total.
          */}
          <div>
            <p className="mb-2 text-sm font-medium">{t('inventory.invoices.linesTitle')}</p>
            {loading && lines.length === 0 ? (
              <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                {t('common.a11y.loading')}
              </div>
            ) : lines.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t('inventory.invoices.noLines')}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('inventory.columns.product')}</TableHead>
                      <TableHead>{t('inventory.columns.sku')}</TableHead>
                      <TableHead>{t('inventory.invoices.columns.depot')}</TableHead>
                      <TableHead className="text-right">
                        {t('inventory.invoices.columns.unitsHeld')}
                      </TableHead>
                      <TableHead className="text-right">
                        {t('inventory.invoices.columns.charge')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((line) => (
                      <TableRow key={line.stockLevelId}>
                        <TableCell className="max-w-[200px] truncate font-medium">
                          {line.productTitle ?? t('common.labels.emptyValue')}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {line.sku ?? t('common.labels.emptyValue')}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {line.locationLabel ?? t('common.labels.emptyValue')}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {fmt.number(line.quantity)}
                        </TableCell>
                        {/* The LINE's own rate, not the invoice headline — they
                            can differ, and the lines are what sum to the total. */}
                        <TableCell className="text-right text-sm font-medium">
                          {fmt.currency(line.lineTotal)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <Alert>
            <Info className="size-4" />
            <AlertDescription>{t('inventory.invoices.snapshotNotice')}</AlertDescription>
          </Alert>
        </div>
      )}
    </ResponsiveModal>
  );
}

function Figure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}
