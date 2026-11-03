import { useCallback, useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';

import { CardSkeleton } from '@/components/billing/BillingSkeletons';
import { Button } from '@/components/ui/button';
import { SettingsSection, SettingsSections } from '@/components/vendor-settings/SettingsSection';
import { apiErrorMessage, useFormatters, useTranslation } from '@/i18n';
import { fetchReferralOverview } from '@/services/referral.service';
import type { ReferralOverview } from '@/types/referral.types';
import { ReferralApplicationForm } from './ReferralApplicationForm';
import { ReferralMoney } from './ReferralMoney';
import { ProgramRules, ReferralEarnSection, ReferralShareSection } from './ReferralShare';

/** What the page says about where the partnership stands. `null` when it has nothing to say. */
function StatusSection({ overview, onApplied }: { overview: ReferralOverview; onApplied: () => void }) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const { status, statusReason, canApply, program, balanceFrozen, appliedAt } = overview;

  if (status === 'none') {
    if (!canApply) {
      return (
        <SettingsSection title={t('referrals.closed.title')}>
          <p className="text-sm text-muted-foreground">{t('referrals.closed.body')}</p>
        </SettingsSection>
      );
    }
    return (
      <SettingsSection title={t('referrals.intro.title')} contentClassName="space-y-5">
        <p className="text-sm">{t('referrals.intro.lead')}</p>
        <ProgramRules program={program} />
        <ReferralApplicationForm onApplied={onApplied} />
      </SettingsSection>
    );
  }

  if (status === 'active') {
    // ⚠ Not `canApply`-related: an administrator can switch the whole program off
    // with partners on it, and from then on nothing new earns.
    if (program.enabled) return null;
    return (
      <SettingsSection title={t('referrals.status.paused.title')}>
        <p className="text-sm text-muted-foreground">{t('referrals.status.paused.body')}</p>
      </SettingsSection>
    );
  }

  if (status === 'pending') {
    return (
      <SettingsSection title={t('referrals.status.pending.title')}>
        <p className="text-sm text-muted-foreground">
          {t('referrals.status.pending.body', { date: appliedAt ? fmt.date(appliedAt) : '' })}
        </p>
      </SettingsSection>
    );
  }

  const ended = status === 'suspended' || status === 'terminated';
  return (
    <SettingsSection
      title={
        status === 'rejected'
          ? t('referrals.status.rejected.title')
          : status === 'suspended'
            ? t('referrals.status.suspended.title')
            : status === 'terminated'
              ? t('referrals.status.terminated.title')
              : t('referrals.status.unknown.title')
      }
      contentClassName="space-y-2"
    >
      {/* Written by the administrator to be shown. There is no other place to read
          it: a WhatsApp message outside the 24-hour window points back here. */}
      {statusReason && <p className="text-sm">{statusReason}</p>}
      {status === 'suspended' && (
        <p className="text-sm text-muted-foreground">{t('referrals.status.suspended.body')}</p>
      )}
      {status === 'terminated' && (
        <p className="text-sm text-muted-foreground">{t('referrals.status.terminated.body')}</p>
      )}
      {ended && (
        <p className="text-sm text-muted-foreground">
          {balanceFrozen ? t('referrals.status.frozen') : t('referrals.status.released')}
        </p>
      )}
      {status === 'rejected' && canApply && (
        <p className="text-sm text-muted-foreground">{t('referrals.status.rejected.canApply')}</p>
      )}
    </SettingsSection>
  );
}

/**
 * Account → Referrals. The whole page hangs off one `GET /me/referral`.
 *
 * ⛔ Separate money: nothing here is added to the shop's earnings, and nothing of
 * it appears on the Payout tab.
 */
export function ReferralTab() {
  const { t } = useTranslation();
  const [overview, setOverview] = useState<ReferralOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setOverview(await fetchReferralOverview());
    } catch (err) {
      setLoadError(apiErrorMessage(err, { fallbackKey: 'referrals.loadFailed' }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** After an action, or a refused one that means this page is out of date. Keeps what is on screen if it fails. */
  const refresh = useCallback(async () => {
    try {
      setOverview(await fetchReferralOverview());
    } catch {
      // The action's own message has already been shown.
    }
  }, []);

  if (loading) return <CardSkeleton lines={3} />;

  if (loadError || !overview) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-destructive">{loadError}</p>
        <Button variant="outline" size="sm" onClick={load}>
          {t('common.actions.retry')}
        </Button>
      </div>
    );
  }

  const { status, canApply, approvedAt, code, codeActive, links, terms, balances, program } = overview;

  // A former partner always keeps their balances and history. Someone who was
  // never approved cannot have any, so there would only be zeros and empty lists.
  const hasMoney = !!balances && (status === 'active' || !!approvedAt);

  return (
    <SettingsSections>
      <StatusSection overview={overview} onApplied={refresh} />

      {status !== 'none' && canApply && (
        <SettingsSection title={t('referrals.apply.reapplyTitle')}>
          <ReferralApplicationForm onApplied={refresh} />
        </SettingsSection>
      )}

      {code && <ReferralShareSection code={code} active={!!codeActive} links={links ?? null} />}

      {status === 'active' && terms && <ReferralEarnSection terms={terms} program={program} currency={balances?.currency} />}

      {hasMoney && <ReferralMoney overview={overview} onChanged={refresh} />}
    </SettingsSections>
  );
}
