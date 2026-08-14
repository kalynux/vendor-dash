import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useTranslation, useFormatters, useApiError, type TranslationKey } from '@/i18n';
import { completeBooking } from '@/services/services.service';
import { toMajorUnits } from '@/components/services/service.constants';
import type { Booking, CompleteBookingPayload, CompleteBookingResult } from '@/types/services.types';

type Mode = 'asBooked' | 'actualEnd' | 'extraMinutes' | 'fixedPrice';

const MODES: { value: Mode; labelKey: TranslationKey; hintKey: TranslationKey }[] = [
  {
    value: 'asBooked',
    labelKey: 'services.complete.modes.asBooked',
    hintKey: 'services.complete.modes.asBookedHint',
  },
  {
    value: 'actualEnd',
    labelKey: 'services.complete.modes.actualEnd',
    hintKey: 'services.complete.modes.actualEndHint',
  },
  {
    value: 'extraMinutes',
    labelKey: 'services.complete.modes.extraMinutes',
    hintKey: 'services.complete.modes.extraMinutesHint',
  },
  {
    value: 'fixedPrice',
    labelKey: 'services.complete.modes.fixedPrice',
    hintKey: 'services.complete.modes.fixedPriceHint',
  },
];

interface CompleteBookingDialogProps {
  booking: Booking | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful completion so the parent can refresh. */
  onCompleted: () => void;
}

export function CompleteBookingDialog({ booking, open, onOpenChange, onCompleted }: CompleteBookingDialogProps) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const apiError = useApiError();
  const [mode, setMode] = useState<Mode>('asBooked');
  const [actualEndAt, setActualEndAt] = useState('');
  const [additionalMinutes, setAdditionalMinutes] = useState('');
  const [fixedPrice, setFixedPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CompleteBookingResult | null>(null);

  // Reset transient state whenever the dialog (re)opens.
  useEffect(() => {
    if (open) {
      setMode('asBooked');
      setActualEndAt('');
      setAdditionalMinutes('');
      setFixedPrice('');
      setResult(null);
      setBusy(false);
    }
  }, [open]);

  const currency = booking?.currency ?? 'XAF';

  async function handleSubmit() {
    if (!booking) return;
    const payload: CompleteBookingPayload = {};
    if (mode === 'actualEnd') {
      if (!actualEndAt) { toast.error(t('services.complete.errors.actualEndRequired')); return; }
      payload.actualEndAt = new Date(actualEndAt).toISOString();
    } else if (mode === 'extraMinutes') {
      const n = Number(additionalMinutes);
      if (!Number.isFinite(n) || n <= 0) { toast.error(t('services.complete.errors.extraMinutesRequired')); return; }
      payload.additionalMinutes = n;
    } else if (mode === 'fixedPrice') {
      const n = Number(fixedPrice);
      if (!Number.isFinite(n) || n < 0) { toast.error(t('services.complete.errors.priceInvalid')); return; }
      payload.fixedPrice = n;
    }
    setBusy(true);
    try {
      const res = await completeBooking(booking._id, payload);
      setResult(res);
      toast.success(t('services.complete.resultTitle'));
      onCompleted();
    } catch (err) {
      apiError.toast(err, { fallbackKey: 'services.errors.completeFailed' });
    } finally {
      setBusy(false);
    }
  }

  const money = (amount: number) => fmt.currency(toMajorUnits(amount), currency);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        {result ? (
          // ── Settlement result ──────────────────────────────────────────
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" /> {t('services.complete.resultTitle')}
              </DialogTitle>
              <DialogDescription>{t('services.complete.resultDescription')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-2 rounded-lg border p-3 text-sm">
              <Row label={t('services.complete.originallyBooked')} value={money(result.priceSnapshot)} />
              {/* What is owed is measured against what was PAID, so showing the
                  paid figure is what makes the balance below add up. */}
              {result.amountPaid !== undefined && (
                <Row label={t('services.complete.amountPaid')} value={money(result.amountPaid)} muted />
              )}
              <Row label={t('services.complete.finalPrice')} value={money(result.finalPrice)} strong />
              {result.breakdown?.peakHoursSurcharge > 0 && (
                <Row
                  label={t('services.complete.peakSurcharge')}
                  value={money(result.breakdown.peakHoursSurcharge)}
                  muted
                />
              )}
            </div>
            {result.additionalAmountDue > 0 && (
              <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-500/30 dark:bg-amber-500/10">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-300">
                    {t('services.complete.additionalDue', {
                      amount: money(result.additionalAmountDue),
                    })}
                  </p>
                  <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
                    {t('services.complete.additionalDueHelp')}
                  </p>
                </div>
              </div>
            )}
            {/* Settling *below* what was already paid. Surfaced but never sent
                back automatically — it is usually a goodwill discount the vendor
                intends to hand over themselves. */}
            {!!result.creditDue && result.creditDue > 0 && (
              <div className="flex gap-2 rounded-lg border p-3 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-medium">
                    {t('services.complete.creditDue', { amount: money(result.creditDue) })}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t('services.complete.creditDueHelp')}
                  </p>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>{t('common.actions.done')}</Button>
            </DialogFooter>
          </>
        ) : (
          // ── Settlement form ────────────────────────────────────────────
          <>
            <DialogHeader>
              <DialogTitle>{t('services.complete.title')}</DialogTitle>
              <DialogDescription>{t('services.complete.description')}</DialogDescription>
            </DialogHeader>

            <RadioGroup value={mode} onValueChange={(v) => setMode(v as Mode)} className="gap-2">
              {MODES.map((option) => (
                <Label
                  key={option.value}
                  htmlFor={`complete-${option.value}`}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 hover:bg-accent has-[:checked]:border-primary"
                >
                  <RadioGroupItem id={`complete-${option.value}`} value={option.value} className="mt-0.5" />
                  <span className="space-y-0.5">
                    <span className="block text-sm font-medium">{t(option.labelKey)}</span>
                    <span className="block text-xs text-muted-foreground">{t(option.hintKey)}</span>
                  </span>
                </Label>
              ))}
            </RadioGroup>

            {mode === 'actualEnd' && (
              <div className="space-y-1.5">
                <Label className="text-sm">{t('services.complete.actualEndLabel')}</Label>
                <Input type="datetime-local" value={actualEndAt} onChange={(e) => setActualEndAt(e.target.value)} />
              </div>
            )}
            {mode === 'extraMinutes' && (
              <div className="space-y-1.5">
                <Label className="text-sm">{t('services.complete.extraMinutesLabel')}</Label>
                <Input
                  type="number" min={1} placeholder={t('services.complete.extraMinutesPlaceholder')}
                  value={additionalMinutes} onChange={(e) => setAdditionalMinutes(e.target.value)}
                />
              </div>
            )}
            {mode === 'fixedPrice' && (
              <div className="space-y-1.5">
                <Label className="text-sm">{t('services.complete.fixedPriceLabel', { currency })}</Label>
                <Input
                  type="number" min={0} step="0.01" placeholder="0.00"
                  value={fixedPrice} onChange={(e) => setFixedPrice(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">{t('services.complete.fixedPriceHelp')}</p>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                {t('common.actions.cancel')}
              </Button>
              <Button onClick={handleSubmit} disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('services.complete.submit')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? 'text-xs text-muted-foreground' : 'text-muted-foreground'}>{label}</span>
      <span className={strong ? 'font-semibold' : muted ? 'text-xs text-muted-foreground' : ''}>{value}</span>
    </div>
  );
}
