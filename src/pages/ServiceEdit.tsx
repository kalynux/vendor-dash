import { useCallback, useEffect, useReducer } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Package, ImageIcon, Clock, CalendarRange, CheckSquare } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageBackButton } from '@/components/layout/PageBackButton';
import { ProductStepIndicator } from '@/components/products/ProductStepIndicator';
import { StepServiceBasics } from '@/components/services/wizard/StepServiceBasics';
import { StepServiceImages } from '@/components/services/wizard/StepServiceImages';
import { StepServiceBooking } from '@/components/services/wizard/StepServiceBooking';
import { StepServiceAvailability } from '@/components/services/wizard/StepServiceAvailability';
import { StepServiceReview } from '@/components/services/wizard/StepServiceReview';
import {
  fetchServiceById,
  fetchServiceVariant,
  updateService,
  ensureServiceVariant,
  changeServiceStatus,
} from '@/services/services.service';
import { buildServiceConfig, type ServiceConfigFormShape } from '@/components/services/service.constants';
import { DEFAULT_PEAK_HOURS } from '@/components/services/schemas/service.schemas';
import { useTranslation, useApiError } from '@/i18n';
import type {
  ServiceBasicsFormValues,
  ServiceSettingsFormValues,
} from '@/components/services/schemas/service.schemas';
import { descriptionCreateWire, hydrateDoc } from '@/lib/richtext';
import type { ServiceProduct, ServiceConfig } from '@/types/services.types';
import type { TranslationKey } from '@/i18n';

// ─── Step definitions ─────────────────────────────────────────────────────────

type ServiceStep = 'basic-info' | 'images' | 'booking' | 'availability' | 'review';

const STEPS: { id: ServiceStep; labelKey: TranslationKey; icon: React.ElementType }[] = [
  { id: 'basic-info', labelKey: 'services.wizard.stepDetails', icon: Package },
  { id: 'images', labelKey: 'services.wizard.stepImages', icon: ImageIcon },
  { id: 'booking', labelKey: 'services.wizard.stepBooking', icon: Clock },
  { id: 'availability', labelKey: 'services.wizard.stepAvailability', icon: CalendarRange },
  { id: 'review', labelKey: 'services.wizard.stepReview', icon: CheckSquare },
];

const STEP_IDS = STEPS.map((s) => s.id);

function nextStep(current: ServiceStep): ServiceStep | null {
  const idx = STEP_IDS.indexOf(current);
  if (idx < 0 || idx >= STEP_IDS.length - 1) return null;
  return STEP_IDS[idx + 1];
}

function prevStep(current: ServiceStep): ServiceStep | null {
  const idx = STEP_IDS.indexOf(current);
  if (idx <= 0) return null;
  return STEP_IDS[idx - 1];
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

interface ServiceEditState {
  service: ServiceProduct | null;
  price: number | null;
  config: ServiceConfig | null;
  currentStep: ServiceStep;
  isSaving: boolean;
  stepError: string | null;
  loadError: string | null;
}

type ServiceEditAction =
  | { type: 'LOAD_COMPLETE'; service: ServiceProduct; price: number | null; config: ServiceConfig | null }
  | { type: 'LOAD_ERROR'; error: string }
  | { type: 'SET_STEP'; step: ServiceStep }
  | { type: 'SET_SAVING'; value: boolean }
  | { type: 'SET_STEP_ERROR'; error: string }
  | { type: 'SAVE_COMPLETE'; updates: Partial<ServiceEditState> };

const INITIAL_STATE: ServiceEditState = {
  service: null,
  price: null,
  config: null,
  currentStep: 'basic-info',
  isSaving: false,
  stepError: null,
  loadError: null,
};

function reducer(state: ServiceEditState, action: ServiceEditAction): ServiceEditState {
  switch (action.type) {
    case 'LOAD_COMPLETE':
      return {
        ...state,
        service: action.service,
        price: action.price,
        config: action.config,
        loadError: null,
      };
    case 'LOAD_ERROR':
      return { ...state, loadError: action.error };
    case 'SET_STEP':
      return { ...state, currentStep: action.step, stepError: null };
    case 'SET_SAVING':
      return { ...state, isSaving: action.value };
    case 'SET_STEP_ERROR':
      return { ...state, stepError: action.error, isSaving: false };
    case 'SAVE_COMPLETE':
      return { ...state, ...action.updates, isSaving: false, stepError: null };
    default:
      return state;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ServiceEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const apiError = useApiError();
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const [service, variant] = await Promise.all([
          fetchServiceById(id),
          fetchServiceVariant(id),
        ]);
        if (!cancelled) {
          dispatch({
            type: 'LOAD_COMPLETE',
            service,
            price: variant?.price ?? null,
            config: variant?.serviceConfig ?? null,
          });
        }
      } catch (err) {
        if (!cancelled) {
          dispatch({
            type: 'LOAD_ERROR',
            error: apiError.resolve(err, { fallbackKey: 'services.errors.loadServiceFailed' }),
          });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [id, apiError]);

  function advance(updates: Partial<ServiceEditState> = {}) {
    const next = nextStep(state.currentStep);
    dispatch({ type: 'SAVE_COMPLETE', updates: { ...updates, currentStep: next ?? state.currentStep } });
  }

  // ─── Details ─────────────────────────────────────────────────────────────────

  const handleBasicsSave = useCallback(
    async (values: ServiceBasicsFormValues) => {
      if (!id) return;
      dispatch({ type: 'SET_SAVING', value: true });
      try {
        const service = await updateService(id, {
          title: values.title,
          category: values.category,
          ...descriptionCreateWire(values.descriptionRich),
          tags: values.tags,
          seoTitle: values.seoTitle || undefined,
          seoDescription: values.seoDescription || undefined,
        });
        toast.success(t('services.toast.detailsSaved'));
        advance({ service });
      } catch (err) {
        dispatch({
          type: 'SET_STEP_ERROR',
          error: apiError.resolve(err, {
            context: 'service',
            fallbackKey: 'services.errors.saveDetailsFailed',
          }),
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, state.currentStep],
  );

  // ─── Images ───────────────────────────────────────────────────────────────────

  const handleImagesSave = useCallback(
    async (fileIds: string[]) => {
      if (!id) return;
      if (fileIds.length === 0) {
        advance();
        return;
      }
      dispatch({ type: 'SET_SAVING', value: true });
      try {
        const service = await updateService(id, { fileIds });
        toast.success(t('services.toast.imagesSaved'));
        advance({ service });
      } catch (err) {
        dispatch({
          type: 'SET_STEP_ERROR',
          error: apiError.resolve(err, {
            context: 'service',
            fallbackKey: 'services.errors.saveImagesFailed',
          }),
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, state.currentStep],
  );

  // ─── Booking settings ─────────────────────────────────────────────────────────

  const handleBookingSave = useCallback(
    async (values: ServiceSettingsFormValues) => {
      if (!id) return;
      dispatch({ type: 'SET_SAVING', value: true });
      try {
        const config = buildServiceConfig(values as unknown as ServiceConfigFormShape);
        await ensureServiceVariant(id, { price: values.price, serviceConfig: config });
        const service = await fetchServiceById(id); // refresh defaultVariantId for the status pre-flight
        toast.success(t('services.toast.bookingSettingsSaved'));
        advance({ price: values.price, config, service });
      } catch (err) {
        dispatch({
          type: 'SET_STEP_ERROR',
          error: apiError.resolve(err, {
            context: 'service',
            fallbackKey: 'services.errors.saveBookingSettingsFailed',
          }),
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, state.currentStep],
  );

  // ─── Review / publish ─────────────────────────────────────────────────────────

  const handlePublish = useCallback(
    async ({ vectorisationEnabled }: { vectorisationEnabled: boolean }) => {
      if (!id) return;
      // Activation is only vendor-triggerable from draft (allowed-transitions
      // table in products.md) — the Review step hides Publish otherwise; this
      // is a backstop.
      if (state.service && state.service.status !== 'draft') return;
      dispatch({ type: 'SET_SAVING', value: true });
      try {
        // Activate first, THEN set vectorisationEnabled: the enable flow runs an
        // eligibility check (status must be active) — enabling while still a draft
        // would be rejected and silently reset the flag to false.
        await changeServiceStatus(id, 'active');
        await updateService(id, { vectorisationEnabled });
        toast.success(t('services.toast.published'));
        navigate('/dashboard/services');
      } catch (err) {
        dispatch({
          type: 'SET_STEP_ERROR',
          error: apiError.resolve(err, {
            context: 'service',
            fallbackKey: 'services.errors.publishFailed',
          }),
        });
      }
    },
    [id, state.service, navigate, t, apiError],
  );

  const handleSaveDraft = useCallback(
    async ({ vectorisationEnabled }: { vectorisationEnabled: boolean }) => {
      if (!id) return;
      dispatch({ type: 'SET_SAVING', value: true });
      try {
        await updateService(id, { vectorisationEnabled });
        toast.success(t('services.toast.savedAsDraft'));
        navigate('/dashboard/services');
      } catch (err) {
        dispatch({
          type: 'SET_STEP_ERROR',
          error: apiError.resolve(err, {
            context: 'service',
            fallbackKey: 'services.errors.saveFailed',
          }),
        });
      }
    },
    [id, navigate, t, apiError],
  );

  // ─── Navigation ───────────────────────────────────────────────────────────────

  const handleBack = useCallback(() => {
    const prev = prevStep(state.currentStep);
    if (prev) dispatch({ type: 'SET_STEP', step: prev });
    else navigate('/dashboard/services');
  }, [state.currentStep, navigate]);

  // ─── Render ───────────────────────────────────────────────────────────────────

  if (state.loadError) {
    return (
      <div className="max-w-3xl mx-auto space-y-4 px-1">
        <PageBackButton fallbackPath="/dashboard/services" label={t('services.wizard.backToServices')} />
        <div className="rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
          {state.loadError}
        </div>
      </div>
    );
  }

  if (!state.service) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto px-1">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const service = state.service;

  function renderStep() {
    switch (state.currentStep) {
      case 'basic-info':
        return (
          <StepServiceBasics
            mode="edit"
            defaultValues={{
              title: service.title,
              category: service.category,
              description: service.description,
              descriptionRich: hydrateDoc(service.descriptionRich, service.description),
              seoTitle: service.seo?.title ?? '',
              seoDescription: service.seo?.description ?? '',
              tags: service.tags ?? [],
            }}
            isSaving={state.isSaving}
            stepError={state.stepError}
            onSaveComplete={handleBasicsSave}
            onBack={handleBack}
          />
        );
      case 'images':
        return (
          <StepServiceImages
            mode="edit"
            existingFiles={service.files}
            isSaving={state.isSaving}
            stepError={state.stepError}
            onSaveComplete={handleImagesSave}
            onBack={handleBack}
          />
        );
      case 'booking':
        return (
          <StepServiceBooking
            mode="edit"
            defaultValues={{
              durationMinutes: state.config?.durationMinutes ?? 60,
              price: state.price ?? (undefined as unknown as number),
              bookingMode: state.config?.bookingMode ?? 'calendar',
              bufferBeforeMinutes: state.config?.bufferBeforeMinutes ?? 0,
              bufferAfterMinutes: state.config?.bufferAfterMinutes ?? 0,
              maxBookings: state.config?.maxBookings ?? undefined,
              peakHoursEnabled: !!state.config?.peakHours,
              peakHours: state.config?.peakHours
                ? {
                    daysOfWeek: state.config.peakHours.daysOfWeek ?? [],
                    startTime: state.config.peakHours.startTime,
                    endTime: state.config.peakHours.endTime,
                    priceType: state.config.peakHours.priceType,
                    value: state.config.peakHours.value,
                  }
                : { ...DEFAULT_PEAK_HOURS },
            }}
            isSaving={state.isSaving}
            stepError={state.stepError}
            onSaveComplete={handleBookingSave}
            onBack={handleBack}
          />
        );
      case 'availability':
        return (
          <StepServiceAvailability
            productId={service.id}
            onContinue={() => advance()}
            onBack={handleBack}
          />
        );
      case 'review':
        return (
          <StepServiceReview
            service={service}
            price={state.price}
            config={state.config}
            isSaving={state.isSaving}
            stepError={state.stepError}
            onPublish={handlePublish}
            onSaveDraft={handleSaveDraft}
            onBack={handleBack}
          />
        );
      default:
        return null;
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in max-w-3xl mx-auto -mx-6 sm:mx-auto">
      <div className="px-4 sm:px-0">
        <PageBackButton
          fallbackPath="/dashboard/services"
          label={t('services.wizard.backToServices')}
          className="mb-1"
        />
        <h1 className="text-xl sm:text-2xl font-bold">{t('services.wizard.editTitle')}</h1>
        <p className="text-muted-foreground text-xs sm:text-sm mt-1 truncate">{service.title}</p>
      </div>

      <Card className="rounded-none border-x-0 sm:rounded-xl sm:border">
        <CardContent className="p-3 sm:p-4">
          <ProductStepIndicator
            steps={STEPS}
            currentStep={state.currentStep}
            completedSteps={STEP_IDS}
            onStepClick={(stepId) => dispatch({ type: 'SET_STEP', step: stepId as ServiceStep })}
          />
        </CardContent>
      </Card>

      <Card className="rounded-none border-x-0 sm:rounded-xl sm:border">
        <CardContent className="p-4 sm:p-6">{renderStep()}</CardContent>
      </Card>
    </div>
  );
}
