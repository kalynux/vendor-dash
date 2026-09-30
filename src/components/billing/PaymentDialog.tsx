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
  mobileMoneyBrandById,
  mobileMoneyBrandByOperator,
  type MobileMoneyBrandId,
} from '@/components/payment-methods';
import { useTranslation, useFormatters, useApiError, type TranslationKey } from '@/i18n';
import type {
  PaymentAuthorizeResult,
  PaymentChannel,
  PaymentInitResult,
  PaymentOption,
  PaymentProvider,
  PaymentStatus,
  PhoneOperator,
} from '@/types/billing.types';
import type { SavedPaymentMethod } from '@/types/payment-method.types';
import { fetchPaymentOptions } from '@/services/billing.service';
import { fetchPaymentMethods } from '@/services/payment-methods.service';
import { StripePaymentElement, type StripePaymentElementHandle } from './StripePaymentElement';
import { CardPreview } from './CardPreview';
import {
  OTP_CODE_MAX_LENGTH,
  PAYMENT_POLL_INTERVAL_MS,
  PAYMENT_POLL_TIMEOUT_MS,
  chargeCurrencyOf,
  formatCharged,
  isOtpAttemptsExceeded,
  isOtpReconcileError,
  isValidOtpCode,
  otpAttemptsRemaining,
  payableSavedWallet,
  providerMismatchDetected,
  requiresOtpStep,
  unavailableProviderOffered,
  saveStripeResume,
  clearStripeResume,
  type StripeResumeKind,
} from './billing.constants';

type Phase = 'form' | 'card' | 'otp' | 'processing' | 'success' | 'failed' | 'timeout';

/** Stripe init details carried from `form` into the `card` (Payment Element) phase. */
interface StripeInit {
  id: string;
  clientSecret: string;
  /** From the card entry of `/options` — Stripe.js is loaded with this key. */
  publishableKey: string;
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
  /**
   * Start the payment on the chosen provider (one `/payments/options` listed).
   * Returns the normalised init result.
   */
  initiate: (provider: PaymentProvider, channel: PaymentChannel) => Promise<PaymentInitResult>;
  /**
   * Relay the SMS code for a payment whose `initiate` answered `requiresOtp`
   * with no `ussdCode`. Required rather than optional: the plan and top-up
   * flows each have their own `/authorize` route, and a caller that quietly
   * omitted one would leave that flow's OTP payments unable to complete at
   * all — which is the bug this step exists to fix.
   */
  authorize: (id: string, code: string) => Promise<PaymentAuthorizeResult>;
  /** Poll a pending payment; resolves with its current status. */
  verify: (id: string) => Promise<{ status: PaymentStatus }>;
  /** Called once the payment is confirmed paid (refresh balances/plan). */
  onPaid: () => void;
  /** Success toast + result heading. Defaults to a generic confirmation. */
  successLabelKey?: TranslationKey;
}


/** The two top-level choices. Card only appears when `/options` lists it. */
type MethodCategory = 'card' | 'mobile_money';

/** The card entry, when the server offers cards (and gave a key to load Stripe with). */
function cardOptionOf(options: PaymentOption[] | null): PaymentOption | undefined {
  return options?.find((o) => o.kind === 'CARD' && !!o.publishableKey);
}

function mobileOptionsOf(options: PaymentOption[] | null): PaymentOption[] {
  return (options ?? []).filter((o) => o.kind === 'MOBILE_MONEY');
}

/** The wallet to pre-select: the first one offered, in the server's order. */
function firstOfferedBrand(options: PaymentOption[]): MobileMoneyBrandId | null {
  for (const o of mobileOptionsOf(options)) {
    const brand = mobileMoneyBrandByOperator(o.provider as PhoneOperator);
    if (brand) return brand.id;
  }
  return null;
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

  // What can be paid with, from `GET /payments/options`. `null` while loading.
  const [options, setOptions] = useState<PaymentOption[] | null>(null);
  const [optionsFailed, setOptionsFailed] = useState(false);
  const [category, setCategory] = useState<MethodCategory>('mobile_money');
  const [brandId, setBrandId] = useState<MobileMoneyBrandId | null>(null);
  const [phone, setPhone] = useState('');
  const [holderName, setHolderName] = useState('');
  const [email, setEmail] = useState('');
  const [phase, setPhase] = useState<Phase>('form');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [cardError, setCardError] = useState<string | null>(null);
  const [instructionMsg, setInstructionMsg] = useState<string | null>(null);
  const [ussd, setUssd] = useState<string | null>(null);
  // Set when the charge answered with a page to finish paying on.
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
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
  // Loaded (or failed to load) for this opening — the default is picked only after.
  const [savedLoaded, setSavedLoaded] = useState(false);
  const autoPicked = useRef(false);

  const cardRef = useRef<StripePaymentElementHandle>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollDeadline = useRef<number>(0);

  const cardOption = cardOptionOf(options);
  const mobileOptions = mobileOptionsOf(options);
  const offeredOperators = mobileOptions.map((o) => o.provider as PhoneOperator);
  const payableMethods = savedMethods.filter((m) => payableSavedWallet(m, offeredOperators));
  const isStripe = category === 'card';
  const brand = mobileMoneyBrandById(brandId);
  /** The `/options` entry the charge will be made on, if the current pick is offered. */
  const selectedOption = isStripe
    ? cardOption
    : mobileOptions.find((o) => o.provider === brand?.chargeOperator);
  const needsPhone = !isStripe && (selectedOption?.fields.includes('phoneNumber') ?? true);

  /**
   * Show a (new) list of ways to pay, keeping the vendor's pick when it is
   * still on offer and falling back to the first offered one when it is not.
   */
  function applyOptions(next: PaymentOption[], preferCard = false) {
    const card = cardOptionOf(next);
    const mobile = mobileOptionsOf(next);
    setOptions(next);
    setCategory((prev) => {
      const want = preferCard ? 'card' : prev;
      if (want === 'card' && card) return 'card';
      return mobile.length > 0 ? 'mobile_money' : card ? 'card' : 'mobile_money';
    });
    setBrandId((prev) => {
      const op = mobileMoneyBrandById(prev)?.chargeOperator;
      if (op && mobile.some((o) => o.provider === op)) return prev;
      return firstOfferedBrand(next);
    });
  }

  async function loadOptions() {
    setOptions(null);
    setOptionsFailed(false);
    try {
      applyOptions(await fetchPaymentOptions(), true);
    } catch {
      setOptionsFailed(true);
    }
  }

  // Reset everything when the dialog is (re)opened or closed, and ask the
  // server afresh what can be paid with — it can change between two openings.
  useEffect(() => {
    if (open) {
      setCategory('mobile_money');
      setBrandId(null);
      void loadOptions();
      setPhone('');
      setHolderName('');
      setEmail('');
      setPhase('form');
      setSubmitting(false);
      setFormError(null);
      setCardError(null);
      setInstructionMsg(null);
      setUssd(null);
      setRedirectUrl(null);
      setStripeInit(null);
      setCardReady(false);
      setSelectedSavedId(null);
      setSavedLoaded(false);
      autoPicked.current = false;
      setPaymentId(null);
      setOtpCode('');
      setOtpError(null);
      setOtpAttemptsLeft(null);
      setFailedReason(null);
    }
    return stopPolling;
    // Runs on open/close only; `loadOptions` reads nothing from render scope.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Load saved methods for the quick-select row (best-effort — autofill only).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      let methods: SavedPaymentMethod[] = [];
      try {
        methods = await fetchPaymentMethods();
      } catch {
        // Autofill only — the form works without them.
      }
      if (!cancelled) {
        setSavedMethods(methods);
        setSavedLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
      // Closing forgets the load, so a reopening waits for fresh lists before
      // picking the default rather than acting on the previous opening's.
      setSavedLoaded(false);
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

  /**
   * Quick-select a saved wallet: switch to mobile money on its network. Only a
   * wallet whose network is on offer right now can be picked — an older card or
   * a row with an unknown network is never used to pre-fill a payment. The
   * server never returns the full number, so the vendor still types it.
   */
  function selectSaved(method: SavedPaymentMethod) {
    const operator = payableSavedWallet(method, offeredOperators);
    if (!operator) return;
    setSelectedSavedId(method.id);
    setFormError(null);
    setCategory('mobile_money');
    const saved = mobileMoneyBrandByOperator(operator);
    if (saved) setBrandId(saved.id);
  }

  function clearSaved() {
    setSelectedSavedId(null);
  }

  // Pre-select the default wallet once per opening, as soon as both lists are
  // in — and only when it can be paid with right now.
  useEffect(() => {
    if (!open || autoPicked.current || options === null || !savedLoaded) return;
    autoPicked.current = true;
    const preferred = savedMethods.find((m) => m.isDefault);
    if (preferred) selectSaved(preferred);
    // `selectSaved` reads the offered list from this same render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, options, savedLoaded]);

  /** Build the `channel` for the chosen provider. Returns null + sets formError on bad input. */
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
    // Mobile money — the provider names the network, so only the fields its
    // `/options` entry lists are sent (today the number, in E.164). The picker
    // only lets an offered wallet be chosen; this guard is belt-and-braces.
    if (!selectedOption) {
      setFormError(t('payments.providers.offlineHint', { brand: brand?.name ?? '' }));
      return null;
    }
    if (!needsPhone) return {};
    const phoneNumber = toE164(phone);
    if (!phoneNumber) {
      setFormError(t('common.validation.phone'));
      return null;
    }
    return { phoneNumber };
  }

  /** How a provider is named on screen: the wallet's brand, or "Card". */
  function providerName(provider: PaymentProvider): string {
    if (provider === 'CARD') return t('payments.category.card.title');
    return mobileMoneyBrandByOperator(provider)?.name ?? provider;
  }

  /**
   * The server refused the charge before writing anything. Returns true when
   * the refusal was one of the two provider ones, which keep the form filled
   * in and say exactly what to change.
   */
  function handleProviderRefusal(err: unknown, provider: PaymentProvider): boolean {
    // The number is on another network than the one picked. Say which, and
    // leave the pick alone — silently switching the vendor's choice is not ok.
    const detected = providerMismatchDetected(err);
    if (detected) {
      setFormError(
        t('billing.checkout.phoneMismatch', {
          detected: providerName(detected),
          chosen: providerName(provider),
        }),
      );
      return true;
    }

    // The pick was switched off after the dialog loaded. `offered` is the
    // fresh list: show only those, and keep everything else as typed.
    const offered = unavailableProviderOffered(err);
    if (offered) {
      const kept = (options ?? []).filter((o) => offered.includes(o.provider));
      applyOptions(kept);
      // `offered` only names providers. One the dialog never had details for
      // (fields, card key) needs a fresh `/options` before it can be shown.
      if (kept.length < offered.length) {
        fetchPaymentOptions()
          .then((fresh) => applyOptions(fresh))
          .catch(() => undefined);
      }
      setFormError(
        offered.length > 0
          ? t('billing.checkout.providerSwitchedOff', { brand: providerName(provider) })
          : t('billing.checkout.providerSwitchedOffAll'),
      );
      return true;
    }
    return false;
  }

  /** Step 1: initiate the payment server-side. */
  async function handleInitiate() {
    setFormError(null);
    const provider = selectedOption?.provider;
    const channel = buildChannel();
    if (!channel || !provider) return;

    setSubmitting(true);
    try {
      const result = await initiate(provider, channel);

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

      // What happens next is read off the answer, never off which company the
      // server used, and never off what `/options` hinted: the server can
      // switch companies between the two calls.

      // An SMS code was sent and NOTHING has been charged — nothing moves
      // until that code comes back. There is nothing to poll for yet, so
      // collect it first.
      if (requiresOtpStep(result.instructions)) {
        setOtpCode('');
        setOtpError(null);
        setOtpAttemptsLeft(null);
        setInstructionMsg(result.instructions?.message ?? null);
        setPhase('otp');
        return;
      }

      // A card: mount the Payment Element and confirm the card next.
      if (result.instructions?.clientSecret) {
        if (!cardOption?.publishableKey) {
          setFormError(t('billing.cardForm.unavailable'));
          return;
        }
        setStripeInit({
          id: result.id,
          clientSecret: result.instructions.clientSecret,
          publishableKey: cardOption.publishableKey,
          chargedAmount: result.instructions.chargedAmount,
          chargedCurrency: result.instructions.chargedCurrency,
        });
        setCardError(null);
        setCardReady(false);
        setPhase('card');
        return;
      }

      // The payment carries on on a separate page. Offer it as a link (a
      // window opened after an await is blocked by most browsers) and poll
      // meanwhile, so coming back to the dialog picks the result up.
      if (result.instructions?.redirectUrl) {
        setRedirectUrl(result.instructions.redirectUrl);
        setUssd(null);
        setInstructionMsg(t('billing.checkout.redirectPrompt'));
        setPhase('processing');
        startPolling(result.id);
        return;
      }

      // Otherwise: approve the prompt on the handset, and poll.
      setUssd(result.instructions?.ussdCode ?? null);
      setInstructionMsg(
        result.instructions?.message ?? t('billing.checkout.phonePrompt'),
      );
      setPhase('processing');
      startPolling(result.id);
    } catch (err) {
      if (handleProviderRefusal(err, provider)) return;
      setFormError(
        apiError.resolve(err, { context: 'billing', fallbackKey: 'billing.errors.paymentFailed' }),
      );
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * Step 2 (only when the charge asked for an SMS code): relay it, then poll.
   *
   * 🔴 **A 200 here is not a payment.** The row comes back still `pending`, and
   * that is correct — the code only authorises the charge, and the buyer has
   * still to confirm it on the handset. So this drops straight into the same
   * verify poll every other branch uses: no success state, no `onPaid()`, no
   * wallet or plan refresh. The payment callback or the poll settles it.
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
        // a payment with no OTP step at all. Reconcile with the idempotent verify
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
    setRedirectUrl(null);
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

        {phase === 'form' && options === null && !optionsFailed && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('billing.checkout.optionsLoading')}
          </div>
        )}

        {phase === 'form' && optionsFailed && (
          <ResultState
            icon={<XCircle className="mx-auto h-10 w-10 text-destructive" />}
            title={t('billing.checkout.optionsFailed')}
            action={
              <>
                <Button variant="outline" onClick={() => handleClose(false)}>
                  {t('common.actions.close')}
                </Button>
                <Button onClick={() => void loadOptions()}>{t('common.actions.retry')}</Button>
              </>
            }
          />
        )}

        {/* The server offers nothing to pay with: online payment is switched
            off. A valid answer, not an error — so no retry and no pay button. */}
        {phase === 'form' && options !== null && !cardOption && mobileOptions.length === 0 && (
          <ResultState
            icon={<Info className="mx-auto h-10 w-10 text-muted-foreground" />}
            title={t('billing.checkout.onlineUnavailable')}
            description={formError ?? t('billing.checkout.onlineUnavailableHint')}
            action={
              <Button variant="outline" onClick={() => handleClose(false)}>
                {t('common.actions.close')}
              </Button>
            }
          />
        )}

        {phase === 'form' && options !== null && (cardOption || mobileOptions.length > 0) && (
          <div className="space-y-5">
            {/* Saved-method quick-select row */}
            {payableMethods.length > 0 && (
              <div className="space-y-1.5">
                <Label>{t('billing.checkout.savedMethods')}</Label>
                {/* Horizontally scrollable rather than wrapped: ten saved methods
                    would otherwise push the actual form off a phone screen. */}
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                  {payableMethods.map((m) => (
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

            {/* Category first: the vendor picks a way to pay. Only what the
                server offers right now is shown. */}
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
                // Two abreast so the whole choice is one glance; a lone choice
                // keeps the full width rather than sitting half-empty.
                className={cardOption && mobileOptions.length > 0 ? 'grid-cols-2' : undefined}
              >
                {cardOption && (
                  <PaymentOptionCard
                    value="card"
                    orientation="stacked"
                    visual={<PaymentOptionIcon icon={CreditCard} />}
                    title={t('payments.category.card.title')}
                    description={t('payments.category.card.provider')}
                    badge={<CurrencyPill code={chargeCurrencyOf(cardOption)} />}
                  />
                )}
                {mobileOptions.length > 0 && (
                  <PaymentOptionCard
                    value="mobile_money"
                    orientation="stacked"
                    visual={<PaymentOptionIcon icon={Smartphone} />}
                    title={t('payments.category.mobileMoney.title')}
                    description={t('payments.category.mobileMoney.payFrom')}
                    badge={<CurrencyPill code={chargeCurrencyOf(mobileOptions[0])} />}
                  />
                )}
              </PaymentOptionGroup>
            </div>

            {!isStripe ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label id="pay-provider-label">{t('payments.providers.label')}</Label>
                  <MobileMoneyBrandPicker
                    aria-labelledby="pay-provider-label"
                    value={brandId}
                    onChange={(id) => {
                      setBrandId(id);
                      setFormError(null);
                    }}
                    chargeableOnly
                    offered={offeredOperators}
                    disabled={submitting}
                  />
                </div>
                {needsPhone && (
                  <div className="space-y-1.5">
                    <Label htmlFor="pay-phone">{t('billing.checkout.phone')}</Label>
                    <PhoneInput
                      id="pay-phone"
                      value={phone}
                      onChange={(value) => {
                        setPhone(value);
                        setFormError(null);
                      }}
                      required
                    />
                  </div>
                )}
                {/* Only a hint: the charge's answer decides whether a code is asked for. */}
                {selectedOption?.mayRequireOtp && (
                  <p className="flex gap-2 text-xs text-muted-foreground">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{t('billing.checkout.otpMayFollow')}</span>
                  </p>
                )}
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
                // Nothing offered is picked, or the number is incomplete — don't
                // send a charge that can only be refused.
                disabled={submitting || !selectedOption || (needsPhone && !isValidPhone(phone))}
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
                publishableKey={stripeInit.publishableKey}
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
            {redirectUrl && (
              <Button asChild>
                <a href={redirectUrl} target="_blank" rel="noopener noreferrer">
                  {t('billing.checkout.openPaymentPage')}
                </a>
              </Button>
            )}
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
      title={method.label}
    >
      {/* The label right next to it already names the brand. */}
      <PaymentBrandLogo brand={brandForSavedMethod(method)} size="sm" decorative />
      <span className="max-w-[8rem] truncate">{method.label}</span>
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
  description?: string;
  action: React.ReactNode;
}) {
  return (
    <div className="space-y-4 py-2 text-center">
      {icon}
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="flex justify-center gap-2">{action}</div>
    </div>
  );
}
