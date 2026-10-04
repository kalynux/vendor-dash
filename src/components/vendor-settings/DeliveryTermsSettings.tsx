import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';

import { fetchDeliveryTerms, updateDeliveryTerms } from '@/services/delivery-terms.service';
import {
  FREE_ABOVE_AMOUNT_MAX,
  FREE_ABOVE_AMOUNT_MIN,
  type DeliveryTerms,
  type DeliveryTermsMode,
} from '@/types/delivery-terms.types';
import { ApiError } from '@/types/api';
import { useApiError, useFormatters, useTranslation, type TranslationKey } from '@/i18n';
import { UnsavedChangesBar } from '@/components/vendor-settings/UnsavedChangesBar';
import { SettingsSection } from '@/components/vendor-settings/SettingsSection';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';

/** Anchor the product editors link to (`/dashboard/settings/policies#delivery-terms`). */
const ANCHOR = 'delivery-terms';

const MODES: { value: DeliveryTermsMode; labelKey: TranslationKey; hintKey: TranslationKey }[] = [
  { value: 'always', labelKey: 'settings.deliveryTerms.modes.always', hintKey: 'settings.deliveryTerms.modes.alwaysHint' },
  { value: 'never', labelKey: 'settings.deliveryTerms.modes.never', hintKey: 'settings.deliveryTerms.modes.neverHint' },
  { value: 'above', labelKey: 'settings.deliveryTerms.modes.above', hintKey: 'settings.deliveryTerms.modes.aboveHint' },
];

interface Snapshot {
  mode: DeliveryTermsMode;
  /** The amount as typed; only meaningful with `above`. */
  amount: string;
}

/**
 * Delivery terms (2026-10-03) — who pays delivery for the whole shop. A card on
 * the Policies tab with its own save, like the COD terms: `PUT /delivery-terms`
 * never pauses agency connections, so it is never folded into the policies form.
 */
export function DeliveryTermsSettings() {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const apiError = useApiError();
  const location = useLocation();
  const sectionRef = useRef<HTMLElement>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverFieldError, setServerFieldError] = useState(false);

  const [mode, setMode] = useState<DeliveryTermsMode>('always');
  const [amount, setAmount] = useState('');
  const [saved, setSaved] = useState<Snapshot>({ mode: 'always', amount: '' });
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const applyServer = useCallback((terms: DeliveryTerms) => {
    const next = {
      mode: terms.mode,
      amount: terms.freeAboveAmount === null ? '' : String(terms.freeAboveAmount),
    };
    setMode(next.mode);
    setAmount(next.amount);
    setSaved(next);
    setUpdatedAt(terms.updatedAt);
  }, []);

  useEffect(() => {
    let active = true;
    fetchDeliveryTerms()
      .then((terms) => active && applyServer(terms))
      .catch((err) => active && setLoadError(apiError.resolve(err, { fallbackKey: 'settings.deliveryTerms.loadFailed' })))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [apiError, applyServer]);

  // Landed here from a product editor's "Delivery terms" link.
  useEffect(() => {
    if (!loading && location.hash === `#${ANCHOR}`) {
      sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [loading, location.hash]);

  const amountNum = Number(amount);
  const amountInvalid =
    mode === 'above' &&
    (amount.trim() === '' ||
      !Number.isInteger(amountNum) ||
      amountNum < FREE_ABOVE_AMOUNT_MIN ||
      amountNum > FREE_ABOVE_AMOUNT_MAX);
  // The amount only counts while "free above" is chosen — it is not sent otherwise.
  const dirty = mode !== saved.mode || (mode === 'above' && amount.trim() !== saved.amount);

  const handleDiscard = useCallback(() => {
    setError(null);
    setServerFieldError(false);
    setMode(saved.mode);
    setAmount(saved.amount);
  }, [saved]);

  const handleSave = useCallback(async () => {
    if (amountInvalid) return;
    setSaving(true);
    setError(null);
    setServerFieldError(false);
    try {
      const terms = await updateDeliveryTerms({
        mode,
        freeAboveAmount: mode === 'above' ? amountNum : null,
      });
      applyServer(terms);
      toast.success(t('settings.deliveryTerms.saved'));
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors.some((f) => f.field.endsWith('freeAboveAmount'))) {
        setServerFieldError(true);
      } else {
        setError(apiError.resolve(err, { fallbackKey: 'settings.deliveryTerms.saveFailed' }));
      }
    } finally {
      setSaving(false);
    }
  }, [mode, amountNum, amountInvalid, applyServer, apiError, t]);

  // An empty amount is only flagged once the vendor has typed something or
  // tried to save — not the instant "free above" is picked.
  const showAmountError = (amountInvalid && amount.trim() !== '') || serverFieldError;

  return (
    <div id={ANCHOR}>
      <SettingsSection
        ref={sectionRef}
        title={t('settings.deliveryTerms.title')}
        info={t('settings.deliveryTerms.info')}
        contentClassName="space-y-5"
        className="scroll-mt-20"
      >
        {loading ? (
          <>
            <Skeleton className="h-11 w-full rounded-lg" />
            <Skeleton className="h-11 w-full rounded-lg" />
            <Skeleton className="h-11 w-full rounded-lg" />
          </>
        ) : loadError ? (
          <div role="alert" className="p-3 text-sm bg-destructive/10 text-destructive rounded-lg border border-destructive/20">
            {loadError}
          </div>
        ) : (
          <>
            {error && (
              <div role="alert" className="p-3 text-sm bg-destructive/10 text-destructive rounded-lg border border-destructive/20">
                {error}
              </div>
            )}

            <RadioGroup
              value={mode}
              onValueChange={(v) => {
                setServerFieldError(false);
                setMode(v as DeliveryTermsMode);
              }}
              aria-label={t('settings.deliveryTerms.title')}
              className="gap-4"
            >
              {MODES.map((option) => (
                <label key={option.value} htmlFor={`delivery-terms-${option.value}`} className="flex cursor-pointer items-start gap-3">
                  <RadioGroupItem id={`delivery-terms-${option.value}`} value={option.value} className="mt-0.5" />
                  <span className="space-y-0.5">
                    <span className="block text-sm font-medium">{t(option.labelKey)}</span>
                    <span className="block text-xs text-muted-foreground">{t(option.hintKey)}</span>
                  </span>
                </label>
              ))}
            </RadioGroup>

            {mode === 'above' && (
              <div className="space-y-2 pl-7">
                <label htmlFor="delivery-terms-amount" className="block text-sm font-medium">
                  {t('settings.deliveryTerms.amountLabel')}
                </label>
                <Input
                  id="delivery-terms-amount"
                  type="number"
                  inputMode="numeric"
                  min={FREE_ABOVE_AMOUNT_MIN}
                  max={FREE_ABOVE_AMOUNT_MAX}
                  step={1}
                  placeholder={t('settings.deliveryTerms.amountPlaceholder')}
                  value={amount}
                  onChange={(e) => {
                    setServerFieldError(false);
                    setAmount(e.target.value);
                  }}
                  aria-invalid={showAmountError}
                  className="h-11 max-w-xs"
                />
                {showAmountError && (
                  <p className="text-xs text-destructive">
                    {t('settings.deliveryTerms.amountInvalid', {
                      min: fmt.number(FREE_ABOVE_AMOUNT_MIN),
                      max: fmt.number(FREE_ABOVE_AMOUNT_MAX),
                    })}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1 text-xs text-muted-foreground">
              <p>{t('settings.deliveryTerms.youPayNote')}</p>
              <p>{t('settings.deliveryTerms.smallOrderNote')}</p>
              {updatedAt && <p>{t('settings.deliveryTerms.lastChanged', { date: fmt.dateTime(updatedAt) })}</p>}
            </div>
          </>
        )}
      </SettingsSection>

      <UnsavedChangesBar
        visible={dirty || saving}
        saving={saving}
        saveDisabled={amountInvalid}
        onDiscard={handleDiscard}
        onSave={handleSave}
      />
    </div>
  );
}
