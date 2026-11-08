import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { ResponsiveModal } from '@/components/services/ResponsiveModal';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { reportLead, sendCallMe, sendLeadMessage } from '@/services/listings.service';
import { LISTING_LIMITS, type LeadReportWant, type VendorLead } from '@/types/listings.types';
import { useApiError, useFormatters, useTranslation, type TranslationKey } from '@/i18n';
import { LEAD_FIELD_KEYS as FIELD_KEYS, leadName } from './listingStatus';

/**
 * The four sheets a lead row opens. A sheet on a phone, a window on desktop
 * (`ResponsiveModal`). Each one is one task with one way out.
 *
 * ⛔ The customer here is masked on purpose; nothing in these sheets keeps,
 * caches or logs any of it.
 */

const footerClass = 'flex-col-reverse gap-2 sm:flex-row sm:justify-end';
const actionClass = 'max-md:h-11 max-md:w-full';

// ─── Ask them to call me ──────────────────────────────────────────────────────

export function CallMeSheet({
  lead,
  cost,
  onClose,
  onSent,
}: {
  lead: VendorLead | null;
  /** Credits, from the price list; `null` when it could not be read. */
  cost: number | null;
  onClose: () => void;
  onSent: () => void;
}) {
  const { t } = useTranslation();
  const apiError = useApiError();
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!lead) return;
    setSending(true);
    try {
      const message = await sendCallMe(lead.id);
      if (message.status === 'failed') toast.error(t('listings.leads.callMeFailed'));
      else toast.success(t('listings.leads.callMeSent'));
      onSent();
      onClose();
    } catch (err) {
      apiError.toast(err, { fallbackKey: 'listings.leads.callMeFailed' });
    } finally {
      setSending(false);
    }
  };

  return (
    <ResponsiveModal
      open={!!lead}
      onOpenChange={(open) => !open && !sending && onClose()}
      title={t('listings.leads.callMeTitle')}
      mobileClassName="h-auto max-h-[92dvh]"
      disableClose={sending}
      footerClassName={footerClass}
      footer={
        <>
          <Button variant="ghost" className={actionClass} disabled={sending} onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button className={actionClass} disabled={sending} onClick={() => void send()}>
            {t('listings.leads.callMeSend')}
          </Button>
        </>
      }
    >
      {lead && (
        <div className="space-y-3 text-sm">
          <p>{t('listings.leads.callMeBody', { name: leadName(lead, t('listings.leads.aCustomer')) })}</p>
          {cost !== null && <p className="text-muted-foreground">{t('listings.leads.callMeCost', { count: cost })}</p>}
        </div>
      )}
    </ResponsiveModal>
  );
}

// ─── Send a message ───────────────────────────────────────────────────────────

export function MessageSheet({
  lead,
  onClose,
  onSent,
}: {
  lead: VendorLead | null;
  onClose: () => void;
  onSent: () => void;
}) {
  const { t } = useTranslation();
  const apiError = useApiError();
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  // A fresh, empty box for every lead — a draft meant for one customer must
  // never be waiting in the box when the next one opens.
  useEffect(() => {
    setBody('');
  }, [lead?.id]);

  const trimmed = body.trim();

  const send = async () => {
    if (!lead || !trimmed) return;
    setSending(true);
    try {
      const message = await sendLeadMessage(lead.id, trimmed);
      if (message.status === 'failed') toast.error(t('listings.leads.messageFailed'));
      else toast.success(t('listings.leads.messageSent'));
      onSent();
      onClose();
    } catch (err) {
      apiError.toast(err, { fallbackKey: 'listings.leads.messageFailed' });
    } finally {
      setSending(false);
    }
  };

  return (
    <ResponsiveModal
      open={!!lead}
      onOpenChange={(open) => !open && !sending && onClose()}
      title={t('listings.leads.messageTitle')}
      description={lead ? leadName(lead, t('listings.leads.aCustomer')) : undefined}
      mobileClassName="h-auto max-h-[92dvh]"
      disableClose={sending}
      footerClassName={footerClass}
      footer={
        <>
          <Button variant="ghost" className={actionClass} disabled={sending} onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button className={actionClass} disabled={sending || !trimmed} onClick={() => void send()}>
            {t('listings.leads.messageSend')}
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        <Label htmlFor="lead-message">{t('listings.leads.messageLabel')}</Label>
        <Textarea
          id="lead-message"
          rows={5}
          maxLength={LISTING_LIMITS.messageMax}
          value={body}
          placeholder={t('listings.leads.messagePlaceholder')}
          onChange={(e) => setBody(e.target.value)}
          className="max-md:text-base"
        />
        <div className="flex items-start justify-between gap-3 text-xs text-muted-foreground">
          <p>{t('listings.leads.messageNote')}</p>
          <span className="shrink-0 tabular-nums">
            {t('listings.leads.chars', { count: body.length, max: LISTING_LIMITS.messageMax })}
          </span>
        </div>
      </div>
    </ResponsiveModal>
  );
}

// ─── WhatsApp's 24-hour window ────────────────────────────────────────────────

export function WhatsAppWindowSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={t('listings.leads.windowTitle')}
      mobileClassName="h-auto max-h-[92dvh]"
      footerClassName={footerClass}
      footer={
        <Button className={actionClass} onClick={onClose}>
          {t('listings.leads.windowOk')}
        </Button>
      }
    >
      <div className="space-y-3 text-sm">
        <p>{t('listings.leads.windowBody')}</p>
        <p className="text-muted-foreground">{t('listings.leads.windowWho')}</p>
      </div>
    </ResponsiveModal>
  );
}

// ─── Report ───────────────────────────────────────────────────────────────────

export function ReportSheet({
  lead,
  onClose,
  onSent,
}: {
  lead: VendorLead | null;
  onClose: () => void;
  onSent: (leadId: string) => void;
}) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const apiError = useApiError();
  const [wants, setWants] = useState<LeadReportWant[]>([]);
  const [revealIds, setRevealIds] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);
  const [tried, setTried] = useState(false);

  const refundable = lead?.fields.filter((f) => !f.refunded) ?? [];

  // Reset per lead; every not-yet-refunded unlock starts ticked.
  useEffect(() => {
    setWants([]);
    setReason('');
    setTried(false);
    setRevealIds((lead?.fields ?? []).filter((f) => !f.refunded).map((f) => f.revealId));
  }, [lead?.id, lead?.fields]);

  const toggleWant = (w: LeadReportWant) =>
    setWants((cur) => (cur.includes(w) ? cur.filter((x) => x !== w) : [...cur, w]));
  const toggleReveal = (id: string) =>
    setRevealIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const wantsRefund = wants.includes('refund');
  const reasonLength = reason.trim().length;
  const errors = {
    wants: wants.length === 0 ? t('listings.leads.reportNeedWant') : null,
    reveals: wantsRefund && revealIds.length === 0 ? t('listings.leads.reportNeedReveal') : null,
    reason:
      reasonLength < LISTING_LIMITS.reportReasonMin
        ? t('listings.leads.reportReasonShort', { min: LISTING_LIMITS.reportReasonMin })
        : null,
  };
  const valid = !errors.wants && !errors.reveals && !errors.reason;

  const send = async () => {
    setTried(true);
    if (!lead || !valid) return;
    setSending(true);
    try {
      const res = await reportLead(lead.id, {
        wants,
        revealIds: wantsRefund ? revealIds : [],
        reason: reason.trim(),
      });
      toast.success(t('listings.leads.reportSent', { number: res.ticketNumber }));
      onSent(lead.id);
      onClose();
    } catch (err) {
      apiError.toast(err);
    } finally {
      setSending(false);
    }
  };

  const wantRow = (w: LeadReportWant, labelKey: TranslationKey, hintKey: TranslationKey, disabled = false) => (
    <label key={w} htmlFor={`report-${w}`} className="flex min-h-11 cursor-pointer items-start gap-3 py-1.5">
      <Checkbox
        id={`report-${w}`}
        checked={wants.includes(w)}
        disabled={disabled}
        onCheckedChange={() => toggleWant(w)}
        className="mt-0.5"
      />
      <span className="space-y-0.5">
        <span className="block text-sm font-medium">{t(labelKey)}</span>
        <span className="block text-xs text-muted-foreground">
          {disabled ? t('listings.leads.reportNothingToRefund') : t(hintKey)}
        </span>
      </span>
    </label>
  );

  return (
    <ResponsiveModal
      open={!!lead}
      onOpenChange={(open) => !open && !sending && onClose()}
      title={t('listings.leads.reportTitle')}
      description={lead ? leadName(lead, t('listings.leads.aCustomer')) : undefined}
      disableClose={sending}
      footerClassName={footerClass}
      footer={
        <>
          <Button variant="ghost" className={actionClass} disabled={sending} onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button className={actionClass} disabled={sending} onClick={() => void send()}>
            {t('listings.leads.reportSend')}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="space-y-1">
          <p className="text-sm font-medium">{t('listings.leads.reportWants')}</p>
          {wantRow('refund', 'listings.leads.reportRefund', 'listings.leads.reportRefundHint', refundable.length === 0)}
          {wantRow('check_customer', 'listings.leads.reportCheck', 'listings.leads.reportCheckHint')}
          {tried && errors.wants && <p className="text-xs text-destructive">{errors.wants}</p>}
        </div>

        {wantsRefund && refundable.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium">{t('listings.leads.reportPick')}</p>
            {refundable.map((f) => (
              <label key={f.revealId} className="flex min-h-11 cursor-pointer items-center gap-3">
                <Checkbox
                  checked={revealIds.includes(f.revealId)}
                  onCheckedChange={() => toggleReveal(f.revealId)}
                />
                <span className="text-sm">
                  {t(FIELD_KEYS[f.field] ?? 'listings.leads.unlocked')} · {fmt.date(f.at)} ·{' '}
                  {t('listings.leads.cost', { count: f.cost })}
                </span>
              </label>
            ))}
            {tried && errors.reveals && <p className="text-xs text-destructive">{errors.reveals}</p>}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="report-reason">{t('listings.leads.reportReason')}</Label>
          <Textarea
            id="report-reason"
            rows={4}
            maxLength={LISTING_LIMITS.reportReasonMax}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-invalid={tried && !!errors.reason}
            className="max-md:text-base"
          />
          <div className="flex items-start justify-between gap-3 text-xs">
            <p className={tried && errors.reason ? 'text-destructive' : 'text-muted-foreground'}>
              {tried && errors.reason
                ? errors.reason
                : t('listings.leads.reportReasonHint', {
                    min: LISTING_LIMITS.reportReasonMin,
                    max: LISTING_LIMITS.reportReasonMax,
                  })}
            </p>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {t('listings.leads.chars', { count: reason.length, max: LISTING_LIMITS.reportReasonMax })}
            </span>
          </div>
        </div>
      </div>
    </ResponsiveModal>
  );
}
