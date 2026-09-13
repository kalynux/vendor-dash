import { useEffect, useRef, useState } from 'react';
import {
  Loader2,
  Smartphone,
  CreditCard,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  Info,
  ArrowLeft,
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
import { isValidPhone, toE164 } from '@/lib/phone';
import { isValidEmail, normalizeEmail } from '@/lib/email';
import { PhoneInput } from '@/components/phone';
import {
  MobileMoneyBrandPicker,
  PaymentBrandLogo,
  PaymentOptionCard,
  PaymentOptionGroup,
  PaymentOptionIcon,
  brandForSavedMethod,
  matchMobileMoneyBrand,
  mobileMoneyBrandById,
  type MobileMoneyBrandId,
} from '@/components/payment-methods';
import { useTranslation, useFormatters, useApiError, type TranslationKey } from '@/i18n';
import type {
  PaymentAuthorizeResult,
  PaymentChannel,
  PaymentGateway,
  PaymentInitResult,
  PaymentStatus,
} from '@/types/billing.types';
import type { SavedPaymentMethod } from '@/types/payment-method.types';
import { isStripeConfigured } from '@/lib/stripe';
import { fetchPaymentMethods } from '@/services/payment-methods.service';
import { StripePaymentElement, type StripePaymentElementHandle } from './StripePaymentElement';
import { CardPreview } from './CardPreview';
import {
  CARD_GATEWAY,
  GATEWAYS,
  MOBILE_MONEY_GATEWAY,
  MOBILE_MONEY_GATEWAYS,
  OTP_CODE_MAX_LENGTH,
  PAYMENT_POLL_INTERVAL_MS,
  PAYMENT_POLL_TIMEOUT_MS,
  formatCharged,
  isOtpAttemptsExceeded,
  isOtpReconcileError,
  isValidOtpCode,
  otpAttemptsRemaining,
  requiresOtpStep,
  saveStripeResume,
  clearStripeResume,
  type StripeResumeKind,
} from './billing.constants';

type Phase = 'form' | 'card' | 'otp' | 'processing' | 'success' | 'failed' | 'timeout';

/** Stripe init details carried from `form` into the `card` (Payment Element) phase. */
interface StripeInit {
  id: string;
  clientSecret: string;
  chargedAmount?: number;
  chargedCurrency?: string;
}

export interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Short line describing what's being bought, e.g. "Growth plan" or "5,000 credits". */
  summary: string;
  amount: number;
  currency: string;
  /** Which flow this is — drives the Stripe 3-D Secure resume marker. */
  paymentKind: StripeResumeKind;
  /** Initiate the gateway payment. Returns the normalised init result. */
  initiate: (gateway: PaymentGateway, channel: PaymentChannel) => Promise<PaymentInitResult>;
  /**
   * Relay the SMS code for a payment whose `initiate` answered `requiresOtp`
   * with no `ussdCode` — My-CoolPay + Orange Money, the one gateway/operator
   * pair with an OTP step. Required rather than optional: the plan and top-up
   * flows each have their own `/authorize` route, and a caller that quietly
   * omitted one would leave that flow's Orange Money payments unable to
   * complete at all — which is the bug this step exists to fix.
   */
  authorize: (id: string, code: string) => Promise<PaymentAuthorizeResult>;
  /** Poll a pending payment; resolves with its current status. */
  verify: (id: string) => Promise<{ status: PaymentStatus }>;
  /** Called once the payment is confirmed paid (refresh balances/plan). */
  onPaid: () => void;
  /** Success toast + result heading. Defaults to a generic confirmation. */
  successLabelKey?: TranslationKey;
}


/** The two top-level choices. Card only appears when Stripe is configured. */
type MethodCategory = 'card' | 'mobile_money';

/** Wallet pre-selected when the dialog opens — the largest operator in our markets. */
const DEFAULT_BRAND: MobileMoneyBrandId = 'mtn';

/** Map a saved mobile-money method's provider to the gateway that can charge it. */
function providerToMobileMoneyGateway(provider: string): PaymentGateway | null {
  const match = MOBILE_MONEY_GATEWAYS.find((g) => g.value.toLowerCase() === provider.toLowerCase());
  return match?.value ?? null;
}

/** The currency a gateway actually settles in — XAF for wallets, USD for cards. */
function chargeCurrencyOf(gateway: PaymentGateway): string | undefined {
  return GATEWAYS.find((g) => g.value === gateway)?.chargeCurrency;
}

export function PaymentDialog({
  open,
  onOpenChange,
  title,
  summary,
  amount,
  currency,
  paymentKind,
  initiate,
  authorize,
  verify,
  onPaid,
  successLabelKey = 'billing.checkout.successTitle',
}: PaymentDialogProps) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const apiError = useApiError();
  const successLabel = t(successLabelKey);

  const [category, setCategory] = useState<MethodCategory>(
    isStripeConfigured ? 'card' : 'mobile_money',
  );
  const [brandId, setBrandId] = useState<MobileMoneyBrandId>(DEFAULT_BRAND);
  const [mobileGateway, setMobileGateway] = useState<PaymentGateway>(MOBILE_MONEY_GATEWAY);
  const [phone, setPhone] = useState('');
  const [holderName, setHolderName] = useState('');
  const [email, setEmail] = useState('');
  const [phase, setPhase] = useState<Phase>('form');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [cardError, setCardError] = useState<string | null>(null);
  const [instructionMsg, setInstructionMsg] = useState<string | null>(null);
  const [ussd, setUssd] = useState<string | null>(null);
  const [stripeInit, setStripeInit] = useState<StripeInit | null>(null);
  const [cardReady, setCardReady] = useState(false);

  // The row (`purchase._id` / `topup._id`) that the OTP relay and the verify
  // poll both address. There is no second id to track — the initiating call is
  // the only thing that mints one.
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpAttemptsLeft, setOtpAttemptsLeft] = useState<number | null>(null);
  // Set only when too many wrong codes burned the row: the backend has already
  // marked it `failed`, so the failed state has to send the vendor into a NEW
  // purchase rather than offer a retry of this one.
  const [failedReason, setFailedReason] = useState<string | null>(null);

  // Saved methods power the quick-select chip row + autofill.
  const [savedMethods, setSavedMethods] = useState<SavedPaymentMethod[]>([]);
  const [selectedSavedId, setSelectedSavedId] = useState<string | null>(null);

  const cardRef = useRef<StripePaymentElementHandle>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollDeadline = useRef<number>(0);

  const isStripe = category === 'card';
  const brand = mobileMoneyBrandById(brandId);
  /** The gateway the initiate call will actually use. */
  const gateway = isStripe ? CARD_GATEWAY : mobileGateway;

  // Reset everything when the dialog is (re)opened or closed.
  useEffect(() => {
    if (open) {
      setCategory(isStripeConfigured ? 'card' : 'mobile_money');
      setBrandId(DEFAULT_BRAND);
      setMobileGateway(MOBILE_MONEY_GATEWAY);
      setPhone('');
      setHolderName('');
      setEmail('');
      setPhase('form');
      setSubmitting(false);
      setFormError(null);
      setCardError(null);
      setInstructionMsg(null);
      setUssd(null);
      setStripeInit(null);
      setCardReady(false);
      setSelectedSavedId(null);
      setPaymentId(null);
      setOtpCode('');
      setOtpError(null);
      setOtpAttemptsLeft(null);
      setFailedReason(null);
    }
    return stopPolling;
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
        } else if (status === 'failed' || status === 'reversed') {
          stopPolling();
          setPhase('failed');
        }
        // still pending → keep polling
      } catch {
        // transient verify error (e.g. not yet registered at gateway) — keep polling
      }
    }, PAYMENT_POLL_INTERVAL_MS);
  }

  /** Quick-select a saved method: switch category + prefill what we can. */
  function selectSaved(method: SavedPaymentMethod) {
    setSelectedSavedId(method.id);
    setFormError(null);
    if (method.holder_name) setHolderName(method.holder_name);

    if (method.method_type === 'card') {
      if (isStripeConfigured) setCategory('card');
      return;
    }
    setCategory('mobile_money');
    const gw = providerToMobileMoneyGateway(method.provider);
    if (gw) setMobileGateway(gw);
    // Only wallets a gateway can debit are offered, so a saved Airtel/Wave
    // method (payout-only) leaves the current pick alone rather than selecting
    // a brand the picker would then refuse.
    const saved = matchMobileMoneyBrand(method.brand);
    if (saved?.chargeOperator) setBrandId(saved.id);
  }

  function clearSaved() {
    setSelectedSavedId(null);
    setHolderName('');
    setPhone('');
  }

  /** Build the `channel` for the chosen gateway. Returns null + sets formError on bad input. */
  function buildChannel(): PaymentChannel | null {
    if (isStripe) {
      // Stripe collects the card client-side — send only identification fields.
      if (email.trim() && !isValidEmail(email)) {
        setFormError(t('billing.validation.email'));
        return null;
      }
      const channel: PaymentChannel = {};
      if (email.trim()) channel.customerEmail = normalizeEmail(email);
      if (holderName.trim()) channel.customerName = holderName.trim();
      return channel;
    }
    // Mobile money — phone + operator are required. The gateway is given E.164.
    // The picker only offers debitable wallets, so this guard is belt-and-braces
    // against a future brand landing in state before its gateway support does.
    if (!brand?.chargeOperator) {
      setFormError(t('payments.providers.soonHint', { brand: brand?.name ?? '' }));
      return null;
    }
    const phoneNumber = toE164(phone);
    if (!phoneNumber) {
      setFormError(t('common.validation.phone'));
      return null;
    }
    return { phoneNumber, phoneOperator: brand.chargeOperator };
  }

  /** Step 1: initiate the payment server-side. */
  async function handleInitiate() {
    setFormError(null);
    const channel = buildChannel();
    if (!channel) return;

    setSubmitting(true);
    try {
      const result = await initiate(gateway, channel);

      if (result.status === 'paid') {
        setPhase('success');
        onPaid();
        toast.success(successLabel);
        return;
      }
      if (result.status === 'failed' || result.status === 'reversed') {
        setPhase('failed');
        return;
      }

      // Pending. Hold the row id for whatever comes next — the OTP relay, the
      // verify poll, or both.
      setPaymentId(result.id);

      // For Stripe, mount the Payment Element and confirm the card next.
      if (isStripe && result.instructions?.clientSecret) {
        setStripeInit({
          id: result.id,
          clientSecret: result.instructions.clientSecret,
          chargedAmount: result.instructions.chargedAmount,
          chargedCurrency: result.instructions.chargedCurrency,
        });
        setCardError(null);
        setCardReady(false);
        setPhase('card');
        return;
      }

      // My-CoolPay + Orange Money: the buyer has been SMSed a one-time code and
      // NOTHING has been charged — the gateway sits idle until that code comes
      // back. There is nothing to poll for yet, so collect it first.
      if (requiresOtpStep(result.instructions)) {
        setOtpCode('');
        setOtpError(null);
        setOtpAttemptsLeft(null);
        setInstructionMsg(result.instructions?.message ?? null);
        setPhase('otp');
        return;
      }

      // Mobile money (or a gateway that already confirmed): show instructions + poll.
      setUssd(result.instructions?.ussdCode ?? null);
      setInstructionMsg(
        result.instructions?.message ?? t('billing.checkout.phonePrompt'),
      );
      setPhase('processing');
      startPolling(result.id);
    } catch (err) {
      setFormError(
        apiError.resolve(err, { context: 'billing', fallbackKey: 'billing.errors.paymentFailed' }),
      );
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * Step 2 (My-CoolPay + Orange Money only): relay the SMS code, then poll.
   *
   * 🔴 **A 200 here is not a payment.** The row comes back still `pending`, and
   * that is correct — the code only authorises the charge, and the buyer has
   * still to confirm it on the handset. So this drops straight into the same
   * verify poll every other branch uses: no success state, no `onPaid()`, no
   * wallet or plan refresh. The gateway callback or the poll settles it.
   */
  async function handleAuthorize() {
    if (!paymentId) return;
    const code = otpCode.trim();
    if (!isValidOtpCode(code)) {
      setOtpError(t('billing.validation.otpCode'));
      return;
    }

    setOtpError(null);
    setSubmitting(true);
    try {
      const result = await authorize(paymentId, code);
      // `result.status` is deliberately not branched on. It is `pending` by
      // contract, and even a surprising terminal value is better read off the
      // poll below than acted on here — that keeps ONE place in this dialog that
      // can declare a payment settled.
      //
      // The authorize response is also where the USSD prompt finally appears on
      // this branch: the initiating call had none to give.
      setUssd(result.instructions?.ussdCode ?? null);
      setInstructionMsg(result.instructions?.message ?? t('billing.checkout.phonePrompt'));
      setPhase('processing');
      startPolling(paymentId);
    } catch (err) {
      if (isOtpAttemptsExceeded(err)) {
        // Out of attempts — the backend has already failed the row. Another code
        // against it could only ever conflict, so the one way on is a new purchase.
        setFailedReason(t('billing.checkout.otpAttemptsExceeded'));
        setPhase('failed');
        return;
      }
      if (isOtpReconcileError(err)) {
        // This row is not waiting on a code: already settled, not yet charged, or
        // a gateway with no OTP step at all. Reconcile with the idempotent verify
        // poll rather than resubmit — a second accepted code is a second charge.
        setUssd(null);
        setInstructionMsg(t('billing.checkout.otpReconciling'));
        setPhase('processing');
        startPolling(paymentId);
        return;
      }
      // Wrong code (or anything else): stay put and let them try again. Clearing
      // the field is deliberate — the next code is a fresh one, not an edit.
      setOtpAttemptsLeft(otpAttemptsRemaining(err));
      setOtpError(
        apiError.resolve(err, { context: 'billing', fallbackKey: 'billing.errors.paymentFailed' }),
      );
      setOtpCode('');
    } finally {
      setSubmitting(false);
    }
  }

  /** Step 2 (Stripe only): confirm the card via the Payment Element, then poll. */
  async function handleCardConfirm() {
    if (!stripeInit) return;
    setCardError(null);
    setSubmitting(true);

    // Persist a resume marker BEFORE confirming: if 3-D Secure forces a full-page
    // redirect, the verify-on-return picks the payment back up. (The webhook is the
    // authoritative finalizer regardless.)
    saveStripeResume(paymentKind, stripeInit.id);

    try {
      const returnUrl = window.location.href;
      const outcome = await cardRef.current!.confirm(returnUrl);

      if (outcome.status === 'redirecting') {
        // Stripe is navigating to the bank — leave the marker, the page will unload.
        setInstructionMsg(t('billing.checkout.redirectingToBank'));
        return;
      }

      // Confirmed in-page (succeeded / processing) — finalize via the verify poll.
      clearStripeResume();
      setInstructionMsg(
        outcome.status === 'succeeded'
          ? t('billing.checkout.cardConfirmed')
          : t('billing.checkout.confirmingPayment'),
      );
      setPhase('processing');
      startPolling(stripeInit.id);
    } catch (err) {
      clearStripeResume();
      // Stripe's own decline text is already localized by Stripe.js and is more
      // specific than anything we could substitute, so it is surfaced as-is.
      setCardError(err instanceof Error ? err.message : t('billing.cardForm.failed'));
      setSubmitting(false);
    }
  }

  function backToForm() {
    setStripeInit(null);
    setCardError(null);
    setCardReady(false);
    setSubmitting(false);
    // A burned or abandoned row is never reused: going back to the form means
    // the next Confirm initiates a fresh purchase, which is exactly what an
    // attempts-exceeded failure requires.
    setPaymentId(null);
    setOtpCode('');
    setOtpError(null);
    setOtpAttemptsLeft(null);
    setFailedReason(null);
    setPhase('form');
  }

  function handleClose(next: boolean) {
    if (!next) stopPolling();
    onOpenChange(next);
  }

  const chargedLine =
    stripeInit?.chargedAmount != null
      ? formatCharged(stripeInit.chargedAmount, stripeInit.chargedCurrency, fmt.currency)
      : null;
  const amountLine = fmt.currency(amount, currency);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {summary} · <span className="font-medium text-foreground">{amountLine}</span>
          </DialogDescription>
        </DialogHeader>

        {phase === 'form' && (
          <div className="space-y-5">
            {/* Saved-method quick-select row */}
            {savedMethods.length > 0 && (
              <div className="space-y-1.5">
                <Label>{t('billing.checkout.savedMethods')}</Label>
                {/* Horizontally scrollable rather than wrapped: ten saved methods
                    would otherwise push the actual form off a phone screen. */}
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
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
                    aria-pressed={!selectedSavedId}
                    className={cn(
                      'tap-target flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition',
                      'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                      !selectedSavedId
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border text-muted-foreground hover:bg-muted',
                    )}
                  >
                    <Plus className="h-4 w-4" /> {t('billing.checkout.newMethod')}
                  </button>
                </div>
              </div>
            )}

            {/* Category first: the vendor picks a way to pay, not a gateway name. */}
            <div className="space-y-2">
              <Label id="pay-category-label" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('billing.checkout.payWith')}
              </Label>
              <PaymentOptionGroup
                aria-labelledby="pay-category-label"
                value={category}
                onValueChange={(v) => {
                  setCategory(v as MethodCategory);
                  setFormError(null);
                }}
                disabled={submitting}
                // Two abreast so the whole choice is one glance; a lone card (no
                // Stripe key) keeps the full width rather than sitting half-empty.
                className={isStripeConfigured ? 'grid-cols-2' : undefined}
              >
                {isStripeConfigured && (
                  <PaymentOptionCard
                    value="card"
                    orientation="stacked"
                    visual={<PaymentOptionIcon icon={CreditCard} />}
                    title={t('payments.category.card.title')}
                    description={t('payments.category.card.provider')}
                    badge={<CurrencyPill code={chargeCurrencyOf(CARD_GATEWAY)} />}
                  />
                )}
                <PaymentOptionCard
                  value="mobile_money"
                  orientation="stacked"
                  visual={<PaymentOptionIcon icon={Smartphone} />}
                  title={t('payments.category.mobileMoney.title')}
                  description={t('payments.category.mobileMoney.payFrom')}
                  badge={<CurrencyPill code={chargeCurrencyOf(mobileGateway)} />}
                />
              </PaymentOptionGroup>
            </div>

            {!isStripe ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label id="pay-provider-label">{t('payments.providers.label')}</Label>
                  <MobileMoneyBrandPicker
                    aria-labelledby="pay-provider-label"
                    value={brandId}
                    onChange={setBrandId}
                    chargeableOnly
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pay-phone">{t('billing.checkout.phone')}</Label>
                  <PhoneInput
                    id="pay-phone"
                    value={phone}
                    onChange={setPhone}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pay-gateway">{t('billing.methods.processedBy')}</Label>
                  <Select
                    value={mobileGateway}
                    onValueChange={(v) => setMobileGateway(v as PaymentGateway)}
                    disabled={submitting}
                  >
                    <SelectTrigger id="pay-gateway">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MOBILE_MONEY_GATEWAYS.map((g) => (
                        <SelectItem key={g.value} value={g.value}>
                          {t(g.labelKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Card payments are charged in USD — make that explicit up front. */}
                <div className="flex gap-2 rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 text-xs text-muted-foreground">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                  <span>{t('billing.checkout.usdNotice')}</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="pay-name">{t('billing.checkout.nameOnCard')}</Label>
                    <Input
                      id="pay-name"
                      placeholder={t('billing.checkout.nameOnCardPlaceholder')}
                      value={holderName}
                      onChange={(e) => setHolderName(e.target.value)}
                      disabled={submitting}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pay-email">{t('billing.checkout.receiptEmail')}</Label>
                    <Input
                      id="pay-email"
                      type="email"
                      inputMode="email"
                      placeholder={t('billing.checkout.receiptEmailPlaceholder')}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      aria-invalid={!!formError}
                      disabled={submitting}
                    />
                  </div>
                </div>
              </div>
            )}

            {formError && (
              <p className="text-sm text-destructive" role="alert">
                {formError}
              </p>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => handleClose(false)}
                disabled={submitting}
                className="max-sm:w-full"
              >
                {t('common.actions.cancel')}
              </Button>
              <Button
                onClick={handleInitiate}
                // An incomplete mobile-money number can't be charged — don't let
                // it reach the gateway.
                disabled={
                  submitting || (!isStripe && (!isValidPhone(phone) || !brand?.chargeOperator))
                }
                className="max-sm:w-full"
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isStripe
                  ? t('billing.checkout.continueToCard')
                  : t('billing.checkout.confirmPayment', { amount: amountLine })}
              </Button>
            </DialogFooter>
          </div>
        )}

        {phase === 'card' && stripeInit && (
          <div className="space-y-4">
            <CardPreview holderName={holderName} />

            {/* The exact USD charge from the server — never computed on the frontend. */}
            <div className="rounded-lg border bg-muted/30 p-3 text-center">
              {chargedLine ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    {t('billing.checkout.willBeCharged')}
                  </p>
                  <p className="text-2xl font-bold">{chargedLine}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('billing.checkout.forSummary', { summary, amount: amountLine })}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t('billing.checkout.completingFor', { summary, amount: amountLine })}
                </p>
              )}
            </div>

            <div className="flex gap-2 rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
              <span>{t('billing.checkout.usdNoticeShort')}</span>
            </div>

            <div className="space-y-1.5">
              <Label>{t('billing.checkout.cardDetails')}</Label>
              <StripePaymentElement
                ref={cardRef}
                clientSecret={stripeInit.clientSecret}
                disabled={submitting}
                onReady={() => setCardReady(true)}
              />
            </div>

            {cardError && <p className="text-sm text-destructive">{cardError}</p>}

            <DialogFooter>
              <Button variant="outline" onClick={backToForm} disabled={submitting}>
                <ArrowLeft className="mr-1 h-4 w-4" /> {t('common.actions.back')}
              </Button>
              <Button onClick={handleCardConfirm} disabled={submitting || !cardReady}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {chargedLine
                  ? t('billing.checkout.pay', { amount: chargedLine })
                  : t('billing.checkout.payNow')}
              </Button>
            </DialogFooter>
          </div>
        )}

        {phase === 'otp' && (
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="font-medium">{t('billing.checkout.otpTitle')}</p>
              <p className="text-sm text-muted-foreground">
                {instructionMsg ?? t('billing.checkout.otpPrompt')}
              </p>
            </div>

            {/* Nothing has moved yet on this branch. Say so plainly: a vendor who
                loses the SMS otherwise assumes they have already been charged and
                goes looking for a refund rather than starting again. */}
            <div className="flex gap-2 rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
              <span>{t('billing.checkout.otpNoCharge')}</span>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pay-otp">{t('billing.checkout.otpLabel')}</Label>
              <Input
                id="pay-otp"
                value={otpCode}
                onChange={(e) => {
                  // The field only ever holds a code, so non-digits are dropped as
                  // they are typed rather than rejected on submit.
                  setOtpCode(e.target.value.replace(/[^0-9]/g, '').slice(0, OTP_CODE_MAX_LENGTH));
                  setOtpError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' || submitting) return;
                  e.preventDefault();
                  void handleAuthorize();
                }}
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={OTP_CODE_MAX_LENGTH}
                placeholder={t('billing.checkout.otpPlaceholder')}
                aria-invalid={!!otpError}
                aria-describedby={otpError ? 'pay-otp-error' : undefined}
                disabled={submitting}
                className="text-center text-lg tracking-[0.4em]"
              />
            </div>

            {otpError && (
              <p id="pay-otp-error" className="text-sm text-destructive" role="alert">
                {otpError}
                {/* Only when the backend actually said so — an invented number here
                    is worse than none. */}
                {otpAttemptsLeft !== null && (
                  <>{' '}{t('billing.checkout.otpAttemptsLeft', { count: otpAttemptsLeft })}</>
                )}
              </p>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => handleClose(false)}
                disabled={submitting}
                className="max-sm:w-full"
              >
                {t('common.actions.cancel')}
              </Button>
              <Button
                onClick={handleAuthorize}
                disabled={submitting || !isValidOtpCode(otpCode)}
                className="max-sm:w-full"
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('billing.checkout.otpSubmit')}
              </Button>
            </DialogFooter>
          </div>
        )}

        {phase === 'processing' && (
          <div className="space-y-4 py-2 text-center">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
            <div className="space-y-1">
              <p className="font-medium">{t('billing.checkout.waiting')}</p>
              {instructionMsg && <p className="text-sm text-muted-foreground">{instructionMsg}</p>}
              {ussd && <p className="text-sm">{t('billing.checkout.dialUssd', { code: ussd })}</p>}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('billing.checkout.keepOpen')}
            </p>
            <Button variant="ghost" size="sm" onClick={() => handleClose(false)}>
              {t('billing.checkout.closeKeepProcessing')}
            </Button>
          </div>
        )}

        {phase === 'success' && (
          <ResultState
            icon={<CheckCircle2 className="mx-auto h-10 w-10 text-green-600" />}
            title={successLabel}
            description={t('billing.checkout.successDescription')}
            action={<Button onClick={() => handleClose(false)}>{t('common.actions.done')}</Button>}
          />
        )}

        {phase === 'failed' && (
          <ResultState
            icon={<XCircle className="mx-auto h-10 w-10 text-destructive" />}
            title={t('billing.checkout.failedTitle')}
            // The default line promises no charge was made and offers a retry.
            // Both are wrong for a row burned by too many wrong codes: that row
            // is `failed` server-side and only a new purchase can go anywhere.
            description={failedReason ?? t('billing.checkout.failedDescription')}
            action={
              <>
                <Button variant="outline" onClick={() => handleClose(false)}>
                  {t('common.actions.close')}
                </Button>
                <Button onClick={backToForm}>
                  {failedReason ? t('billing.checkout.startOver') : t('common.actions.retry')}
                </Button>
              </>
            }
          />
        )}

        {phase === 'timeout' && (
          <ResultState
            icon={<Clock className="mx-auto h-10 w-10 text-amber-500" />}
            title={t('billing.checkout.timeoutTitle')}
            description={t('billing.checkout.timeoutDescription')}
            action={
              <>
                <Button variant="outline" onClick={() => handleClose(false)}>
                  {t('common.actions.close')}
                </Button>
                <Button onClick={backToForm}>{t('billing.checkout.startOver')}</Button>
              </>
            }
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** The currency a choice is actually settled in — codes are never translated. */
function CurrencyPill({ code }: { code?: string }) {
  if (!code) return null;
  return (
    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      {code}
    </span>
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
      aria-pressed={active}
      className={cn(
        'flex shrink-0 items-center gap-2 rounded-lg border py-1.5 pl-1.5 pr-3 text-sm font-medium transition',
        'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        active
          ? 'border-primary bg-primary/5 text-primary'
          : 'border-border text-muted-foreground hover:bg-muted',
      )}
      title={method.display_label}
    >
      {/* The label right next to it already names the brand. */}
      <PaymentBrandLogo brand={brandForSavedMethod(method)} size="sm" decorative />
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
