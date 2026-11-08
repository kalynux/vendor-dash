import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import {
  fetchListingSettings,
  saveListingSettings,
  useListingActionCosts,
} from '@/services/listings.service';
import type { ListingOnEmpty, ListingSettings as Settings } from '@/types/listings.types';
import { useApiError, useTranslation, type TranslationKey } from '@/i18n';
import { UnsavedChangesBar } from '@/components/vendor-settings/UnsavedChangesBar';
import { SettingsSection, SettingsSections } from '@/components/vendor-settings/SettingsSection';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { UnitInput } from '@/components/ui/unit-input';
import { Skeleton } from '@/components/ui/skeleton';
import { ListingChargingRule } from './ListingChargingRule';

/** What the form holds: the numbers as typed, `''` = no limit. */
interface Snapshot {
  onEmpty: ListingOnEmpty;
  /** How far BELOW zero, typed as a positive number; sent negated. */
  debtDepth: string;
  dailyCap: string;
}

const ON_EMPTY: { value: ListingOnEmpty; labelKey: TranslationKey; hintKey: TranslationKey }[] = [
  {
    value: 'continue_engaged',
    labelKey: 'listings.settings.onEmpty.continue_engaged',
    hintKey: 'listings.settings.onEmpty.continue_engagedHint',
  },
  { value: 'stop', labelKey: 'listings.settings.onEmpty.stop', hintKey: 'listings.settings.onEmpty.stopHint' },
];

function toSnapshot(s: Settings): Snapshot {
  return {
    onEmpty: s.onEmpty,
    debtDepth: s.debtFloor === null ? '' : String(Math.abs(s.debtFloor)),
    dailyCap: s.maxCreditsPerCustomerPerDay === null ? '' : String(s.maxCreditsPerCustomerPerDay),
  };
}

/** `''` → null; a whole number ≥ 0 → that number; anything else → NaN. */
function parseLimit(value: string): number | null {
  const v = value.trim();
  if (v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : Number.NaN;
}

/**
 * Settings → Listing settings (api-doc/vendor/service-listings.md § 4).
 *
 * A PUT of all three fields. "How far below zero" is asked as a positive depth
 * ("at most 50 credits") because a minus sign in a phone keyboard's number pad
 * is a trap; the server stores it as the floor, -50. Both limits are optional:
 * empty means no limit.
 */
export function ListingSettings() {
  const { t } = useTranslation();
  const apiError = useApiError();
  const costs = useListingActionCosts();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<Snapshot>({ onEmpty: 'continue_engaged', debtDepth: '', dailyCap: '' });
  const [saved, setSaved] = useState<Snapshot>(form);

  const apply = useCallback((s: Settings) => {
    const snap = toSnapshot(s);
    setForm(snap);
    setSaved(snap);
  }, []);

  useEffect(() => {
    let active = true;
    fetchListingSettings()
      .then((s) => active && apply(s))
      .catch((err) => active && setLoadError(apiError.resolve(err, { fallbackKey: 'listings.settings.loadFailed' })))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [apiError, apply]);

  const depth = parseLimit(form.debtDepth);
  const cap = parseLimit(form.dailyCap);
  const depthInvalid = Number.isNaN(depth);
  const minCap = costs?.listingRevealFirst ?? null;
  const capNotWhole = Number.isNaN(cap);
  // Only checked when the price is known — the server judges it either way.
  const capTooLow = cap !== null && !capNotWhole && minCap !== null && cap < minCap;
  const invalid = depthInvalid || capNotWhole || capTooLow;

  const dirty =
    form.onEmpty !== saved.onEmpty ||
    form.debtDepth.trim() !== saved.debtDepth ||
    form.dailyCap.trim() !== saved.dailyCap;

  const handleDiscard = useCallback(() => {
    setError(null);
    setForm(saved);
  }, [saved]);

  const handleSave = useCallback(async () => {
    if (invalid) return;
    setSaving(true);
    setError(null);
    try {
      const next = await saveListingSettings({
        onEmpty: form.onEmpty,
        // A depth of 0 is a floor of 0 — "never below zero". `-0` would read oddly.
        debtFloor: depth === null ? null : depth === 0 ? 0 : -depth,
        maxCreditsPerCustomerPerDay: cap,
      });
      apply(next);
      toast.success(t('listings.settings.saved'));
    } catch (err) {
      setError(apiError.resolve(err, { fallbackKey: 'listings.settings.loadFailed' }));
    } finally {
      setSaving(false);
    }
  }, [invalid, form.onEmpty, depth, cap, apply, apiError, t]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
        {loadError}
      </div>
    );
  }

  return (
    <div>
      <SettingsSections>
        <SettingsSection title={t('listings.settings.onEmptyTitle')} contentClassName="space-y-4">
          <ListingChargingRule className="text-sm text-muted-foreground" />

          {error && (
            <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <RadioGroup
            value={form.onEmpty}
            onValueChange={(v) => setForm((f) => ({ ...f, onEmpty: v as ListingOnEmpty }))}
            className="gap-1"
          >
            {ON_EMPTY.map(({ value, labelKey, hintKey }) => (
              <label
                key={value}
                htmlFor={`on-empty-${value}`}
                className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg py-2"
              >
                <RadioGroupItem id={`on-empty-${value}`} value={value} className="mt-0.5" />
                <span className="space-y-0.5">
                  <span className="block text-sm font-medium">{t(labelKey)}</span>
                  <span className="block text-xs text-muted-foreground">{t(hintKey)}</span>
                </span>
              </label>
            ))}
          </RadioGroup>

          {/* Only meaningful while engaged customers are still served. */}
          {form.onEmpty === 'continue_engaged' && (
            <div className="space-y-2">
              <Label htmlFor="listing-debt-depth">{t('listings.settings.debtFloorLabel')}</Label>
              <UnitInput
                id="listing-debt-depth"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                placeholder={t('listings.settings.noLimit')}
                value={form.debtDepth}
                onChange={(e) => setForm((f) => ({ ...f, debtDepth: e.target.value }))}
                unit={t('listings.settings.unit')}
                invalid={depthInvalid}
                wrapperClassName="w-44"
              />
              <p className={depthInvalid ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
                {depthInvalid ? t('listings.settings.wholeNumber') : t('listings.settings.debtFloorHint')}
              </p>
            </div>
          )}
        </SettingsSection>

        <SettingsSection title={t('listings.settings.dailyCapTitle')} contentClassName="space-y-2">
          <Label htmlFor="listing-daily-cap">{t('listings.settings.dailyCapLabel')}</Label>
          <UnitInput
            id="listing-daily-cap"
            type="number"
            inputMode="numeric"
            min={minCap ?? 0}
            step={1}
            placeholder={t('listings.settings.noLimit')}
            value={form.dailyCap}
            onChange={(e) => setForm((f) => ({ ...f, dailyCap: e.target.value }))}
            unit={t('listings.settings.unit')}
            invalid={capNotWhole || capTooLow}
            wrapperClassName="w-44"
          />
          <p className={capNotWhole || capTooLow ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
            {capNotWhole
              ? t('listings.settings.wholeNumber')
              : capTooLow && minCap !== null
                ? t('listings.settings.dailyCapMin', { min: minCap })
                : t('listings.settings.dailyCapHint')}
          </p>
        </SettingsSection>
      </SettingsSections>

      <UnsavedChangesBar
        visible={dirty || saving}
        saving={saving}
        saveDisabled={invalid}
        onDiscard={handleDiscard}
        onSave={handleSave}
      />
    </div>
  );
}
