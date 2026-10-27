import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, ChevronRight, ChevronLeft } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ServiceConfigFields } from '@/components/services/ServiceConfigFields';
import { useTranslation } from '@/i18n';
import {
  serviceSettingsSchema, type ServiceSettingsFormValues,
} from '@/components/services/schemas/service.schemas';
import type { ServiceConfigFormShape } from '@/components/services/service.constants';

interface StepServiceBookingProps {
  defaultValues: ServiceSettingsFormValues;
  isSaving: boolean;
  stepError: string | null;
  onSaveComplete: (values: ServiceSettingsFormValues) => void;
  onBack: () => void;
  mode?: 'create' | 'edit';
  /** The server refused the chosen address — shown under Where, not in the top alert. */
  locationError?: string | null;
}

export function StepServiceBooking({
  defaultValues,
  isSaving,
  stepError,
  onSaveComplete,
  onBack,
  mode = 'create',
  locationError = null,
}: StepServiceBookingProps) {
  const { t } = useTranslation();
  const form = useForm<ServiceSettingsFormValues>({
    resolver: zodResolver(serviceSettingsSchema),
    defaultValues,
  });
  const formRef = useRef<HTMLFormElement>(null);
  // Set when a save is refused and no error line is on screen to say why.
  const [unseenError, setUnseenError] = useState(false);

  // A refused address arrives after the save, often with Where scrolled away.
  useEffect(() => {
    if (!locationError) return;
    requestAnimationFrame(() => {
      document.getElementById('service-where')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [locationError]);

  /**
   * A refused save must always answer. On a phone the error line is usually
   * off screen above the button, so scroll to it; if there is none to scroll
   * to, say so beside the button instead of doing nothing.
   */
  function handleInvalid() {
    // One frame, so the error lines from this attempt are in the page.
    requestAnimationFrame(() => {
      const firstError = formRef.current?.querySelector('[data-field-error]');
      if (firstError) {
        setUnseenError(false);
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        setUnseenError(true);
      }
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        setUnseenError(false);
        return form.handleSubmit(onSaveComplete, handleInvalid)(e);
      }}
      // The phone's own number checks (min, step) block the submit without
      // showing anything in the app's WebView; the schema checks instead.
      noValidate
      className="space-y-6"
    >
      <div>
        <h2 className="text-lg font-semibold">{t('services.booking.settingsTitle')}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t('services.booking.settingsDescription')}
        </p>
      </div>

      {stepError && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{stepError}</AlertDescription>
        </Alert>
      )}

      <ServiceConfigFields
        form={form as unknown as UseFormReturn<ServiceConfigFormShape>}
        locationError={locationError}
      />

      {unseenError && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{t('common.validation.fixHighlighted')}</AlertDescription>
        </Alert>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button type="button" variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ChevronLeft className="w-4 h-4" />
          {t('common.actions.back')}
        </Button>
        <Button type="submit" disabled={isSaving} className="gap-1.5">
          {isSaving
            ? t('common.actions.saving')
            : mode === 'edit'
              ? t('common.actions.save')
              : t('services.wizard.saveAndContinue')}
          {!isSaving && <ChevronRight className="w-4 h-4" />}
        </Button>
      </div>
    </form>
  );
}
