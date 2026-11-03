import { Copy, Share2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { SettingsSection } from '@/components/vendor-settings/SettingsSection';
import { useFormatters, useTranslation, type TranslationKey } from '@/i18n';
import { copyText } from '@/platform/clipboard';
import { shareAvailable, shareContent } from '@/platform/share';
import type { ReferralCategoryTerms, ReferralLinks, ReferralProgram } from '@/types/referral.types';
import { referralCategoryKey } from './referral.helpers';

/** The rules the copy must not contradict, with every number from the server. */
export function ProgramRules({ program, currency }: { program: ReferralProgram; currency?: string }) {
  const { t } = useTranslation();
  const fmt = useFormatters();

  return (
    <ul className="space-y-2 text-sm text-muted-foreground">
      <li>{t('referrals.rules.fromCommission')}</li>
      <li>{t('referrals.rules.who')}</li>
      <li>{t('referrals.rules.limited')}</li>
      <li>
        {t('referrals.rules.earned')} {t('referrals.rules.wait', { count: program.rewardWaitDays })}
      </li>
      <li>{t('referrals.rules.refunds')}</li>
      <li>{t('referrals.rules.minimum', { amount: fmt.currency(program.minPayoutAmount, currency) })}</li>
    </ul>
  );
}

/** The partner's own rates. They can differ from everyone else's, so they are read per person. */
export function ReferralEarnSection({
  terms,
  program,
  currency,
}: {
  terms: Record<string, ReferralCategoryTerms>;
  program: ReferralProgram;
  currency?: string;
}) {
  const { t } = useTranslation();
  const fmt = useFormatters();

  return (
    <SettingsSection title={t('referrals.terms.title')} info={<ProgramRules program={program} currency={currency} />}>
      <ul className="space-y-2">
        {Object.entries(terms).map(([category, term]) => (
          <li key={category} className="flex flex-col text-sm sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
            <span className="font-medium">{t(referralCategoryKey(category))}</span>
            <span className="text-muted-foreground">
              {t('referrals.terms.line', { rate: fmt.number(term.ratePercent), count: term.durationMonths })}
            </span>
          </li>
        ))}
      </ul>
    </SettingsSection>
  );
}

interface LinkRowProps {
  nameKey: TranslationKey;
  hintKey: TranslationKey;
  url: string;
  /** Sharing a link that earns nothing helps nobody, so only copying stays. */
  shareable: boolean;
}

function LinkRow({ nameKey, hintKey, url, shareable }: LinkRowProps) {
  const { t } = useTranslation();
  const name = t(nameKey);

  async function onCopy() {
    if (await copyText(url)) toast.success(t('common.toast.linkCopied'));
    else toast.error(t('common.toast.copyFailed'));
  }

  async function onShare() {
    const outcome = await shareContent({
      title: t('referrals.share.shareMessage'),
      text: t('referrals.share.shareMessage'),
      url,
      dialogTitle: name,
    });
    if (outcome === 'failed') toast.error(t('referrals.share.shareFailed'));
  }

  return (
    <li className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">{t(hintKey)}</p>
        <p className="truncate text-xs text-muted-foreground">{url}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onCopy}
          aria-label={t('referrals.share.copyLink', { name })}
        >
          <Copy className="h-4 w-4" />
        </Button>
        {shareable && shareAvailable && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onShare}
            aria-label={t('referrals.share.shareLink', { name })}
          >
            <Share2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </li>
  );
}

/**
 * The code and the links to pass on.
 *
 * ⛔ The WhatsApp and Telegram links are shared, never opened here. They start a
 * chat with Wi-Mall's bot carrying this partner's code, so opening one on the
 * partner's own phone would message the bot as the partner rather than reach
 * anybody they want to invite.
 */
export function ReferralShareSection({
  code,
  active,
  links,
}: {
  code: string;
  active: boolean;
  links: ReferralLinks | null;
}) {
  const { t } = useTranslation();

  async function onCopyCode() {
    if (await copyText(code)) toast.success(t('common.toast.copied'));
    else toast.error(t('common.toast.copyFailed'));
  }

  return (
    <SettingsSection title={t('referrals.share.title')} contentClassName="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 break-all font-mono text-2xl font-semibold tracking-wide">{code}</p>
        <Button variant="outline" size="sm" onClick={onCopyCode} className="shrink-0 gap-1.5">
          <Copy className="h-3.5 w-3.5" />
          {t('referrals.share.copyCode')}
        </Button>
      </div>

      {!active && <p className="text-sm text-destructive">{t('referrals.share.inactive')}</p>}

      <ul className="divide-y">
        {links?.registerUrl && (
          <LinkRow
            nameKey="referrals.share.register.name"
            hintKey="referrals.share.register.hint"
            url={links.registerUrl}
            shareable={active}
          />
        )}
        {active && links?.whatsappUrl && (
          <LinkRow
            nameKey="referrals.share.whatsapp.name"
            hintKey="referrals.share.whatsapp.hint"
            url={links.whatsappUrl}
            shareable
          />
        )}
        {active && links?.telegramUrl && (
          <LinkRow
            nameKey="referrals.share.telegram.name"
            hintKey="referrals.share.telegram.hint"
            url={links.telegramUrl}
            shareable
          />
        )}
      </ul>
    </SettingsSection>
  );
}
