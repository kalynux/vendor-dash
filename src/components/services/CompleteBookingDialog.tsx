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
import { ApiError } from '@/types/api';
import { completeBooking, BOOKING_ERROR_MAP } from '@/services/services.service';
import { formatMinor } from '@/components/services/service.constants';
import type { Booking, CompleteBookingPayload, CompleteBookingResult } from '@/types/services.types';

type Mode = 'asBooked' | 'actualEnd' | 'extraMinutes' | 'fixedPrice';

const MODES: { value: Mode; label: string; hint: string }[] = [
  { value: 'asBooked', label: 'Settle as booked', hint: 'Charge the originally booked duration.' },
  { value: 'actualEnd', label: 'Actual end time', hint: 'Recompute from when the service really ended.' },
  { value: 'extraMinutes', label: 'Extra minutes', hint: 'Add minutes beyond the booked end.' },
  { value: 'fixedPrice', label: 'Fixed price', hint: 'Charge a flat final amount.' },
];

interface CompleteBookingDialogProps {
  booking: Booking | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful completion so the parent can refresh. */
  onCompleted: () => void;
}

export function CompleteBookingDialog({ booking, open, onOpenChange, onCompleted }: CompleteBookingDialogProps) {
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
      if (!actualEndAt) { toast.error('Pick the actual end time'); return; }
      payload.actualEndAt = new Date(actualEndAt).toISOString();
    } else if (mode === 'extraMinutes') {
      const n = Number(additionalMinutes);
      if (!Number.isFinite(n) || n <= 0) { toast.error('Enter the extra minutes'); return; }
      payload.additionalMinutes = n;
    } else if (mode === 'fixedPrice') {
      const n = Number(fixedPrice);
      if (!Number.isFinite(n) || n < 0) { toast.error('Enter a valid price'); return; }
      payload.fixedPrice = n;
    }
    setBusy(true);
    try {
      const res = await completeBooking(booking._id, payload);
      setResult(res);
      toast.success('Booking completed');
      onCompleted();
    } catch (err) {
      toast.error(err instanceof ApiError ? BOOKING_ERROR_MAP[err.code] ?? err.message : 'Failed to complete');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        {result ? (
          // ── Settlement result ──────────────────────────────────────────
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Booking completed
              </DialogTitle>
              <DialogDescription>The final price has been settled.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2 rounded-lg border p-3 text-sm">
              <Row label="Originally booked" value={formatMinor(result.priceSnapshot, currency)} />
              <Row label="Final price" value={formatMinor(result.finalPrice, currency)} strong />
              {result.breakdown?.peakHoursSurcharge > 0 && (
                <Row
                  label="Incl. peak surcharge"
                  value={formatMinor(result.breakdown.peakHoursSurcharge, currency)}
                  muted
                />
              )}
            </div>
            {result.additionalAmountDue > 0 && (
              <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-500/30 dark:bg-amber-500/10">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-300">
                    {formatMinor(result.additionalAmountDue, currency)} additional due
                  </p>
                  <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
                    The shortfall is recorded on the booking, but automatic collection isn’t enabled
                    yet — arrange the extra payment with the customer directly.
                  </p>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          // ── Settlement form ────────────────────────────────────────────
          <>
            <DialogHeader>
              <DialogTitle>Complete &amp; settle</DialogTitle>
              <DialogDescription>
                Choose how to settle the final price. The amount is recomputed by the system.
              </DialogDescription>
            </DialogHeader>

            <RadioGroup value={mode} onValueChange={(v) => setMode(v as Mode)} className="gap-2">
              {MODES.map((m) => (
                <Label
                  key={m.value}
                  htmlFor={`complete-${m.value}`}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 hover:bg-accent has-[:checked]:border-primary"
                >
                  <RadioGroupItem id={`complete-${m.value}`} value={m.value} className="mt-0.5" />
                  <span className="space-y-0.5">
                    <span className="block text-sm font-medium">{m.label}</span>
                    <span className="block text-xs text-muted-foreground">{m.hint}</span>
                  </span>
                </Label>
              ))}
            </RadioGroup>

            {mode === 'actualEnd' && (
              <div className="space-y-1.5">
                <Label className="text-sm">Actual end time</Label>
                <Input type="datetime-local" value={actualEndAt} onChange={(e) => setActualEndAt(e.target.value)} />
              </div>
            )}
            {mode === 'extraMinutes' && (
              <div className="space-y-1.5">
                <Label className="text-sm">Extra minutes</Label>
                <Input
                  type="number" min={1} placeholder="e.g. 30"
                  value={additionalMinutes} onChange={(e) => setAdditionalMinutes(e.target.value)}
                />
              </div>
            )}
            {mode === 'fixedPrice' && (
              <div className="space-y-1.5">
                <Label className="text-sm">Final price ({currency})</Label>
                <Input
                  type="number" min={0} step="0.01" placeholder="0.00"
                  value={fixedPrice} onChange={(e) => setFixedPrice(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Amount in the smallest currency unit.</p>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Complete booking
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
