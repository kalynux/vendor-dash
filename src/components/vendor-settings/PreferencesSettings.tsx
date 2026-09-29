import { useCallback, useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

import { onboardingService } from '@/services/onboarding.service';
import { useUIStore } from '@/store';
import { LegalLink } from '@/components/common/LegalLink';
import { useTranslation, useApiError } from '@/i18n';
import { UnsavedChangesBar } from '@/components/vendor-settings/UnsavedChangesBar';
import {
  SettingsSection,
  SettingsSections,
} from '@/components/vendor-settings/SettingsSection';
import { Input } from '@/components/ui/input';
import { InfoHint, LabelWithHint } from '@/components/ui/info-hint';
import { Switch } from '@/components/ui/switch';
import { ChoiceChips } from '@/components/ui/choice-chips';
import { UnitInput } from '@/components/ui/unit-input';
import { Skeleton } from '@/components/ui/skeleton';

const MIN_CANCEL_DAYS = 1;
const MAX_CANCEL_DAYS = 90;

export function PreferencesSettings() {
  const { t } = useTranslation();
  const apiError = useApiError();
  const { theme, setTheme } = useUIStore();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-redirect orders to agency.
  const [autoRedirect, setAutoRedirect] = useState(false);
  const [threshold, setThreshold] = useState('');
  // Auto-cancel unpaid orders.
  const [cancelDays, setCancelDays] = useState('');

  // Last-saved snapshot, for dirty checking.
  const [saved, setSaved] = useState({ autoRedirect: false, threshold: '', cancelDays: '' });

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    Promise.all([
      onboardingService.getAutoRedirectOrders(),
      onboardingService.getAutoCancelUnpaidDays(),
    ])
      .then(([redirect, cancel]) => {
        if (!active) return;
        const redirectEnabled = redirect.data.autoRedirectOrdersToAgency;
        const thresholdStr =
          redirect.data.autoRedirectThresholdAmount != null
            ? String(redirect.data.autoRedirectThresholdAmount)
            : '';
        const daysStr = String(cancel.data.autoCancelUnpaidDays);
        setAutoRedirect(redirectEnabled);
        setThreshold(thresholdStr);
        setCancelDays(daysStr);
        setSaved({ autoRedirect: redirectEnabled, threshold: thresholdStr, cancelDays: daysStr });
      })
      .catch((err) => {
        if (active) setLoadError(apiError.resolve(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [apiError]);

  const redirectDirty = autoRedirect !== saved.autoRedirect || threshold !== saved.threshold;
  const cancelDirty = cancelDays !== saved.cancelDays;
  const dirty = redirectDirty || cancelDirty;

  const daysNum = Number(cancelDays);
  const daysInvalid =
    cancelDays.trim() === '' ||
    !Number.isInteger(daysNum) ||
    daysNum < MIN_CANCEL_DAYS ||
    daysNum > MAX_CANCEL_DAYS;

  const thresholdNum = Number(threshold);
  const thresholdInvalid =
    threshold.trim() !== '' && (Number.isNaN(thresholdNum) || thresholdNum < 0);

  const handleDiscard = useCallback(() => {
    setError(null);
    setAutoRedirect(saved.autoRedirect);
    setThreshold(saved.threshold);
    setCancelDays(saved.cancelDays);
  }, [saved]);

  const handleSave = useCallback(async () => {
    if (daysInvalid || thresholdInvalid) return;
    setSaving(true);
    setError(null);
    try {
      let nextRedirect = autoRedirect;
      let nextThreshold = threshold;
      let nextDays = cancelDays;
      if (redirectDirty) {
        const res = await onboardingService.updateAutoRedirectOrders({
          enabled: autoRedirect,
          thresholdAmount: threshold.trim() === '' ? null : thresholdNum,
        });
        nextRedirect = res.data.autoRedirectOrdersToAgency;
        nextThreshold =
          res.data.autoRedirectThresholdAmount != null
            ? String(res.data.autoRedirectThresholdAmount)
            : '';
      }
      if (cancelDirty) {
        const res = await onboardingService.updateAutoCancelUnpaidDays({ days: daysNum });
        nextDays = String(res.data.autoCancelUnpaidDays);
      }
      setAutoRedirect(nextRedirect);
      setThreshold(nextThreshold);
      setCancelDays(nextDays);
      setSaved({ autoRedirect: nextRedirect, threshold: nextThreshold, cancelDays: nextDays });
      toast.success(t('settings.preferences.saved'));
    } catch (err) {
      setError(apiError.resolve(err));
    } finally {
      setSaving(false);
    }
  }, [
    autoRedirect, threshold, thresholdNum, thresholdInvalid,
    cancelDays, daysNum, daysInvalid, redirectDirty, cancelDirty, apiError, t,
  ]);

  const appearanceSection = (
    <SettingsSection
      title={t('settings.preferences.appearance.title')}
      info={t('settings.preferences.appearance.info')}
    >
      <ChoiceChips
        label={t('settings.preferences.appearance.theme')}
        value={theme}
        onChange={setTheme}
        options={[
          { value: 'light', label: t('settings.preferences.appearance.light') },
          { value: 'dark', label: t('settings.preferences.appearance.dark') },
          { value: 'system', label: t('settings.preferences.appearance.system') },
        ]}
      />
    </SettingsSection>
  );

  // Links out to the CDN-hosted documents — nothing to save, so it sits outside
  // the dirty/save machinery and renders the same while the rest loads.
  const legalRows = [
    { doc: 'terms' as const, label: t('settings.preferences.legal.terms') },
    { doc: 'privacy' as const, label: t('settings.preferences.legal.privacy') },
  ];
  const legalSection = (
    <SettingsSection title={t('settings.preferences.legal.title')} contentClassName="divide-y">
      {legalRows.map(({ doc, label }) => (
        <LegalLink
          key={doc}
          doc={doc}
          className="flex min-h-12 items-center justify-between gap-3 text-sm font-medium text-foreground no-underline hover:text-primary"
        >
          <span className="min-w-0">{label}</span>
          <ExternalLink className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </LegalLink>
      ))}
    </SettingsSection>
  );

  if (loading) {
    return (
      <SettingsSections>
        {appearanceSection}
        <SettingsSection
          title={t('settings.preferences.orderAutomation.title')}
          contentClassName="space-y-4"
        >
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </SettingsSection>
        {legalSection}
      </SettingsSections>
    );
  }

  return (
    <>
      <SettingsSections>
        {appearanceSection}
        <SettingsSection
          title={t('settings.preferences.orderAutomation.title')}
          info={t('settings.preferences.orderAutomation.info')}
          contentClassName="space-y-6"
        >
          {(error || loadError) && (
            <div
              role="alert"
              className="p-3 text-sm bg-destructive/10 text-destructive rounded-lg border border-destructive/20"
            >
              {error ?? loadError}
            </div>
          )}

          {/* Auto-redirect orders to agency. The cap only matters while the
              rule is on, so it only shows then. */}
          <div className="space-y-4">
            <div className="flex min-h-11 items-center justify-between gap-4">
              <span className="flex min-w-0 items-center gap-1">
                <span className="text-sm font-medium">{t('settings.preferences.orderAutomation.autoDispatch')}</span>
                <InfoHint label={t('settings.preferences.orderAutomation.autoDispatchHintLabel')}>
                  {t('settings.preferences.orderAutomation.autoDispatchHint')}
                </InfoHint>
              </span>
              <Switch
                checked={autoRedirect}
                onCheckedChange={setAutoRedirect}
                aria-label={t('settings.preferences.orderAutomation.autoDispatch')}
              />
            </div>

            {autoRedirect && (
              <div className="space-y-2">
                <LabelWithHint
                  htmlFor="auto-redirect-threshold"
                  optional
                  hintLabel={t('settings.preferences.orderAutomation.maxOrderTotalHintLabel')}
                  hint={t('settings.preferences.orderAutomation.maxOrderTotalHint')}
                >
                  {t('settings.preferences.orderAutomation.maxOrderTotal')}
                </LabelWithHint>
                <Input
                  id="auto-redirect-threshold"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder={t('settings.preferences.orderAutomation.maxOrderTotalPlaceholder')}
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  aria-invalid={thresholdInvalid}
                  className="h-11"
                />
              </div>
            )}
          </div>

          {/* Auto-cancel unpaid orders — one sentence: "Cancel unpaid orders after [3 days]". */}
          <div className="space-y-2 border-t pt-5">
            <LabelWithHint
              htmlFor="auto-cancel-days"
              hintLabel={t('settings.preferences.orderAutomation.autoCancelHintLabel')}
              hint={t('settings.preferences.orderAutomation.daysBeforeCancelHint', {
                min: MIN_CANCEL_DAYS,
                max: MAX_CANCEL_DAYS,
              })}
            >
              {t('settings.preferences.orderAutomation.autoCancel')}
            </LabelWithHint>
            <UnitInput
              id="auto-cancel-days"
              type="number"
              inputMode="numeric"
              min={MIN_CANCEL_DAYS}
              max={MAX_CANCEL_DAYS}
              unit={t('common.units.daysSuffix')}
              value={cancelDays}
              onChange={(e) => setCancelDays(e.target.value)}
              invalid={daysInvalid}
              wrapperClassName="max-w-[10rem]"
            />
          </div>
        </SettingsSection>
        {legalSection}
      </SettingsSections>

      <UnsavedChangesBar
        visible={dirty || saving}
        saving={saving}
        saveDisabled={daysInvalid || thresholdInvalid}
        onDiscard={handleDiscard}
        onSave={handleSave}
      />
    </>
  );
}
