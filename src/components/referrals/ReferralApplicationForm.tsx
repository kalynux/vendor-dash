import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { LegalLink } from '@/components/common/LegalLink';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Trans, useApiError, useTranslation } from '@/i18n';
import { applyToReferralProgram } from '@/services/referral.service';

/** The backend's own limit on the message. */
const MOTIVATION_MAX_LENGTH = 1000;

export function ReferralApplicationForm({ onApplied }: { onApplied: () => void }) {
  const { t } = useTranslation();
  const apiError = useApiError();
  const [accepted, setAccepted] = useState(false);
  const [motivation, setMotivation] = useState('');
  const [sending, setSending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!accepted) return;
    setSending(true);
    try {
      await applyToReferralProgram(motivation.trim());
      toast.success(t('referrals.apply.sent'));
    } catch (err) {
      apiError.toast(err, { fallbackKey: 'referrals.apply.failed' });
    } finally {
      setSending(false);
    }
    // Both ways: a refusal here means the page is out of date (the program was
    // switched off, or they already applied elsewhere), and the page must catch up.
    onApplied();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="referral-motivation">{t('referrals.apply.motivationLabel')}</Label>
        <Textarea
          id="referral-motivation"
          rows={3}
          maxLength={MOTIVATION_MAX_LENGTH}
          placeholder={t('referrals.apply.motivationPlaceholder')}
          value={motivation}
          onChange={(event) => setMotivation(event.target.value)}
        />
      </div>

      <div className="flex items-start gap-3">
        <Checkbox
          id="referral-terms"
          checked={accepted}
          onCheckedChange={(checked) => setAccepted(checked === true)}
          aria-required
          className="mt-0.5"
        />
        <Label htmlFor="referral-terms" className="block cursor-pointer text-sm font-normal leading-snug">
          <Trans i18nKey="referrals.apply.termsLabel" components={[<LegalLink doc="referralTerms" />]} />
        </Label>
      </div>

      <Button type="submit" className="w-full gap-2 max-md:h-11 sm:w-auto" disabled={!accepted || sending}>
        {sending && <Loader2 className="h-4 w-4 animate-spin" />}
        {sending ? t('referrals.apply.submitting') : t('referrals.apply.submit')}
      </Button>
    </form>
  );
}
