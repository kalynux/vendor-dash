import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Banknote, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { SettingsSection } from '@/components/vendor-settings/SettingsSection';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useFormatters, useTranslation, Trans } from '@/i18n';
import { CardSkeleton } from '@/components/billing/BillingSkeletons';
import { fetchEarningsBalance, fetchLatestPayout, requestPayout } from '@/services/earnings.service';
import { isPayoutOpen, payoutReturnedBalance } from '@/types/earnings.types';
import type { EarningsBalance, PayoutRequest } from '@/types/earnings.types';
import {
  PAYOUT_ORIGIN_KEYS,
  MIN_PAYOUT_AMOUNT,
  AUTO_PAYOUT_THRESHOLD,
  earningsErrorMessage,
  payoutOpenRequestKey,
  payoutStatusBadgeClass,
  payoutStatusKey,
  payoutStatusNoteKey,
} from './earnings.constants';

export function EarningsSummaryCard() {
  const { t } = useTranslation();
  const fmt = useFormatters();
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
      setLoadError(earningsErrorMessage(err, 'account.earnings.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * ⛔ **Gate on every OPEN status, not on `pending` alone.** `processing` and
   * `failed` each still hold the money, and the backend's partial unique index
   * refuses a second request during any of the three with
   * `409 EARNINGS_PAYOUT_ALREADY_PENDING`. An unrecognised status counts as open
   * too — a button that can only 409 is worse than one that waits.
   */
  const hasOpenRequest = isPayoutOpen(latestPayout?.status);
  // The backend rejects anything under the minimum with EARNINGS_PAYOUT_BELOW_MINIMUM,
  // so gate the button on it rather than letting the request fail.
  const belowMinimum = !!balance && balance.available < MIN_PAYOUT_AMOUNT;
  const canRequest = !!balance && balance.available > 0 && !belowMinimum && !hasOpenRequest;

  async function onRequestPayout() {
    setRequesting(true);
    try {
      const { payout, message } = await requestPayout();
      setLatestPayout(payout);
      toast.success(message ?? t('account.earnings.requestCreated'));
      const bal = await fetchEarningsBalance();
      setBalance(bal);
    } catch (err) {
      toast.error(earningsErrorMessage(err, 'account.earnings.requestFailed'));
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
      <SettingsSection title={t('account.earnings.title')} icon={Banknote}>
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-destructive">{loadError}</p>
          <Button variant="outline" size="sm" onClick={load}>
            {t('common.actions.retry')}
          </Button>
        </div>
      </SettingsSection>
    );
  }

  if (!balance) return null;

  return (
    <SettingsSection
      title={t('account.earnings.title')}
      icon={Banknote}
      info={
        <div className="space-y-2">
          <p>
            <Trans
              i18nKey="account.earnings.info.balances"
              components={[
                <strong className="text-foreground" />,
                <strong className="text-foreground" />,
                <strong className="text-foreground" />,
              ]}
            />
          </p>
          <p>
            {t('account.earnings.info.minimum', {
              amount: fmt.currency(MIN_PAYOUT_AMOUNT, balance.currency),
            })}
          </p>
          <p>
            {t('account.earnings.info.autoThreshold', {
              amount: fmt.currency(AUTO_PAYOUT_THRESHOLD, balance.currency),
            })}
          </p>
        </div>
      }
      contentClassName="space-y-5"
    >
        {/* Borderless figures on mobile — the tiles were boxes inside a box. */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-3">
          <div className="rounded-lg p-0 sm:border sm:bg-muted/30 sm:p-4">
            <p className="text-xs text-muted-foreground">{t('account.earnings.available')}</p>
            <p className="text-2xl font-bold">{fmt.currency(balance.available, balance.currency)}</p>
          </div>
          <div className="rounded-lg p-0 sm:border sm:p-4">
            <p className="text-xs text-muted-foreground">{t('account.earnings.pending')}</p>
            <p className="text-2xl font-semibold">{fmt.currency(balance.pending, balance.currency)}</p>
          </div>
          {balance.requested > 0 && (
            <div className="rounded-lg p-0 sm:border sm:p-4">
              <p className="text-xs text-muted-foreground">{t('account.earnings.requested')}</p>
              <p className="text-2xl font-semibold">{fmt.currency(balance.requested, balance.currency)}</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t pt-4">
          <Button onClick={onRequestPayout} disabled={!canRequest || requesting} className="gap-2">
            {requesting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('account.earnings.requestWithdrawal')}
          </Button>
          {/* An open request owns the explanation: saying "nothing available" while
              a payout is in flight hides where the money went. */}
          {hasOpenRequest && latestPayout && (
            <p className="text-xs text-muted-foreground">
              {t(payoutOpenRequestKey(latestPayout.status))}
            </p>
          )}
          {!hasOpenRequest && balance.available <= 0 && (
            <p className="text-xs text-muted-foreground">{t('account.earnings.nothingAvailable')}</p>
          )}
          {!hasOpenRequest && balance.available > 0 && belowMinimum && (
            <p className="text-xs text-muted-foreground">
              {t('account.earnings.belowMinimum', {
                amount: fmt.currency(MIN_PAYOUT_AMOUNT, balance.currency),
              })}
            </p>
          )}
        </div>

        {latestPayout && (
          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{t('account.earnings.latestRequest')}</p>
              <Badge
                className={cn('border-0 font-medium', payoutStatusBadgeClass(latestPayout.status))}
              >
                {t(payoutStatusKey(latestPayout.status))}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('account.earnings.requestedOn', {
                amount: fmt.currency(latestPayout.amount, latestPayout.currency),
                date: fmt.date(latestPayout.createdAt),
              })}
              {latestPayout.origin
                ? ` · ${PAYOUT_ORIGIN_KEYS[latestPayout.origin]
                    ? t(PAYOUT_ORIGIN_KEYS[latestPayout.origin])
                    : latestPayout.origin}`
                : ''}
            </p>
            {latestPayout.origin === 'auto_threshold' && (
              <p className="text-xs text-muted-foreground">
                {t('account.earnings.autoOpened', {
                  amount: fmt.currency(AUTO_PAYOUT_THRESHOLD, latestPayout.currency),
                })}
              </p>
            )}
            {/* Where the money actually is, for every status — including the two
                that look finished and are not. */}
            <p className="text-sm text-muted-foreground">
              {t(payoutStatusNoteKey(latestPayout.status))}
            </p>
            {/* ⚠ `rejectionReason` is the ONLY place the why lives: the WhatsApp
                notice (`vendor_payout_rejected`) carries just the currency and the
                amount and points the vendor here. Keep it visible. */}
            {payoutReturnedBalance(latestPayout.status) && (
              <p className="text-sm text-destructive">
                {latestPayout.rejectionReason || t('account.earnings.status.noReason')}
              </p>
            )}
            <Button variant="outline" size="sm" onClick={viewTicket} className="gap-1.5">
              <ExternalLink className="h-3.5 w-3.5" /> {t('account.earnings.viewTicket')}
            </Button>
          </div>
        )}
    </SettingsSection>
  );
}
