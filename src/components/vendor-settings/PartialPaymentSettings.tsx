import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { fetchPartialPayment, updatePartialPayment } from '@/services/partial-payment.service';
import {
  PARTIAL_PAYMENT_CUSTOMER_MAX_PERCENT,
  PARTIAL_PAYMENT_MAX_PERCENT,
  PARTIAL_PAYMENT_MIN_PERCENT,
  type PartialPaymentTerms,
} from '@/types/partial-payment.types';
import { ApiError } from '@/types/api';
import { useApiError, useFormatters, useTranslation } from '@/i18n';
import { UnsavedChangesBar } from '@/components/vendor-settings/UnsavedChangesBar';
import { SettingsSection } from '@/components/vendor-settings/SettingsSection';
import { Input } from '@/components/ui/input';
import { LabelWithHint } from '@/components/ui/info-hint';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';

interface Snapshot {
  enabled: boolean;
  /** The percent as typed; `''` = not set (`null`). */
  minPercent: string;
}

/**
 * Partial payment (2026-11-01) — a card on the Policies tab with its own save.
 * ⚠ Never folded into the COD terms: a vendor with cash on delivery off can still
 * accept this. Both keys are always sent (full replace).
 *
 * The "Your money" points stay on screen rather than behind an info icon: the
 * brief asks for them next to the setting, and they decide whether to switch it on.
 */
export function PartialPaymentSettings() {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const apiError = useApiError();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverFieldError, setServerFieldError] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [minPercent, setMinPercent] = useState('');
  const [saved, setSaved] = useState<Snapshot>({ enabled: false, minPercent: '' });
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const applyServer = useCallback((terms: PartialPaymentTerms) => {
    const next = {
      enabled: terms.enabled,
      minPercent: terms.minPercent === null ? '' : String(terms.minPercent),
    };
    setEnabled(next.enabled);
    setMinPercent(next.minPercent);
    setSaved(next);
    setUpdatedAt(terms.updatedAt);
  }, []);

  useEffect(() => {
    let active = true;
    fetchPartialPayment()
      .then((terms) => active && applyServer(terms))
      .catch((err) => active && setLoadError(apiError.resolve(err, { fallbackKey: 'settings.partialPayment.loadFailed' })))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [apiError, applyServer]);

  const typed = minPercent.trim();
  const percentNum = Number(typed);
  // The server checks the range even with the setting off; empty is refused only when on.
  const percentInvalid =
    typed === ''
      ? enabled
      : !Number.isInteger(percentNum) || percentNum < PARTIAL_PAYMENT_MIN_PERCENT || percentNum > PARTIAL_PAYMENT_MAX_PERCENT;
  const dirty = enabled !== saved.enabled || typed !== saved.minPercent;

  const handleDiscard = useCallback(() => {
    setError(null);
    setServerFieldError(false);
    setEnabled(saved.enabled);
    setMinPercent(saved.minPercent);
  }, [saved]);

  const handleSave = useCallback(async () => {
    if (percentInvalid) return;
    setSaving(true);
    setError(null);
    setServerFieldError(false);
    try {
      const terms = await updatePartialPayment({
        enabled,
        minPercent: typed === '' ? null : percentNum,
      });
      applyServer(terms);
      toast.success(t('settings.partialPayment.saved'));
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors.some((f) => f.field.endsWith('minPercent'))) {
        setServerFieldError(true);
      } else {
        setError(apiError.resolve(err, { fallbackKey: 'settings.partialPayment.saveFailed' }));
      }
    } finally {
      setSaving(false);
    }
  }, [enabled, typed, percentNum, percentInvalid, applyServer, apiError, t]);

  const showPercentError = percentInvalid || serverFieldError;

  return (
    <div>
      <SettingsSection
        title={t('settings.partialPayment.title')}
        info={t('settings.partialPayment.info')}
        contentClassName="space-y-5"
      >
        {loading ? (
          <>
            <Skeleton className="h-11 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
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

            <div className="space-y-1">
              <div className="flex min-h-11 items-center justify-between gap-4">
                <label htmlFor="partial-payment-enabled" className="text-sm font-medium">
                  {t('settings.partialPayment.acceptLabel')}
                </label>
                <Switch id="partial-payment-enabled" checked={enabled} onCheckedChange={setEnabled} />
              </div>
              <p className="text-xs text-muted-foreground">{t('settings.partialPayment.acceptHint')}</p>
            </div>

            {/* Kept (and still sent) while the setting is off — only greyed out. */}
            <div className="space-y-2">
              <LabelWithHint
                htmlFor="partial-payment-min"
                hintLabel={t('settings.partialPayment.minLabel')}
                hint={t('settings.partialPayment.minHint', { max: PARTIAL_PAYMENT_CUSTOMER_MAX_PERCENT })}
              >
                {t('settings.partialPayment.minLabel')}
              </LabelWithHint>
              <div className="flex items-center gap-2">
                <Input
                  id="partial-payment-min"
                  type="number"
                  inputMode="numeric"
                  min={PARTIAL_PAYMENT_MIN_PERCENT}
                  max={PARTIAL_PAYMENT_MAX_PERCENT}
                  step={1}
                  placeholder="30"
                  value={minPercent}
                  disabled={!enabled}
                  onChange={(e) => {
                    setServerFieldError(false);
                    setMinPercent(e.target.value);
                  }}
                  aria-invalid={showPercentError}
                  className="h-11 w-24"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              {showPercentError && (
                <p className="text-xs text-destructive">
                  {t('settings.partialPayment.minInvalid', {
                    min: PARTIAL_PAYMENT_MIN_PERCENT,
                    max: PARTIAL_PAYMENT_MAX_PERCENT,
                  })}
                </p>
              )}
            </div>

            <div className="space-y-0.5 text-xs text-muted-foreground">
              {updatedAt && <p>{t('settings.partialPayment.lastChanged', { date: fmt.dateTime(updatedAt) })}</p>}
              <p>{t('settings.partialPayment.scope')}</p>
            </div>

            <div className="space-y-3 border-t pt-4 text-sm">
              <div className="space-y-1.5">
                <p className="font-medium">{t('settings.partialPayment.money.title')}</p>
                <ul className="list-disc space-y-1.5 ps-4 text-muted-foreground">
                  <li>{t('settings.partialPayment.money.pending')}</li>
                  <li>{t('settings.partialPayment.money.locked')}</li>
                  <li>{t('settings.partialPayment.money.perParcel')}</li>
                  <li>{t('settings.partialPayment.money.fees')}</li>
                </ul>
              </div>
              <div className="space-y-1.5">
                <p className="font-medium">{t('settings.partialPayment.money.faultTitle')}</p>
                <p className="text-muted-foreground">{t('settings.partialPayment.money.faultBody')}</p>
                <p className="text-muted-foreground">{t('settings.partialPayment.money.cancelBody')}</p>
              </div>
            </div>
          </>
        )}
      </SettingsSection>

      <UnsavedChangesBar
        visible={dirty || saving}
        saving={saving}
        saveDisabled={percentInvalid}
        onDiscard={handleDiscard}
        onSave={handleSave}
      />
    </div>
  );
}
