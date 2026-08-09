import { useEffect, useRef, useState } from 'react';
import { Loader2, Smartphone, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ResponsiveModal } from '@/components/services/ResponsiveModal';
import { isValidPhone, toE164 } from '@/lib/phone';
import { PhoneInput } from '@/components/phone';
import {
  MobileMoneyBrandSelect,
  PaymentOptionCard,
  PaymentOptionGroup,
  PaymentOptionIcon,
  mobileMoneyBrandById,
  type MobileMoneyBrandId,
} from '@/components/payment-methods';
import { useTranslation, useApiError } from '@/i18n';
import { ApiError } from '@/types/api';
import type { AddPaymentMethodPayload, SavedPaymentMethod } from '@/types/payment-method.types';
import { isStripeConfigured } from '@/lib/stripe';
import { addPaymentMethod } from '@/services/payment-methods.service';
import { StripeCardField, type StripeCardFieldHandle } from './StripeCardField';
import { CardPreview } from './CardPreview';
import { MOBILE_MONEY_GATEWAY } from './billing.constants';

export interface AddPaymentMethodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Whether the new method should be saved as default (true when wallet is empty). */
  forceDefault?: boolean;
  onAdded: (method: SavedPaymentMethod) => void;
}

/** The two top-level choices. Card only appears when Stripe is configured. */
type MethodCategory = 'card' | 'mobile_money';

/** Wallet pre-selected when the dialog opens — the largest operator in our markets. */
const DEFAULT_BRAND: MobileMoneyBrandId = 'mtn';

export function AddPaymentMethodDialog({
  open,
  onOpenChange,
  forceDefault = false,
  onAdded,
}: AddPaymentMethodDialogProps) {
  const { t } = useTranslation();
  const apiError = useApiError();

  const [category, setCategory] = useState<MethodCategory>(
    isStripeConfigured ? 'card' : 'mobile_money',
  );
  const [brandId, setBrandId] = useState<MobileMoneyBrandId>(DEFAULT_BRAND);
  const [phone, setPhone] = useState('');
  const [holderName, setHolderName] = useState('');
  const [makeDefault, setMakeDefault] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cardRef = useRef<StripeCardFieldHandle>(null);
  const brand = mobileMoneyBrandById(brandId);

  useEffect(() => {
    if (open) {
      setCategory(isStripeConfigured ? 'card' : 'mobile_money');
      setBrandId(DEFAULT_BRAND);
      setPhone('');
      setHolderName('');
      setMakeDefault(false);
      setSubmitting(false);
      setError(null);
    }
  }, [open]);

  async function buildPayload(): Promise<AddPaymentMethodPayload> {
    const isDefault = forceDefault || makeDefault;

    if (category === 'card') {
      // Stripe gives us a reusable PaymentMethod (instrument) + card metadata.
      const card = await cardRef.current!.createPaymentMethod(holderName.trim() || undefined);
      const label = `${(card.brand ?? 'CARD').toUpperCase()} •••• ${card.last4 ?? '••••'}`;
      return {
        provider: 'stripe',
        // No customer id is available client-side with a publishable key; the backend
        // resolves/creates it. We send the instrument id as a non-empty placeholder to
        // satisfy the contract (best-effort id mapping).
        gateway_customer_id: card.instrumentId,
        gateway_instrument_id: card.instrumentId,
        method_type: 'card',
        display_label: label,
        brand: card.brand,
        last4: card.last4,
        exp_month: card.expMonth,
        exp_year: card.expYear,
        holder_name: holderName.trim() || null,
        is_default: isDefault,
      };
    }

    // Mobile money — no client SDK to tokenise; store display metadata + provider.
    // The phone reference stands in for the gateway token ids until real tokenisation
    // is wired (charging a saved method is a future backend step per the docs).
    // The operator code is what a charge will later carry, so a wallet no gateway
    // can debit must never reach the payload — the picker already blocks it.
    const operator = brand?.chargeOperator;
    if (!operator) {
      throw new Error(t('payments.providers.soonHint', { brand: brand?.name ?? '' }));
    }
    const e164 = toE164(phone);
    if (!e164) {
      throw new Error(t('common.validation.phone'));
    }
    // The gateway is fixed: NotchPay is the only processor that debits a wallet
    // for us, which is why the dialog states it rather than offering a choice.
    const provider = MOBILE_MONEY_GATEWAY.toLowerCase();
    const last4 = e164.slice(-4);
    const ref = `${provider}:${e164}`;
    return {
      provider,
      gateway_customer_id: ref,
      gateway_instrument_id: ref,
      method_type: 'mobile_money',
      display_label: `${operator} •••• ${last4}`,
      brand: operator,
      last4,
      holder_name: holderName.trim() || null,
      is_default: isDefault,
    };
  }

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const payload = await buildPayload();
      const created = await addPaymentMethod(payload);
      toast.success(t('billing.toast.methodAdded'));
      onAdded(created);
      onOpenChange(false);
    } catch (err) {
      // Client-side validation and Stripe card errors are thrown as plain `Error`s
      // whose message is already user-facing; API failures resolve by code.
      setError(
        err instanceof ApiError
          ? apiError.resolve(err, { context: 'billing', fallbackKey: 'billing.errors.methodFailed' })
          : err instanceof Error
            ? err.message
            : t('billing.errors.methodFailed'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      disableClose={submitting}
      title={t('billing.methods.addTitle')}
      description={t('billing.methods.addDescription')}
      desktopClassName="sm:max-w-lg"
      // The form is short — let the sheet size to it instead of standing at the
      // full-screen height the service modals need.
      mobileClassName="h-auto max-h-[92dvh]"
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="max-sm:w-full"
          >
            {t('common.actions.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            // Saving a half-typed number would store an unusable payout target.
            disabled={
              submitting || (category === 'mobile_money' && (!isValidPhone(phone) || !brand?.chargeOperator))
            }
            className="max-sm:w-full"
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('billing.methods.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Category first: the vendor picks a way to pay, not a gateway name. */}
        <div className="space-y-2">
          <Label id="add-method-category" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('billing.methods.type')}
          </Label>
          <PaymentOptionGroup
            aria-labelledby="add-method-category"
            value={category}
            onValueChange={(v) => {
              setCategory(v as MethodCategory);
              setError(null);
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
              />
            )}
            <PaymentOptionCard
              value="mobile_money"
              orientation="stacked"
              visual={<PaymentOptionIcon icon={Smartphone} />}
              title={t('payments.category.mobileMoney.title')}
              description={t('payments.category.mobileMoney.payFrom')}
              // The processor never varies for a wallet, so it is stated here
              // instead of taking up a field the vendor cannot change.
              footer={<GatewayBadge />}
            />
          </PaymentOptionGroup>
        </div>

        {category === 'mobile_money' ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label id="add-provider-label">{t('payments.providers.label')}</Label>
              <MobileMoneyBrandSelect
                id="add-provider"
                aria-labelledby="add-provider-label"
                value={brandId}
                onChange={setBrandId}
                chargeableOnly
                disabled={submitting}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-phone">{t('billing.methods.phone')}</Label>
              <PhoneInput
                id="add-phone"
                value={phone}
                onChange={setPhone}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-holder-mm">{t('billing.methods.holderNameOptional')}</Label>
              <Input
                id="add-holder-mm"
                placeholder={t('billing.methods.holderNamePlaceholder')}
                value={holderName}
                onChange={(e) => setHolderName(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <CardPreview holderName={holderName} className="mx-auto max-w-xs" />
            <div className="space-y-1.5">
              <Label htmlFor="add-holder">{t('billing.methods.cardHolderName')}</Label>
              <Input
                id="add-holder"
                placeholder={t('billing.methods.cardHolderPlaceholder')}
                value={holderName}
                onChange={(e) => setHolderName(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('billing.methods.cardDetails')}</Label>
              <StripeCardField ref={cardRef} disabled={submitting} />
            </div>
          </div>
        )}

        {!forceDefault && (
          <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{t('billing.methods.makeDefault')}</p>
              <p className="text-xs text-muted-foreground">{t('billing.methods.makeDefaultHint')}</p>
            </div>
            <Switch
              checked={makeDefault}
              onCheckedChange={setMakeDefault}
              disabled={submitting}
              aria-label={t('billing.methods.makeDefault')}
            />
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
    </ResponsiveModal>
  );
}

/**
 * "Processed by NotchPay", as a pill on the Mobile Money card. Visually it is
 * the brand alone — the row it sits in already reads as metadata — but a screen
 * reader gets the full phrase, which a bare processor name would not convey.
 */
function GatewayBadge() {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center rounded-full border bg-muted/60 px-1.5 py-px text-[10px] font-medium leading-4 text-muted-foreground">
      <span className="sr-only">{t('billing.methods.processedBy')}: </span>
      {t('billing.gateway.notchpay')}
    </span>
  );
}
