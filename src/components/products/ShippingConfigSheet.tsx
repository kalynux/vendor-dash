import { useCallback, useEffect, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ResponsiveModal } from '@/components/services/ResponsiveModal';
import {
  deleteShippingConfig,
  fetchShippingConfig,
  saveShippingConfig,
} from '@/services/shipping.service';
import { ApiError } from '@/types/api';
import type { ShippingConfig } from '@/types/shipping.types';
import { useApiError, useTranslation, type TranslationKey } from '@/i18n';
import { cn } from '@/lib/utils';

interface ShippingConfigSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  disabled?: boolean;
  /** Called after a successful save or clear, so the caller can refresh its summary. */
  onSaved: (config: ShippingConfig | null) => void;
}

/** The form's own shape: strings, because every field is a text input. */
type Draft = {
  weight: string;
  length: string;
  width: string;
  height: string;
  originZipCode: string;
  handlingDays: string;
  shippingEnabled: boolean;
};

const EMPTY_DRAFT: Draft = {
  weight: '',
  length: '',
  width: '',
  height: '',
  originZipCode: '',
  // Pre-filled with the backend's own defaults rather than left blank, because
  // this endpoint is a full replace: a blank field is not "leave it alone", it is
  // "reset it", and showing the value that would be written is the honest form.
  handlingDays: '1',
  shippingEnabled: true,
};

function toDraft(config: ShippingConfig): Draft {
  return {
    weight: String(config.weight),
    length: String(config.length),
    width: String(config.width),
    height: String(config.height),
    originZipCode: config.originZipCode,
    handlingDays: String(config.handlingDays),
    shippingEnabled: config.shippingEnabled,
  };
}

/**
 * Thumb-sized fields on a phone. The sheet is portalled out of the page, so the
 * product form's own phone sizing (`ProductFormBody`) does not reach in here.
 */
const SHEET_INPUT = 'max-md:h-11 max-md:text-base';

/** The four measurements, so the numeric rule is written once. */
const MEASUREMENTS = ['weight', 'length', 'width', 'height'] as const;

type FieldErrors = Partial<Record<keyof Draft, TranslationKey>>;

/**
 * Validate against the backend's actual constraints.
 *
 * ⚠ `0` is accepted for all four measurements. The backend's own doc says "must
 * be positive (> 0)" — the validator says `>= 0`, and only its *message* reads
 * "must be positive", which is where that claim came from. Rejecting 0 here would
 * be stricter than the server for no reason.
 */
function validate(draft: Draft): FieldErrors {
  const errors: FieldErrors = {};

  for (const key of MEASUREMENTS) {
    const raw = draft[key].trim();
    if (raw === '') {
      errors[key] = 'products.shipping.validation.required';
      continue;
    }
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      errors[key] = 'products.shipping.validation.nonNegative';
    }
  }

  const zip = draft.originZipCode.trim();
  if (zip.length < 1 || zip.length > 20) {
    errors.originZipCode = 'products.shipping.validation.zip';
  }

  const days = Number(draft.handlingDays.trim());
  if (!Number.isInteger(days) || days < 0) {
    errors.handlingDays = 'products.shipping.validation.handlingDays';
  }

  return errors;
}

/**
 * Product-level shipping configuration: parcel weight and dimensions, the
 * postcode it ships from, and how long the vendor takes to hand it over.
 *
 * 🔴 This is not what gates publishing. The activation gate wants
 * `product.delivery` — the agency and pickup block edited on the product itself.
 * Nothing here blocks or unblocks a publish, which is worth saying in the UI
 * because "I set up shipping, why is it still blocked" is the obvious confusion.
 *
 * What this record is actually for: an agency warehousing the product reads these
 * as the parcel's dimensions when the variant carries none of its own.
 *
 * ⚠ Saving is a **full replace** — every field is overwritten and the two
 * defaulted fields re-default. So this form always submits the complete object
 * and never diffs, and the two defaults are pre-filled rather than blank.
 */
export function ShippingConfigSheet({
  open,
  onOpenChange,
  productId,
  disabled,
  onSaved,
}: ShippingConfigSheetProps) {
  const { t } = useTranslation();
  const apiError = useApiError();

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [existing, setExisting] = useState<ShippingConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loadError, setLoadError] = useState<string | null>(null);

  // Re-read on every open rather than caching: the sheet is the only writer, but
  // it is not the only thing that can have changed the product since it last ran.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setErrors({});

    (async () => {
      try {
        const config = await fetchShippingConfig(productId);
        if (cancelled) return;
        setExisting(config);
        setDraft(config ? toDraft(config) : EMPTY_DRAFT);
      } catch (err) {
        if (!cancelled) {
          setLoadError(apiError.resolve(err, { fallbackKey: 'products.shipping.loadFailed' }));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, productId, apiError]);

  const set = useCallback(<K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  }, []);

  const handleSave = useCallback(async () => {
    const found = validate(draft);
    if (Object.values(found).some(Boolean)) {
      setErrors(found);
      return;
    }
    setSaving(true);
    try {
      const saved = await saveShippingConfig(productId, {
        weight: Number(draft.weight),
        length: Number(draft.length),
        width: Number(draft.width),
        height: Number(draft.height),
        originZipCode: draft.originZipCode.trim(),
        handlingDays: Number(draft.handlingDays),
        shippingEnabled: draft.shippingEnabled,
      });
      setExisting(saved);
      onSaved(saved);
      toast.success(t('products.shipping.saved'));
      onOpenChange(false);
    } catch (err) {
      // The one code worth its own sentence: the product is mid-vectorisation and
      // every write is locked, which is temporary rather than wrong.
      if (err instanceof ApiError && err.code === 'CATALOG_PRODUCT_VECTORISATION_PENDING') {
        toast.error(t('products.shipping.vectorisationPending'));
        return;
      }
      apiError.toast(err, { fallbackKey: 'products.shipping.saveFailed' });
    } finally {
      setSaving(false);
    }
  }, [draft, productId, onSaved, onOpenChange, t, apiError]);

  const handleClear = useCallback(async () => {
    setClearing(true);
    try {
      await deleteShippingConfig(productId);
      setExisting(null);
      setDraft(EMPTY_DRAFT);
      onSaved(null);
      toast.success(t('products.shipping.cleared'));
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'CATALOG_PRODUCT_VECTORISATION_PENDING') {
        toast.error(t('products.shipping.vectorisationPending'));
        return;
      }
      apiError.toast(err, { fallbackKey: 'products.shipping.clearFailed' });
    } finally {
      setClearing(false);
    }
  }, [productId, onSaved, onOpenChange, t, apiError]);

  const busy = saving || clearing || loading || disabled;

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={t('products.shipping.title')}
      description={t('products.shipping.description')}
      desktopClassName="sm:max-w-lg"
      // Save on top on a phone (primary, then Cancel, then Clear); the desktop
      // row is already reversed into Clear · Cancel · Save.
      footerClassName="flex-col-reverse"
      footer={
        <>
          {/* Only offered when there is something stored — DELETE 404s otherwise,
              and a button whose only outcome is an error is worse than no button. */}
          {existing && (
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive sm:mr-auto"
              disabled={busy}
              onClick={() => void handleClear()}
            >
              {clearing ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 size-4" />
              )}
              {t('products.shipping.clear')}
            </Button>
          )}
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            {t('common.actions.cancel')}
          </Button>
          <Button type="button" disabled={busy} onClick={() => void handleSave()}>
            {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
            {t('common.actions.save')}
          </Button>
        </>
      }
    >
      {loadError ? (
        <Alert variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-5">
          {/* Said up front, because it is the question this screen creates. */}
          <p className="text-sm text-muted-foreground">
            {t('products.shipping.notActivationHint')}
          </p>

          <div className="grid grid-cols-2 gap-x-3 gap-y-5">
            {/* Labelled in grams on purpose. The backend stores grams and its own
                doc says kilograms in two places — a vendor typing 2 for a 2 kg
                parcel would describe a 2 g one. */}
            <Field
              id="shipping-weight"
              label={t('products.shipping.weight')}
              value={draft.weight}
              onChange={(v) => set('weight', v)}
              error={errors.weight}
              disabled={busy}
              className="col-span-2"
            />
            <Field
              id="shipping-length"
              label={t('products.shipping.length')}
              value={draft.length}
              onChange={(v) => set('length', v)}
              error={errors.length}
              disabled={busy}
            />
            <Field
              id="shipping-width"
              label={t('products.shipping.width')}
              value={draft.width}
              onChange={(v) => set('width', v)}
              error={errors.width}
              disabled={busy}
            />
            <Field
              id="shipping-height"
              label={t('products.shipping.height')}
              value={draft.height}
              onChange={(v) => set('height', v)}
              error={errors.height}
              disabled={busy}
            />
            <Field
              id="shipping-handling"
              label={t('products.shipping.handlingDays')}
              value={draft.handlingDays}
              onChange={(v) => set('handlingDays', v)}
              error={errors.handlingDays}
              disabled={busy}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="shipping-zip">{t('products.shipping.originZip')}</Label>
            <Input
              id="shipping-zip"
              value={draft.originZipCode}
              onChange={(e) => set('originZipCode', e.target.value)}
              maxLength={20}
              disabled={busy}
              aria-invalid={!!errors.originZipCode}
              className={SHEET_INPUT}
            />
            {errors.originZipCode && (
              <p className="text-sm text-destructive">{t(errors.originZipCode)}</p>
            )}
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <Label htmlFor="shipping-enabled">{t('products.shipping.enabled')}</Label>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('products.shipping.enabledHint')}
              </p>
            </div>
            <Switch
              id="shipping-enabled"
              className="shrink-0"
              checked={draft.shippingEnabled}
              onCheckedChange={(v) => set('shippingEnabled', v)}
              disabled={busy}
              aria-label={t('products.shipping.enabled')}
            />
          </div>
        </div>
      )}
    </ResponsiveModal>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  disabled,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: TranslationKey;
  disabled?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={0}
        step="any"
        inputMode="decimal"
        className={SHEET_INPUT}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-invalid={!!error}
      />
      {error && <p className="text-sm text-destructive">{t(error)}</p>}
    </div>
  );
}
