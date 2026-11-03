import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PaymentBrandLogo } from '@/components/payment-methods';
import { payoutEntryBrand, payoutEntryTitle } from '@/components/vendor-settings/payout';
import { PagedSection } from '@/components/vendor-settings/PagedSection';
import { SettingsSection } from '@/components/vendor-settings/SettingsSection';
import {
  payoutStatusBadgeClass,
  payoutStatusKey,
  payoutStatusNoteKey,
} from '@/components/vendor-settings/earnings.constants';
import { usePagedList } from '@/components/vendor-settings/usePagedList';
import { cn } from '@/lib/utils';
import { useApiError, useFormatters, useTranslation } from '@/i18n';
import {
  fetchReferralPayouts,
  fetchReferralRewards,
  fetchReferredAccounts,
  requestReferralPayout,
} from '@/services/referral.service';
import { payoutReturnedBalance } from '@/types/earnings.types';
import type {
  MaskedPayoutMethod,
  ReferralOverview,
  ReferralPayout,
  ReferralReward,
  ReferredAccount,
} from '@/types/referral.types';
import { maskedPayoutDetail, referralCategoryKey, rewardStatusKey } from './referral.helpers';

const PAYOUT_PAGE = '/dashboard/account/payout';

function MethodLine({ method }: { method: MaskedPayoutMethod }) {
  const { t } = useTranslation();
  return (
    <div className="flex min-w-0 items-center gap-3">
      <PaymentBrandLogo brand={payoutEntryBrand(method)} size="md" decorative />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{payoutEntryTitle(method, t)}</p>
        <p className="truncate text-xs text-muted-foreground">{maskedPayoutDetail(method)}</p>
      </div>
    </div>
  );
}

/**
 * Where the money goes. This page never edits it: the Payout page does, and the
 * server reads that live, so changing it there changes it here.
 */
function PayoutDestination({ overview }: { overview: ReferralOverview }) {
  const { t } = useTranslation();
  const destination = overview.payoutDestination;
  const method = destination?.method;

  return (
    <div className="space-y-2 border-t pt-4">
      <p className="text-sm font-medium">{t('referrals.destination.title')}</p>
      {method ? (
        <MethodLine method={method} />
      ) : (
        <p className="text-sm text-muted-foreground">{t('referrals.destination.none')}</p>
      )}
      {/* An agency's or agent's method lives in another app, and adding one to this
          shop wouldn't replace it, so a link here would be a dead end. */}
      {destination?.source === 'agency' || destination?.source === 'agent' ? (
        <p className="text-xs text-muted-foreground">{t(`referrals.destination.${destination.source}`)}</p>
      ) : (
        <Button asChild variant="link" size="sm" className="h-auto p-0">
          <Link to={PAYOUT_PAGE}>{t(method ? 'referrals.destination.change' : 'referrals.destination.add')}</Link>
        </Button>
      )}
    </div>
  );
}

function BalanceSection({ overview, onWithdrawn }: { overview: ReferralOverview; onWithdrawn: () => Promise<void> }) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const apiError = useApiError();
  const [requesting, setRequesting] = useState(false);
  const { balances, program, canWithdraw, balanceFrozen, payoutDestination } = overview;

  if (!balances) return null;
  const { currency } = balances;

  async function onWithdraw() {
    setRequesting(true);
    try {
      await requestReferralPayout();
      toast.success(t('referrals.balance.withdrawn'));
    } catch (err) {
      apiError.toast(err, { fallbackKey: 'referrals.balance.withdrawFailed' });
    } finally {
      setRequesting(false);
    }
    await onWithdrawn();
  }

  // One reason at a time, the one the partner can act on first. While a debt is
  // open `available` is 0, and the note under the figures already says why.
  const hint = balanceFrozen
    ? t('referrals.balance.hint.frozen')
    : balances.clawback > 0
      ? null
      : balances.requested > 0
        ? t('referrals.balance.hint.requested')
        : !payoutDestination?.method
          ? t('referrals.balance.hint.noDestination')
          : t('referrals.balance.hint.belowMinimum', { amount: fmt.currency(program.minPayoutAmount, currency) });

  return (
    <SettingsSection
      title={t('referrals.balance.title')}
      description={t('referrals.balance.separate')}
      contentClassName="space-y-5"
    >
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-3">
        <div className="rounded-lg p-0 sm:border sm:bg-muted/30 sm:p-4">
          <p className="text-xs text-muted-foreground">{t('referrals.balance.available')}</p>
          <p className="text-2xl font-bold">{fmt.currency(balances.available, currency)}</p>
        </div>
        <div className="rounded-lg p-0 sm:border sm:p-4">
          <p className="text-xs text-muted-foreground">{t('referrals.balance.pending')}</p>
          <p className="text-2xl font-semibold">{fmt.currency(balances.pending, currency)}</p>
          <p className="text-xs text-muted-foreground">
            {t('referrals.balance.pendingHint', { count: program.rewardWaitDays })}
          </p>
        </div>
        {balances.requested > 0 && (
          <div className="rounded-lg p-0 sm:border sm:p-4">
            <p className="text-xs text-muted-foreground">{t('referrals.balance.requested')}</p>
            <p className="text-2xl font-semibold">{fmt.currency(balances.requested, currency)}</p>
          </div>
        )}
        {/* ⛔ A debt, not a balance: shown as the server sends it, never added to or
            taken from the figures beside it. */}
        {balances.clawback > 0 && (
          <div className="rounded-lg p-0 sm:border sm:border-destructive/30 sm:p-4">
            <p className="text-xs text-destructive">{t('referrals.balance.clawback')}</p>
            <p className="text-2xl font-semibold text-destructive">{fmt.currency(balances.clawback, currency)}</p>
          </div>
        )}
      </div>

      {balances.clawback > 0 && <p className="text-sm text-muted-foreground">{t('referrals.balance.clawbackNote')}</p>}

      <PayoutDestination overview={overview} />

      {canWithdraw ? (
        <div className="space-y-2 border-t pt-4">
          <Button onClick={onWithdraw} disabled={requesting} className="w-full gap-2 max-md:h-11 sm:w-auto">
            {requesting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('referrals.balance.withdraw', { amount: fmt.currency(balances.available, currency) })}
          </Button>
          <p className="text-xs text-muted-foreground">{t('referrals.balance.withdrawHint')}</p>
        </div>
      ) : (
        hint && <p className="border-t pt-4 text-xs text-muted-foreground">{hint}</p>
      )}
    </SettingsSection>
  );
}

/** The balance and the three lists. Only mounted for someone who has been a partner: the lists 404 for anyone else. */
export function ReferralMoney({ overview, onChanged }: { overview: ReferralOverview; onChanged: () => Promise<void> }) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const referred = usePagedList<ReferredAccount>(fetchReferredAccounts);
  const rewards = usePagedList<ReferralReward>(fetchReferralRewards);
  const payouts = usePagedList<ReferralPayout>(fetchReferralPayouts);
  const currency = overview.balances?.currency;

  return (
    <>
      <BalanceSection
        overview={overview}
        onWithdrawn={async () => {
          await onChanged();
          await payouts.load();
        }}
      />

      <PagedSection
        list={referred}
        titleKey="referrals.referred.title"
        infoKey="referrals.referred.info"
        emptyKey="referrals.referred.empty"
        description={
          overview.referred && overview.referred.total > 0
            ? t('referrals.referred.summary', {
                count: overview.referred.total,
                earning: overview.referred.earning,
              })
            : undefined
        }
        getKey={(row) => row.id}
        renderItem={(row) => {
          const period = !row.expiresAt
            ? t('referrals.referred.neverEarns')
            : !row.earning
              ? t('referrals.referred.ended', { date: fmt.date(row.expiresAt) })
              : overview.status === 'active'
                ? t('referrals.referred.earningUntil', { date: fmt.date(row.expiresAt) })
                : t('referrals.referred.endsOn', { date: fmt.date(row.expiresAt) });
          return (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 break-words text-sm font-medium">{row.name}</p>
                <p className="shrink-0 text-sm font-semibold tabular-nums">{fmt.currency(row.totalEarned, currency)}</p>
              </div>
              <p className="text-sm text-muted-foreground">
                {t(referralCategoryKey(row.category))} ·{' '}
                {t('referrals.referred.signedUp', { date: fmt.date(row.registeredAt) })}
              </p>
              <p className="text-xs text-muted-foreground">{period}</p>
            </>
          );
        }}
      />

      <PagedSection
        list={rewards}
        titleKey="referrals.rewards.title"
        infoKey="referrals.rewards.info"
        emptyKey="referrals.rewards.empty"
        getKey={(row) => row.id}
        renderItem={(row) => (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 break-words text-sm font-medium">{row.name}</p>
              <p className="shrink-0 text-sm font-semibold tabular-nums">
                {/* `reversed` is shown as 0, whatever the row still carries. */}
                {fmt.currency(row.status === 'reversed' ? 0 : row.amount, row.currency)}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              {t(referralCategoryKey(row.category))} · {t('referrals.rewards.earned', { date: fmt.date(row.earnedAt) })}
            </p>
            <p className="text-xs text-muted-foreground">
              {t(rewardStatusKey(row.status), { date: fmt.date(row.availableFrom) })}
              {row.adjusted && row.status !== 'reversed' ? ` · ${t('referrals.rewards.adjusted')}` : ''}
            </p>
          </>
        )}
      />

      <PagedSection
        list={payouts}
        titleKey="referrals.payouts.title"
        infoKey="referrals.payouts.info"
        emptyKey="referrals.payouts.empty"
        getKey={(row) => row.id}
        renderItem={(row) => (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold tabular-nums">{fmt.currency(row.amount, row.currency)}</p>
              <Badge className={cn('border-0 font-medium', payoutStatusBadgeClass(row.status))}>
                {t(payoutStatusKey(row.status))}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('referrals.payouts.requested', { date: fmt.date(row.requestedAt) })}
            </p>
            <MethodLine method={row.destination} />
            <p className="text-sm text-muted-foreground">{t(payoutStatusNoteKey(row.status))}</p>
            {payoutReturnedBalance(row.status) && row.rejectionReason && (
              <p className="text-sm text-destructive">{row.rejectionReason}</p>
            )}
          </div>
        )}
      />
    </>
  );
}
