import { useCallback, useEffect, useState } from 'react';
import { Send, Clock, Moon, Sun } from 'lucide-react';
import { toast } from 'sonner';

import { onboardingService } from '@/services/onboarding.service';
import { useUIStore } from '@/store';
import { useTranslation, useApiError } from '@/i18n';
import { UnsavedChangesBar } from '@/components/vendor-settings/UnsavedChangesBar';
import {
  SettingsSection,
  SettingsSections,
} from '@/components/vendor-settings/SettingsSection';
import { Input } from '@/components/ui/input';
import { InfoHint, LabelWithHint } from '@/components/ui/info-hint';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted text-muted-foreground flex-shrink-0">
              {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </div>
            <p className="font-medium">{t('settings.preferences.appearance.theme')}</p>
          </div>
          <Select
            value={theme}
            onValueChange={(v) => setTheme(v as 'light' | 'dark' | 'system')}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">{t('settings.preferences.appearance.light')}</SelectItem>
              <SelectItem value="dark">{t('settings.preferences.appearance.dark')}</SelectItem>
              <SelectItem value="system">{t('settings.preferences.appearance.system')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
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

          {/* Auto-redirect orders to agency */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-muted text-muted-foreground flex-shrink-0">
                  <Send className="w-4 h-4" />
                </div>
                <div className="flex min-w-0 items-center gap-1">
                  <p className="font-medium">{t('settings.preferences.orderAutomation.autoDispatch')}</p>
                  <InfoHint label={t('settings.preferences.orderAutomation.autoDispatchHintLabel')}>
                    {t('settings.preferences.orderAutomation.autoDispatchHint')}
                  </InfoHint>
                </div>
              </div>
              <Switch
                checked={autoRedirect}
                onCheckedChange={setAutoRedirect}
                aria-label={t('settings.preferences.orderAutomation.autoDispatch')}
              />
            </div>

            <div className="space-y-1.5 sm:pl-12">
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
                disabled={!autoRedirect}
                aria-invalid={thresholdInvalid}
              />
            </div>
          </div>

          {/* Auto-cancel unpaid orders */}
          <div className="space-y-1.5 border-t pt-6">
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 rounded-lg bg-muted text-muted-foreground flex-shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div className="flex min-w-0 items-center gap-1">
                <p className="font-medium">{t('settings.preferences.orderAutomation.autoCancel')}</p>
                <InfoHint label={t('settings.preferences.orderAutomation.autoCancelHintLabel')}>
                  {t('settings.preferences.orderAutomation.autoCancelHint')}
                </InfoHint>
              </div>
            </div>
            <div className="sm:pl-12 space-y-1.5">
              <LabelWithHint
                htmlFor="auto-cancel-days"
                hintLabel={t('settings.preferences.orderAutomation.daysBeforeCancelHintLabel')}
                hint={t('settings.preferences.orderAutomation.daysBeforeCancelHint', {
                  min: MIN_CANCEL_DAYS,
                  max: MAX_CANCEL_DAYS,
                })}
              >
                {t('settings.preferences.orderAutomation.daysBeforeCancel')}
              </LabelWithHint>
              <Input
                id="auto-cancel-days"
                type="number"
                inputMode="numeric"
                min={MIN_CANCEL_DAYS}
                max={MAX_CANCEL_DAYS}
                value={cancelDays}
                onChange={(e) => setCancelDays(e.target.value)}
                aria-invalid={daysInvalid}
                className="max-w-[8rem]"
              />
            </div>
          </div>
        </SettingsSection>
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
