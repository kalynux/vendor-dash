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
  PAYMENT_POLL_INTERVAL_MS,
  PAYMENT_POLL_TIMEOUT_MS,
  formatCharged,
  saveStripeResume,
  clearStripeResume,
  type StripeResumeKind,
} from './billing.constants';

type Phase = 'form' | 'card' | 'processing' | 'success' | 'failed' | 'timeout';

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

      // pending. For Stripe, mount the Payment Element and confirm the card next.
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
                      'flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition',
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
            description={t('billing.checkout.failedDescription')}
            action={
              <>
                <Button variant="outline" onClick={() => handleClose(false)}>
                  {t('common.actions.close')}
                </Button>
                <Button onClick={backToForm}>{t('common.actions.retry')}</Button>
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
