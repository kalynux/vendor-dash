import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { fetchLedger } from '@/services/billing.service';
import type { CreditTransaction, BillingListMeta } from '@/types/billing.types';
import { ApiError } from '@/types/api';
import { LedgerSkeleton } from './BillingSkeletons';
import { formatDate, ledgerReasonLabel, isCredit, formatCredits } from './billing.constants';

const PAGE_LIMIT = 10;

/** `refreshKey` bumps to force a reload after a successful top-up. */
export function CreditLedger({ refreshKey = 0 }: { refreshKey?: number }) {
  const [rows, setRows] = useState<CreditTransaction[]>([]);
  const [meta, setMeta] = useState<BillingListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchLedger({ page: p, limit: PAGE_LIMIT });
      setRows(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load credit history.');
      setRows([]);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Reset to page 1 whenever a top-up succeeds.
  useEffect(() => {
    setPage(1);
  }, [refreshKey]);

  useEffect(() => {
    load(page);
  }, [load, page, refreshKey]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Credit history</CardTitle>
        <CardDescription>Allowances, top-ups, and what your credits were spent on.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <LedgerSkeleton />
        ) : error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}{' '}
            <button className="underline" onClick={() => load(page)}>
              Retry
            </button>
          </div>
        ) : rows.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No credit activity yet.
          </p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-hidden rounded-lg border sm:block">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Activity</th>
                    <th className="px-4 py-2.5 font-medium">Date</th>
                    <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                    <th className="px-4 py-2.5 text-right font-medium">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((tx) => (
                    <tr key={tx._id} className="border-b last:border-0">
                      <td className="px-4 py-2.5">{ledgerReasonLabel(tx.reason_code)}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{formatDate(tx.created_at)}</td>
                      <td className={`px-4 py-2.5 text-right font-medium ${amountClass(tx)}`}>
                        {signedAmount(tx)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">
                        {formatCredits(tx.balance_after)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile stacked rows */}
            <ul className="space-y-2 sm:hidden">
              {rows.map((tx) => (
                <li key={tx._id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium">{ledgerReasonLabel(tx.reason_code)}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(tx.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-medium ${amountClass(tx)}`}>{signedAmount(tx)}</p>
                    <p className="text-xs text-muted-foreground">{formatCredits(tx.balance_after)} left</p>
                  </div>
                </li>
              ))}
            </ul>

            {meta && (
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  Page {meta.page} of {meta.totalPages || 1}
                </span>
                {meta.totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={meta.page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={meta.page >= meta.totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function signedAmount(tx: CreditTransaction): string {
  const credit = isCredit(tx.type);
  const sign = credit ? '+' : '−';
  return `${sign}${formatCredits(Math.abs(tx.amount))}`;
}

function amountClass(tx: CreditTransaction): string {
  return isCredit(tx.type) ? 'text-green-600' : 'text-foreground';
}
