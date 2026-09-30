import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ResponsiveModal } from '@/components/services/ResponsiveModal';
import { isValidPhone, toE164 } from '@/lib/phone';
import { PhoneInput } from '@/components/phone';
import {
  MobileMoneyBrandSelect,
  mobileMoneyBrandById,
  mobileMoneyBrandByOperator,
  type MobileMoneyBrandId,
} from '@/components/payment-methods';
import { useTranslation, useApiError } from '@/i18n';
import { ApiError } from '@/types/api';
import type { PhoneOperator } from '@/types/billing.types';
import type { AddPaymentMethodPayload, SavedPaymentMethod } from '@/types/payment-method.types';
import { addPaymentMethod } from '@/services/payment-methods.service';
import { providerMismatchDetected } from './billing.constants';

export interface AddPaymentMethodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Whether the new method should be saved as default (true when wallet is empty). */
  forceDefault?: boolean;
  /** Methods already saved — the server has no duplicate check, so we do it here. */
  existing?: SavedPaymentMethod[];
  onAdded: (method: SavedPaymentMethod) => void;
}

/** Wallet pre-selected when the dialog opens — the largest operator in our markets. */
const DEFAULT_BRAND: MobileMoneyBrandId = 'mtn';

/**
 * Save a mobile-money wallet: the network the vendor holds and its number.
 * Cards can't be saved (the server refuses them since 2026-09-30); paying by
 * card still works in the payment dialog.
 */
export function AddPaymentMethodDialog({
  open,
  onOpenChange,
  forceDefault = false,
  existing = [],
  onAdded,
}: AddPaymentMethodDialogProps) {
  const { t } = useTranslation();
  const apiError = useApiError();

  const [brandId, setBrandId] = useState<MobileMoneyBrandId>(DEFAULT_BRAND);
  const [phone, setPhone] = useState('');
  const [makeDefault, setMakeDefault] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  // The network the server says the number is on, when it isn't the one picked.
  const [detected, setDetected] = useState<PhoneOperator | null>(null);

  const brand = mobileMoneyBrandById(brandId);

  useEffect(() => {
    if (open) {
      setBrandId(DEFAULT_BRAND);
      setPhone('');
      setMakeDefault(false);
      setSubmitting(false);
      setError(null);
      setPhoneError(null);
      setDetected(null);
    }
  }, [open]);

  function clearErrors() {
    setError(null);
    setPhoneError(null);
    setDetected(null);
  }

  function networkName(operator: PhoneOperator): string {
    return mobileMoneyBrandByOperator(operator)?.name ?? operator;
  }

  /** Returns the body to send, or `null` after showing why it can't be sent. */
  function buildPayload(): AddPaymentMethodPayload | null {
    // The picker only offers wallets that can be charged, but guard anyway: the
    // server takes exactly MTN / ORANGE / MOOV.
    const operator = brand?.chargeOperator;
    if (!operator) {
      setError(t('payments.providers.soonHint', { brand: brand?.name ?? '' }));
      return null;
    }
    const e164 = toE164(phone);
    if (!e164) {
      setPhoneError(t('common.validation.phone'));
      return null;
    }
    const last4 = e164.slice(-4);
    if (existing.some((m) => m.provider === operator && m.last4 === last4)) {
      setPhoneError(t('billing.methods.duplicate', { network: networkName(operator) }));
      return null;
    }
    const payload: AddPaymentMethodPayload = { provider: operator, phoneNumber: e164 };
    // A first method is made default by the server anyway; only send it when set.
    if (forceDefault || makeDefault) payload.isDefault = true;
    return payload;
  }

  async function handleSubmit() {
    clearErrors();
    const payload = buildPayload();
    if (!payload) return;
    setSubmitting(true);
    try {
      const created = await addPaymentMethod(payload);
      toast.success(t('billing.toast.methodAdded'));
      onAdded(created);
      onOpenChange(false);
    } catch (err) {
      // Every refusal keeps the dialog open with what was typed.
      const other = providerMismatchDetected(err);
      if (other) {
        setDetected(other);
        setPhoneError(
          t('billing.methods.phoneMismatch', {
            detected: networkName(other),
            provider: networkName(payload.provider),
          }),
        );
        return;
      }
      if (err instanceof ApiError && err.code === 'VALIDATION_ERROR') {
        const fields = apiError.fields(err);
        const phoneMessage = fields.phoneNumber;
        if (phoneMessage) setPhoneError(phoneMessage);
        if (!phoneMessage || Object.keys(fields).length > 1) {
          setError(apiError.resolve(err, { context: 'billing', fallbackKey: 'billing.errors.methodFailed' }));
        }
        return;
      }
      setError(apiError.resolve(err, { context: 'billing', fallbackKey: 'billing.errors.methodFailed' }));
    } finally {
      setSubmitting(false);
    }
  }

  function switchToDetected() {
    const target = detected ? mobileMoneyBrandByOperator(detected) : undefined;
    if (target) setBrandId(target.id);
    clearErrors();
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
            // Saving a half-typed number would store an unusable wallet.
            disabled={submitting || !isValidPhone(phone) || !brand?.chargeOperator}
            className="max-sm:w-full"
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('billing.methods.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label id="add-provider-label">{t('payments.providers.label')}</Label>
            <MobileMoneyBrandSelect
              id="add-provider"
              aria-labelledby="add-provider-label"
              value={brandId}
              onChange={(id) => {
                setBrandId(id);
                clearErrors();
              }}
              chargeableOnly
              disabled={submitting}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="add-phone">{t('billing.methods.phone')}</Label>
            <PhoneInput
              id="add-phone"
              value={phone}
              onChange={(v) => {
                setPhone(v);
                setPhoneError(null);
                setDetected(null);
              }}
              required
            />
            {phoneError && (
              <div className="space-y-1.5" role="alert">
                <p className="text-sm text-destructive">{phoneError}</p>
                {detected && mobileMoneyBrandByOperator(detected) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={switchToDetected}
                    disabled={submitting}
                  >
                    {t('billing.methods.useDetected', { network: networkName(detected) })}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

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
