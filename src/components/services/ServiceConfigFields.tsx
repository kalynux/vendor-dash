import { Link } from 'react-router-dom';
import { Controller, type UseFormReturn } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { ChoiceChips } from '@/components/ui/choice-chips';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { useTranslation, useMessage, type TranslationKey } from '@/i18n';
import { AccessDetailsInputs } from '@/components/services/BookingAccessEditor';
import {
  BOOKING_MODES, DURATION_PRESETS, DAY_ORDER, DAY_SHORT_KEYS,
  type ServiceConfigFormShape,
} from '@/components/services/service.constants';
import type { DayOfWeek, ServiceLocationKind } from '@/types/services.types';

const LOCATION_KINDS: { value: ServiceLocationKind; labelKey: TranslationKey; helpKey: TranslationKey }[] = [
  { value: 'vendor_address', labelKey: 'services.location.kinds.vendorAddress', helpKey: 'services.location.help.vendorAddress' },
  { value: 'customer_address', labelKey: 'services.location.kinds.customerAddress', helpKey: 'services.location.help.customerAddress' },
  { value: 'online', labelKey: 'services.location.kinds.online', helpKey: 'services.location.help.online' },
];

interface ServiceConfigFieldsProps {
  // Typed to the shared shape; call sites pass their form cast to this shape.
  form: UseFormReturn<ServiceConfigFormShape>;
  /** The server refused the chosen address (`…LOCATION_ADDRESS_MISSING`) — shown under Where. */
  locationError?: string | null;
}

/**
 * Shared booking-settings editor: session duration, price (base rate per unit),
 * booking mode, capacity seats, buffers, and an optional peak-hours surcharge.
 * Used by the Booking step in the service create + edit pages (StepServiceBooking).
 */
export function ServiceConfigFields({ form, locationError }: ServiceConfigFieldsProps) {
  const { t } = useTranslation();
  const m = useMessage();
  const { session } = useOnboarding();
  const { register, control, watch, setValue, formState: { errors } } = form;
  const bookingMode = watch('bookingMode');
  const peakEnabled = watch('peakHoursEnabled');
  const peakDays = watch('peakHours.daysOfWeek') ?? [];
  const locationKind = watch('locationKind');
  const addresses = (session?.role_entity.business_addresses ?? []).filter((a) => !!a._id);

  const revealValue = watch('revealMinutesBefore');
  // Re-check as they type only once a save has been tried — like the rest of the form.
  const accessOpts = { shouldDirty: true, shouldValidate: form.formState.isSubmitted };

  function chooseLocation(kind: ServiceLocationKind) {
    setValue('locationKind', kind, { shouldDirty: true, shouldValidate: form.formState.isSubmitted });
    // One address → nothing to choose.
    if (kind === 'vendor_address' && !watch('vendorAddressId') && addresses.length === 1) {
      setValue('vendorAddressId', addresses[0]._id as string, { shouldDirty: true });
    }
  }

  function toggleDay(day: DayOfWeek) {
    const next = peakDays.includes(day)
      ? peakDays.filter((d) => d !== day)
      : [...peakDays, day];
    setValue('peakHours.daysOfWeek', next, { shouldDirty: true });
  }

  return (
    <div className="space-y-4">
      {/* Session duration */}
      <Field label={t('services.config.durationLabel')} error={m(errors.durationMinutes?.message)} required>
        <Controller
          control={control}
          name="durationMinutes"
          render={({ field }) => (
            <>
              <div className="flex flex-wrap gap-1.5">
                {DURATION_PRESETS.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => field.onChange(d.value)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-sm transition-colors',
                      field.value === d.value
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'hover:bg-accent',
                    )}
                  >
                    {t(d.labelKey)}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  className="w-28"
                  value={Number.isFinite(field.value) ? field.value : ''}
                  onChange={(e) => field.onChange(e.target.valueAsNumber)}
                />
                <span className="text-sm text-muted-foreground">{t('services.config.durationUnit')}</span>
              </div>
            </>
          )}
        />
      </Field>

      {/* Price (base rate) */}
      <Field label={t('services.config.priceLabel')} error={m(errors.price?.message)} required>
        <Input type="number" min={0} step="0.01" placeholder="0" {...register('price', { valueAsNumber: true })} />
        <p className="mt-1 text-xs text-muted-foreground">
          {t('services.config.priceHelp', {
            duration: watch('durationMinutes') || t('common.labels.emptyValue'),
          })}
        </p>
      </Field>

      {/* Booking mode */}
      <Field label={t('services.config.modeLabel')} error={m(errors.bookingMode?.message)}>
        <Controller
          control={control}
          name="bookingMode"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BOOKING_MODES.map((mode) => (
                  <SelectItem key={mode.value} value={mode.value}>{t(mode.labelKey)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          {(() => {
            const mode = BOOKING_MODES.find((option) => option.value === bookingMode);
            return mode ? t(mode.descriptionKey) : null;
          })()}
        </p>
      </Field>

      {/* Capacity seats — only for capacity mode */}
      {bookingMode === 'capacity' && (
        <Field label={t('services.config.seatsLabel')} error={m(errors.maxBookings?.message)} required>
          <Input
            type="number"
            min={1}
            className="w-32"
            placeholder={t('services.config.seatsPlaceholder')}
            {...register('maxBookings', { setValueAs: blankToUndefined })}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {t('services.config.seatsHelp')}
          </p>
        </Field>
      )}

      {/* Where it happens — one place per service. */}
      <div id="service-where" className="space-y-1.5">
        <Label className="text-sm">
          {t('services.location.whereLabel')}
          <span className="ml-0.5 text-destructive">*</span>
        </Label>
        <ChoiceChips<ServiceLocationKind>
          label={t('services.location.whereLabel')}
          value={locationKind || null}
          onChange={chooseLocation}
          options={LOCATION_KINDS.map((k) => ({ value: k.value, label: t(k.labelKey) }))}
        />
        {locationKind && (
          <p className="text-xs text-muted-foreground">
            {t(LOCATION_KINDS.find((k) => k.value === locationKind)!.helpKey)}
          </p>
        )}
        {errors.locationKind?.message && (
          <p data-field-error className="text-xs text-destructive">{m(errors.locationKind.message)}</p>
        )}

        {locationKind === 'vendor_address' && (
          addresses.length === 0 ? (
            <div className="space-y-2 pt-1">
              <p className="text-sm text-muted-foreground">{t('services.location.noAddresses')}</p>
              <Button asChild variant="outline" className="max-md:h-11 max-md:w-full">
                <Link to="/dashboard/account/addresses">{t('services.location.goToAddresses')}</Link>
              </Button>
            </div>
          ) : (
            <div className="pt-1">
              <Controller
                control={control}
                name="vendorAddressId"
                render={({ field }) => (
                  <Select value={field.value || undefined} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full" aria-label={t('services.location.addressLabel')}>
                      <SelectValue placeholder={t('services.location.addressPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {addresses.map((addr) => (
                        <SelectItem key={addr._id} value={addr._id as string}>
                          {[addr.label, [addr.address_line1, addr.city].filter(Boolean).join(', ')]
                            .filter(Boolean)
                            .join(' — ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )
        )}
        {errors.vendorAddressId?.message && (
          <p data-field-error className="text-xs text-destructive">{m(errors.vendorAddressId.message)}</p>
        )}
        {locationError && <p data-field-error className="text-xs text-destructive">{locationError}</p>}
      </div>

      {/* Access details — private, copied onto every new booking. */}
      <div className="space-y-3 border-t pt-4">
        <div>
          <p className="text-sm font-medium">{t('services.access.title')}</p>
          <p className="text-xs text-muted-foreground">{t('services.access.serviceHelp')}</p>
        </div>
        <AccessDetailsInputs
          meetingUrl={watch('meetingUrl') ?? ''}
          instructions={watch('instructions') ?? ''}
          reveal={revealValue == null ? '' : String(revealValue)}
          onMeetingUrl={(v) => setValue('meetingUrl', v, accessOpts)}
          onInstructions={(v) => setValue('instructions', v, accessOpts)}
          onReveal={(v) => setValue('revealMinutesBefore', blankToUndefined(v), accessOpts)}
          errors={{
            meetingUrl: m(errors.meetingUrl?.message),
            instructions: m(errors.instructions?.message),
            revealMinutesBefore: m(errors.revealMinutesBefore?.message),
          }}
        />
      </div>

      {/* Buffers */}
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('services.config.bufferBefore')} error={m(errors.bufferBeforeMinutes?.message)}>
          <Input type="number" min={0} {...register('bufferBeforeMinutes', { setValueAs: blankToUndefined })} />
        </Field>
        <Field label={t('services.config.bufferAfter')} error={m(errors.bufferAfterMinutes?.message)}>
          <Input type="number" min={0} {...register('bufferAfterMinutes', { setValueAs: blankToUndefined })} />
        </Field>
      </div>

      {/* Peak-hours surcharge */}
      <div className="rounded-lg border">
        <div className="flex items-center justify-between gap-3 p-3">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{t('services.config.peakTitle')}</p>
            <p className="text-xs text-muted-foreground">{t('services.config.peakHelp')}</p>
          </div>
          <Controller
            control={control}
            name="peakHoursEnabled"
            render={({ field }) => (
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            )}
          />
        </div>

        {peakEnabled && (
          <div className="space-y-3 border-t p-3">
            <div className="space-y-1.5">
              <Label className="text-sm">{t('services.config.peakDays')}</Label>
              <div className="flex flex-wrap gap-1.5">
                {DAY_ORDER.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(d)}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-xs transition-colors',
                      peakDays.includes(d)
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'hover:bg-accent',
                    )}
                  >
                    {t(DAY_SHORT_KEYS[d])}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {t('services.config.peakDaysHelp')}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t('services.config.peakStart')} error={m(errors.peakHours?.startTime?.message)}>
                <Input type="time" {...register('peakHours.startTime')} />
              </Field>
              <Field label={t('services.config.peakEnd')} error={m(errors.peakHours?.endTime?.message)}>
                <Input type="time" {...register('peakHours.endTime')} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t('services.config.peakType')}>
                <Controller
                  control={control}
                  name="peakHours.priceType"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">{t('services.config.peakTypePercentage')}</SelectItem>
                        <SelectItem value="fixed">{t('services.config.peakTypeFixed')}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field
                label={
                  watch('peakHours.priceType') === 'fixed'
                    ? t('services.config.peakAmount')
                    : t('services.config.peakPercent')
                }
                error={m(errors.peakHours?.value?.message)}
              >
                <Input type="number" min={0} step="0.01" {...register('peakHours.value', { setValueAs: blankToUndefined })} />
              </Field>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * A cleared number box means "no value", not `NaN`.
 *
 * `valueAsNumber` turned an emptied box into `NaN`, which the schema rejected
 * outright — and for a box that is hidden (seats outside capacity mode, the
 * surcharge once peak hours are switched off) that rejection had no line to
 * show on, so Save silently did nothing.
 */
function blankToUndefined(value: unknown): number | undefined {
  if (value === '' || value == null) return undefined;
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
}

// Local field wrapper (mirrors the create/detail sheet helpers).
function Field({
  label, error, required, children,
}: { label: string; error?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
      {/* `data-field-error` is how a refused save finds the line to scroll to. */}
      {error && <p data-field-error className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
