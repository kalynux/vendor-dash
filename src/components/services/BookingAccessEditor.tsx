import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ResponsiveModal } from '@/components/services/ResponsiveModal';
import { useTranslation, useApiError } from '@/i18n';
import { updateBookingAccess } from '@/services/services.service';
import {
  accessFieldErrors, ACCESS_INSTRUCTIONS_MAX, REVEAL_MINUTES_DEFAULT, REVEAL_MINUTES_MAX,
} from '@/components/services/service.constants';
import type { Booking } from '@/types/services.types';

interface BookingAccessEditorProps {
  booking: Booking | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (booking: Booking) => void;
}

/**
 * The link and instructions for ONE booking (`PATCH /vendor/bookings/:id/access`)
 * — for meeting tools that make a new link per session. The service's own
 * defaults are not touched.
 */
export function BookingAccessEditor({ booking, open, onOpenChange, onSaved }: BookingAccessEditorProps) {
  const { t } = useTranslation();
  const apiError = useApiError();
  const [meetingUrl, setMeetingUrl] = useState('');
  const [instructions, setInstructions] = useState('');
  const [reveal, setReveal] = useState<string>(String(REVEAL_MINUTES_DEFAULT));
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !booking) return;
    setMeetingUrl(booking.access?.meetingUrl ?? '');
    setInstructions(booking.access?.instructions ?? '');
    setReveal(String(booking.access?.revealMinutesBefore ?? REVEAL_MINUTES_DEFAULT));
    setSubmitted(false);
  }, [open, booking]);

  const revealNumber = reveal.trim() === '' ? undefined : Number(reveal);
  const errors = accessFieldErrors({ meetingUrl, instructions, revealMinutesBefore: revealNumber });
  const shown = submitted ? errors : {};

  async function save() {
    if (!booking) return;
    setSubmitted(true);
    if (Object.keys(errors).length > 0) return;
    setBusy(true);
    try {
      // All three, always: the form shows the whole current state, and an
      // emptied box is the vendor clearing it (`null`).
      const updated = await updateBookingAccess(booking.id, {
        meetingUrl: meetingUrl.trim() || null,
        instructions: instructions.trim() || null,
        revealMinutesBefore: revealNumber,
      });
      toast.success(t('services.access.saved'));
      onSaved(updated);
      onOpenChange(false);
    } catch (err) {
      apiError.toast(err, { fallbackKey: 'services.access.saveFailed' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(o) => { if (!busy) onOpenChange(o); }}
      title={t('services.access.editTitle')}
      description={t('services.access.editDescription')}
      desktopClassName="sm:max-w-md"
      mobileClassName="h-auto max-h-[92dvh]"
      footer={
        <div className="flex w-full gap-2 sm:justify-end">
          <Button variant="outline" className="flex-1 sm:flex-none" disabled={busy} onClick={() => onOpenChange(false)}>
            {t('common.actions.cancel')}
          </Button>
          <Button className="flex-1 sm:flex-none" disabled={busy} onClick={() => void save()}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('common.actions.save')}
          </Button>
        </div>
      }
    >
      <form
        noValidate
        onSubmit={(e) => { e.preventDefault(); void save(); }}
        className="space-y-4"
      >
        <AccessDetailsInputs
          meetingUrl={meetingUrl}
          instructions={instructions}
          reveal={reveal}
          onMeetingUrl={setMeetingUrl}
          onInstructions={setInstructions}
          onReveal={setReveal}
          errors={{
            meetingUrl: shown.meetingUrl && t(shown.meetingUrl),
            instructions: shown.instructions && t(shown.instructions),
            revealMinutesBefore: shown.revealMinutesBefore && t(shown.revealMinutesBefore),
          }}
        />
      </form>
    </ResponsiveModal>
  );
}

/**
 * The three access boxes plus the "when does the customer see this" line —
 * shared with the service form, so both read the same.
 */
export function AccessDetailsInputs({
  meetingUrl, instructions, reveal, onMeetingUrl, onInstructions, onReveal, errors,
}: {
  meetingUrl: string;
  instructions: string;
  reveal: string;
  onMeetingUrl: (v: string) => void;
  onInstructions: (v: string) => void;
  onReveal: (v: string) => void;
  errors: { meetingUrl?: string; instructions?: string; revealMinutesBefore?: string };
}) {
  const { t } = useTranslation();
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="access-meeting-url" className="text-sm">{t('services.access.meetingUrl')}</Label>
        <Input
          id="access-meeting-url"
          type="url"
          inputMode="url"
          autoComplete="off"
          placeholder={t('services.access.meetingUrlPlaceholder')}
          className="h-11 md:h-10"
          value={meetingUrl}
          onChange={(e) => onMeetingUrl(e.target.value)}
        />
        {errors.meetingUrl && <p data-field-error className="text-xs text-destructive">{errors.meetingUrl}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="access-instructions" className="text-sm">{t('services.access.instructions')}</Label>
        <Textarea
          id="access-instructions"
          rows={3}
          maxLength={ACCESS_INSTRUCTIONS_MAX}
          placeholder={t('services.access.instructionsPlaceholder')}
          value={instructions}
          onChange={(e) => onInstructions(e.target.value)}
        />
        {errors.instructions && <p data-field-error className="text-xs text-destructive">{errors.instructions}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="access-reveal" className="text-sm">{t('services.access.reveal')}</Label>
        <div className="flex items-center gap-2">
          <Input
            id="access-reveal"
            type="number"
            inputMode="numeric"
            min={0}
            max={REVEAL_MINUTES_MAX}
            className="h-11 w-28 md:h-10"
            value={reveal}
            onChange={(e) => onReveal(e.target.value)}
          />
          <span className="text-sm text-muted-foreground">{t('services.access.revealUnit')}</span>
        </div>
        {errors.revealMinutesBefore && (
          <p data-field-error className="text-xs text-destructive">{errors.revealMinutesBefore}</p>
        )}
      </div>
      {/* Otherwise "the customer can't see my link" gets reported as a bug. */}
      <p className="text-xs text-muted-foreground">{t('services.access.visibilityHelp')}</p>
    </>
  );
}
