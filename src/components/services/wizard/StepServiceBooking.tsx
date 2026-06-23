import { useForm } from 'react-hook-form';
import type { UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, ChevronRight, ChevronLeft } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ServiceConfigFields } from '@/components/services/ServiceConfigFields';
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
}

export function StepServiceBooking({
  defaultValues,
  isSaving,
  stepError,
  onSaveComplete,
  onBack,
  mode = 'create',
}: StepServiceBookingProps) {
  const form = useForm<ServiceSettingsFormValues>({
    resolver: zodResolver(serviceSettingsSchema),
    defaultValues,
  });

  return (
    <form onSubmit={form.handleSubmit(onSaveComplete)} className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Booking settings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Set the session length, price, and how customers can book this service.
        </p>
      </div>

      {stepError && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{stepError}</AlertDescription>
        </Alert>
      )}

      <ServiceConfigFields form={form as unknown as UseFormReturn<ServiceConfigFormShape>} />

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button type="button" variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ChevronLeft className="w-4 h-4" />
          Back
        </Button>
        <Button type="submit" disabled={isSaving} className="gap-1.5">
          {isSaving ? 'Saving…' : mode === 'edit' ? 'Save' : 'Save & Continue'}
          {!isSaving && <ChevronRight className="w-4 h-4" />}
        </Button>
      </div>
    </form>
  );
}
