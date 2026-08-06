import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { SettingsSection } from '@/components/vendor-settings/SettingsSection';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LabelWithHint } from '@/components/ui/info-hint';
import { toast } from 'sonner';
import { fetchBillingSettings, updateBillingSettings } from '@/services/billing.service';
import { useTranslation, useMessage, useApiError } from '@/i18n';
import { CardSkeleton } from './BillingSkeletons';
import { NOTIFY_DAYS_MIN, NOTIFY_DAYS_MAX } from './billing.constants';

// Messages are translation keys, resolved at render by `useMessage()` — the
// schema is built at module load, before any locale exists.
const schema = z.object({
  notifyDaysBeforeExpiry: z
    .number({ message: 'billing.validation.daysRequired' })
    .int('billing.validation.daysInteger')
    .min(NOTIFY_DAYS_MIN, 'billing.validation.daysMin')
    .max(NOTIFY_DAYS_MAX, 'billing.validation.daysMax'),
});

type FormValues = z.infer<typeof schema>;

export function BillingSettingsCard() {
  const { t } = useTranslation();
  const m = useMessage();
  const apiError = useApiError();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { notifyDaysBeforeExpiry: 7 },
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const settings = await fetchBillingSettings();
        if (!cancelled) reset({ notifyDaysBeforeExpiry: settings.notifyDaysBeforeExpiry });
      } catch (err) {
        if (!cancelled) {
          setLoadError(apiError.resolve(err, { fallbackKey: 'billing.errors.loadSettingsFailed' }));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reset, apiError]);

  async function onSubmit(values: FormValues) {
    try {
      const updated = await updateBillingSettings(values.notifyDaysBeforeExpiry);
      reset({ notifyDaysBeforeExpiry: updated.notifyDaysBeforeExpiry });
      toast.success(t('billing.toast.settingsUpdated'));
    } catch (err) {
      apiError.toast(err, { fallbackKey: 'billing.errors.updateSettingsFailed' });
    }
  }

  if (loading) return <CardSkeleton lines={2} />;

  return (
    <SettingsSection
      title={t('billing.settings.title')}
      info={t('billing.settings.info', { min: NOTIFY_DAYS_MIN, max: NOTIFY_DAYS_MAX })}
    >
        {loadError ? (
          <p className="text-sm text-destructive">{loadError}</p>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-1.5 sm:max-w-[200px]">
              <LabelWithHint
                htmlFor="notify-days"
                hintLabel={t('billing.settings.hintLabel')}
                hint={t('billing.settings.hint', { min: NOTIFY_DAYS_MIN, max: NOTIFY_DAYS_MAX })}
              >
                {t('billing.settings.daysLabel')}
              </LabelWithHint>
              <Input
                id="notify-days"
                type="number"
                min={NOTIFY_DAYS_MIN}
                max={NOTIFY_DAYS_MAX}
                {...register('notifyDaysBeforeExpiry', { valueAsNumber: true })}
                aria-invalid={!!errors.notifyDaysBeforeExpiry}
              />
              {errors.notifyDaysBeforeExpiry && (
                <p className="text-xs text-destructive">
                  {m(errors.notifyDaysBeforeExpiry.message)}
                </p>
              )}
            </div>
            <Button type="submit" disabled={isSubmitting || !isDirty}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common.actions.save')}
            </Button>
          </form>
        )}
    </SettingsSection>
  );
}
