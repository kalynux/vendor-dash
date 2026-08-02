import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Banknote, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { SettingsSection } from '@/components/vendor-settings/SettingsSection';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatMoney, formatDate } from '@/components/billing/billing.constants';
import { CardSkeleton } from '@/components/billing/BillingSkeletons';
import { fetchEarningsBalance, fetchLatestPayout, requestPayout } from '@/services/earnings.service';
import { ApiError } from '@/types/api';
import type { EarningsBalance, PayoutRequest } from '@/types/earnings.types';
import {
  PAYOUT_STATUS_LABELS,
  PAYOUT_STATUS_BADGE_CLASSES,
  PAYOUT_ORIGIN_LABELS,
  MIN_PAYOUT_AMOUNT,
  AUTO_PAYOUT_THRESHOLD,
  earningsErrorMessage,
} from './earnings.constants';

export function EarningsSummaryCard() {
  const navigate = useNavigate();
  const [balance, setBalance] = useState<EarningsBalance | null>(null);
  const [latestPayout, setLatestPayout] = useState<PayoutRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [bal, payout] = await Promise.all([fetchEarningsBalance(), fetchLatestPayout()]);
      setBalance(bal);
      setLatestPayout(payout);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Failed to load earnings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const hasPendingRequest = latestPayout?.status === 'pending';
  // The backend rejects anything under the minimum with EARNINGS_PAYOUT_BELOW_MINIMUM,
  // so gate the button on it rather than letting the request fail.
  const belowMinimum = !!balance && balance.available < MIN_PAYOUT_AMOUNT;
  const canRequest = !!balance && balance.available > 0 && !belowMinimum && !hasPendingRequest;

  async function onRequestPayout() {
    setRequesting(true);
    try {
      const { payout, message } = await requestPayout();
      setLatestPayout(payout);
      toast.success(message ?? 'Payout request created.');
      const bal = await fetchEarningsBalance();
      setBalance(bal);
    } catch (err) {
      toast.error(earningsErrorMessage(err, 'Failed to request payout.'));
    } finally {
      setRequesting(false);
    }
  }

  function viewTicket() {
    if (!latestPayout) return;
    navigate('/dashboard/tickets', { state: { openTicketId: latestPayout.ticketId } });
  }

  if (loading) return <CardSkeleton lines={3} />;

  if (loadError) {
    return (
      <SettingsSection title="Earnings" icon={Banknote}>
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-destructive">{loadError}</p>
          <Button variant="outline" size="sm" onClick={load}>
            Retry
          </Button>
        </div>
      </SettingsSection>
    );
  }

  if (!balance) return null;

  return (
    <SettingsSection
      title="Earnings"
      icon={Banknote}
      info={
        <div className="space-y-2">
          <p>
            <strong className="text-foreground">Available</strong> is what you can withdraw now.{' '}
            <strong className="text-foreground">Pending</strong> is money from orders that haven&apos;t
            cleared yet, and <strong className="text-foreground">Requested</strong> is already locked
            into a withdrawal.
          </p>
          <p>
            The minimum withdrawal is {formatMoney(MIN_PAYOUT_AMOUNT, balance.currency)}.
          </p>
          <p>
            If your available balance reaches {formatMoney(AUTO_PAYOUT_THRESHOLD, balance.currency)},
            we automatically request a payout on your behalf so your funds don&apos;t sit unclaimed.
            Make sure you have a payout method saved — otherwise the automatic request can&apos;t be
            created and your balance will keep growing past the threshold until you add one.
          </p>
        </div>
      }
      contentClassName="space-y-5"
    >
        {/* Borderless figures on mobile — the tiles were boxes inside a box. */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-3">
          <div className="rounded-lg p-0 sm:border sm:bg-muted/30 sm:p-4">
            <p className="text-xs text-muted-foreground">Available</p>
            <p className="text-2xl font-bold">{formatMoney(balance.available, balance.currency)}</p>
          </div>
          <div className="rounded-lg p-0 sm:border sm:p-4">
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="text-2xl font-semibold">{formatMoney(balance.pending, balance.currency)}</p>
          </div>
          {balance.requested > 0 && (
            <div className="rounded-lg p-0 sm:border sm:p-4">
              <p className="text-xs text-muted-foreground">Requested</p>
              <p className="text-2xl font-semibold">{formatMoney(balance.requested, balance.currency)}</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t pt-4">
          <Button onClick={onRequestPayout} disabled={!canRequest || requesting} className="gap-2">
            {requesting && <Loader2 className="h-4 w-4 animate-spin" />}
            Request Withdrawal
          </Button>
          {!hasPendingRequest && balance.available <= 0 && (
            <p className="text-xs text-muted-foreground">Nothing available to withdraw yet.</p>
          )}
          {!hasPendingRequest && balance.available > 0 && belowMinimum && (
            <p className="text-xs text-muted-foreground">
              Minimum withdrawal is {formatMoney(MIN_PAYOUT_AMOUNT, balance.currency)}.
            </p>
          )}
        </div>

        {latestPayout && (
          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Latest withdrawal request</p>
              <Badge className={cn('border-0 font-medium', PAYOUT_STATUS_BADGE_CLASSES[latestPayout.status])}>
                {PAYOUT_STATUS_LABELS[latestPayout.status]}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {formatMoney(latestPayout.amount, latestPayout.currency)} · requested{' '}
              {formatDate(latestPayout.createdAt)}
              {latestPayout.origin && ` · ${PAYOUT_ORIGIN_LABELS[latestPayout.origin] ?? latestPayout.origin}`}
            </p>
            {latestPayout.origin === 'auto_threshold' && (
              <p className="text-xs text-muted-foreground">
                Opened automatically because your available balance reached{' '}
                {formatMoney(AUTO_PAYOUT_THRESHOLD, latestPayout.currency)}.
              </p>
            )}
            {latestPayout.status === 'rejected' && latestPayout.rejectionReason && (
              <p className="text-sm text-destructive">{latestPayout.rejectionReason}</p>
            )}
            <Button variant="outline" size="sm" onClick={viewTicket} className="gap-1.5">
              <ExternalLink className="h-3.5 w-3.5" /> View ticket
            </Button>
          </div>
        )}
    </SettingsSection>
  );
}
