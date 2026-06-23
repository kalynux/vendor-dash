import { useEffect, useRef, useState } from 'react';
import {
  Loader2,
  Smartphone,
  CreditCard,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type {
  PaymentChannel,
  PaymentGateway,
  PaymentInitResult,
  PaymentStatus,
  PhoneOperator,
} from '@/types/billing.types';
import type { SavedPaymentMethod } from '@/types/payment-method.types';
import { isStripeConfigured } from '@/lib/stripe';
import { fetchPaymentMethods } from '@/services/payment-methods.service';
import { StripeCardField, type StripeCardFieldHandle } from './StripeCardField';
import { CardPreview } from './CardPreview';
import {
  PHONE_OPERATORS,
  GATEWAYS,
  PAYMENT_POLL_INTERVAL_MS,
  PAYMENT_POLL_TIMEOUT_MS,
  billingErrorMessage,
  formatMoney,
} from './billing.constants';

type Phase = 'form' | 'processing' | 'success' | 'failed' | 'timeout';

export interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Short line describing what's being bought, e.g. "Growth plan" or "5,000 credits". */
  summary: string;
  amount: number;
  currency: string;
  /** Initiate the gateway payment. Returns the normalised init result. */
  initiate: (gateway: PaymentGateway, channel: PaymentChannel) => Promise<PaymentInitResult>;
  /** Poll a pending payment; resolves with its current status. */
  verify: (id: string) => Promise<{ status: PaymentStatus }>;
  /** Called once the payment is confirmed paid (refresh balances/plan). */
  onPaid: () => void;
  successLabel?: string;
}

const PHONE_RE = /^\+?\d{8,15}$/;

/** Gateways selectable in the checkout (Stripe hidden when not configured). */
function availableGateways() {
  return GATEWAYS.filter((g) => g.methodType !== 'card' || isStripeConfigured);
}

/** Map a saved method's provider to the gateway used to charge it. */
function providerToGateway(provider: string): PaymentGateway | null {
  switch (provider.toLowerCase()) {
    case 'stripe':
      return 'STRIPE';
    case 'notchpay':
      return 'NOTCHPAY';
    case 'mycoolpay':
      return 'MYCOOLPAY';
    default:
      return null;
  }
}

/** Map a saved mobile-money brand to a known operator, if it matches. */
function brandToOperator(brand: string | null): PhoneOperator | null {
  const b = (brand ?? '').toUpperCase();
  if (b.includes('MTN')) return 'MTN';
  if (b.includes('ORANGE')) return 'ORANGE';
  if (b.includes('MOOV')) return 'MOOV';
  return null;
}

export function PaymentDialog({
  open,
  onOpenChange,
  title,
  summary,
  amount,
  currency,
  initiate,
  verify,
  onPaid,
  successLabel = 'Payment confirmed',
}: PaymentDialogProps) {
  const gateways = availableGateways();

  const [gateway, setGateway] = useState<PaymentGateway>(gateways[0]?.value ?? 'NOTCHPAY');
  const [phone, setPhone] = useState('');
  const [operator, setOperator] = useState<PhoneOperator>('MTN');
  const [holderName, setHolderName] = useState('');
  const [phase, setPhase] = useState<Phase>('form');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [instructionMsg, setInstructionMsg] = useState<string | null>(null);
  const [ussd, setUssd] = useState<string | null>(null);

  // Saved methods power the quick-select chip row + autofill.
  const [savedMethods, setSavedMethods] = useState<SavedPaymentMethod[]>([]);
  const [selectedSavedId, setSelectedSavedId] = useState<string | null>(null);

  const cardRef = useRef<StripeCardFieldHandle>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollDeadline = useRef<number>(0);

  const methodType = gateways.find((g) => g.value === gateway)?.methodType ?? 'mobile_money';
  const selectedSaved = savedMethods.find((m) => m.id === selectedSavedId) ?? null;

  // Reset everything when the dialog is (re)opened or closed.
  useEffect(() => {
    if (open) {
      setGateway(gateways[0]?.value ?? 'NOTCHPAY');
      setPhone('');
      setOperator('MTN');
      setHolderName('');
      setPhase('form');
      setSubmitting(false);
      setFormError(null);
      setInstructionMsg(null);
      setUssd(null);
      setSelectedSavedId(null);
    }
    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Load saved methods for the quick-select row (best-effort — autofill only).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const methods = await fetchPaymentMethods();
        if (!cancelled) setSavedMethods(methods);
      } catch {
        if (!cancelled) setSavedMethods([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  function stopPolling() {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }

  function startPolling(id: string) {
    pollDeadline.current = Date.now() + PAYMENT_POLL_TIMEOUT_MS;
    stopPolling();
    pollTimer.current = setInterval(async () => {
      if (Date.now() > pollDeadline.current) {
        stopPolling();
        setPhase('timeout');
        return;
      }
      try {
        const { status } = await verify(id);
        if (status === 'paid') {
          stopPolling();
          setPhase('success');
          onPaid();
          toast.success(successLabel);
        } else if (status === 'failed') {
          stopPolling();
          setPhase('failed');
        }
        // still pending → keep polling
      } catch {
        // transient verify error (e.g. not yet registered at gateway) — keep polling
      }
    }, PAYMENT_POLL_INTERVAL_MS);
  }

  /** Quick-select a saved method: switch gateway + prefill what we can. */
  function selectSaved(method: SavedPaymentMethod) {
    setSelectedSavedId(method.id);
    setFormError(null);
    const gw = providerToGateway(method.provider);
    if (gw && gateways.some((g) => g.value === gw)) setGateway(gw);
    if (method.holder_name) setHolderName(method.holder_name);
    if (method.method_type === 'mobile_money') {
      const op = brandToOperator(method.brand);
      if (op) setOperator(op);
    }
  }

  function clearSaved() {
    setSelectedSavedId(null);
    setHolderName('');
    setPhone('');
  }

  async function handleSubmit() {
    setFormError(null);

    let channel: PaymentChannel;

    if (methodType === 'mobile_money') {
      if (!PHONE_RE.test(phone.trim())) {
        setFormError('Enter a valid phone number (e.g. +237650000000).');
        return;
      }
      channel = { phoneNumber: phone.trim(), phoneOperator: operator };
    } else {
      setSubmitting(true);
      try {
        const cardToken = await cardRef.current!.createToken();
        channel = { cardToken };
        if (holderName.trim()) channel.customerName = holderName.trim();
      } catch (err) {
        setSubmitting(false);
        setFormError(err instanceof Error ? err.message : 'Could not validate the card.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const result = await initiate(gateway, channel);
      if (result.status === 'paid') {
        setPhase('success');
        onPaid();
        toast.success(successLabel);
        return;
      }
      if (result.status === 'failed') {
        setPhase('failed');
        return;
      }
      // pending → show instructions and poll
      setUssd(result.instructions?.ussdCode ?? null);
      setInstructionMsg(
        result.instructions?.message ??
          (methodType === 'mobile_money'
            ? 'Confirm the payment prompt on your phone.'
            : 'Completing the card payment…'),
      );
      setPhase('processing');
      startPolling(result.id);
    } catch (err) {
      setFormError(billingErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose(next: boolean) {
    if (!next) stopPolling();
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {summary} ·{' '}
            <span className="font-medium text-foreground">{formatMoney(amount, currency)}</span>
          </DialogDescription>
        </DialogHeader>

        {phase === 'form' && (
          <div className="space-y-4">
            {/* Saved-method quick-select row */}
            {savedMethods.length > 0 && (
              <div className="space-y-1.5">
                <Label>Payment method</Label>
                <div className="flex flex-wrap gap-2">
                  {savedMethods.map((m) => (
                    <SavedChip
                      key={m.id}
                      method={m}
                      active={selectedSavedId === m.id}
                      onClick={() => selectSaved(m)}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={clearSaved}
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition',
                      !selectedSavedId
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border text-muted-foreground hover:bg-muted',
                    )}
                  >
                    <Plus className="h-4 w-4" /> New
                  </button>
                </div>
              </div>
            )}

            {/* Gateway-first selection */}
            <div className="space-y-1.5">
              <Label>Pay with</Label>
              <div className="grid grid-cols-3 gap-2">
                {gateways.map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => {
                      setGateway(g.value);
                      setFormError(null);
                    }}
                    className={cn(
                      'flex flex-col items-center justify-center gap-1 rounded-md border px-2 py-2.5 text-xs font-medium transition',
                      gateway === g.value
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border text-muted-foreground hover:bg-muted',
                    )}
                  >
                    {g.methodType === 'card' ? (
                      <CreditCard className="h-4 w-4" />
                    ) : (
                      <Smartphone className="h-4 w-4" />
                    )}
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            {methodType === 'mobile_money' ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pay-phone">Mobile money number</Label>
                  <Input
                    id="pay-phone"
                    inputMode="tel"
                    placeholder="+237650000000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    aria-invalid={!!formError}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pay-operator">Operator</Label>
                  <Select value={operator} onValueChange={(v) => setOperator(v as PhoneOperator)}>
                    <SelectTrigger id="pay-operator">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PHONE_OPERATORS.map((op) => (
                        <SelectItem key={op.value} value={op.value}>
                          {op.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <CardPreview
                  brand={selectedSaved?.brand}
                  last4={selectedSaved?.last4}
                  holderName={holderName}
                  expMonth={selectedSaved?.exp_month}
                  expYear={selectedSaved?.exp_year}
                />
                <div className="space-y-1.5">
                  <Label htmlFor="pay-holder">Card holder name</Label>
                  <Input
                    id="pay-holder"
                    placeholder="Name on card"
                    value={holderName}
                    onChange={(e) => setHolderName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Card details</Label>
                  <StripeCardField ref={cardRef} disabled={submitting} />
                  {selectedSaved && (
                    <p className="text-xs text-muted-foreground">
                      Re-enter your card details to confirm this payment.
                    </p>
                  )}
                </div>
              </div>
            )}

            {formError && <p className="text-sm text-destructive">{formError}</p>}

            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm Payment · {formatMoney(amount, currency)}
              </Button>
            </DialogFooter>
          </div>
        )}

        {phase === 'processing' && (
          <div className="space-y-4 py-2 text-center">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
            <div className="space-y-1">
              <p className="font-medium">Waiting for payment…</p>
              {instructionMsg && <p className="text-sm text-muted-foreground">{instructionMsg}</p>}
              {ussd && (
                <p className="text-sm">
                  Dial <span className="font-mono font-semibold">{ussd}</span> to approve.
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              This can take up to a couple of minutes. Keep this window open.
            </p>
            <Button variant="ghost" size="sm" onClick={() => handleClose(false)}>
              Close (we'll keep processing)
            </Button>
          </div>
        )}

        {phase === 'success' && (
          <ResultState
            icon={<CheckCircle2 className="mx-auto h-10 w-10 text-green-600" />}
            title={successLabel}
            description="Your account has been updated."
            action={<Button onClick={() => handleClose(false)}>Done</Button>}
          />
        )}

        {phase === 'failed' && (
          <ResultState
            icon={<XCircle className="mx-auto h-10 w-10 text-destructive" />}
            title="Payment failed"
            description="The payment was not completed. No charge was made — you can try again."
            action={
              <>
                <Button variant="outline" onClick={() => handleClose(false)}>
                  Close
                </Button>
                <Button onClick={() => setPhase('form')}>Try again</Button>
              </>
            }
          />
        )}

        {phase === 'timeout' && (
          <ResultState
            icon={<Clock className="mx-auto h-10 w-10 text-amber-500" />}
            title="Still processing"
            description="We couldn't confirm the payment in time. If you completed it, your balance will update shortly — check your history."
            action={
              <>
                <Button variant="outline" onClick={() => handleClose(false)}>
                  Close
                </Button>
                <Button onClick={() => setPhase('form')}>Start over</Button>
              </>
            }
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function SavedChip({
  method,
  active,
  onClick,
}: {
  method: SavedPaymentMethod;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition',
        active
          ? 'border-primary bg-primary/5 text-primary'
          : 'border-border text-muted-foreground hover:bg-muted',
      )}
      title={method.display_label}
    >
      {method.method_type === 'card' ? (
        <CreditCard className="h-4 w-4" />
      ) : (
        <Smartphone className="h-4 w-4" />
      )}
      <span className="max-w-[8rem] truncate">{method.display_label}</span>
    </button>
  );
}

function ResultState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <div className="space-y-4 py-2 text-center">
      {icon}
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex justify-center gap-2">{action}</div>
    </div>
  );
}
