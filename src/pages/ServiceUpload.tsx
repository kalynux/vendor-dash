import { useReducer, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Package, ImageIcon, Clock, CalendarRange, CheckSquare } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { EditorPageShell } from '@/components/layout/EditorPageShell';
import { ProductStepIndicator } from '@/components/products/ProductStepIndicator';
import { StepServiceBasics } from '@/components/services/wizard/StepServiceBasics';
import { StepServiceImages } from '@/components/services/wizard/StepServiceImages';
import { StepServiceBooking } from '@/components/services/wizard/StepServiceBooking';
import { StepServiceAvailability } from '@/components/services/wizard/StepServiceAvailability';
import { StepServiceReview } from '@/components/services/wizard/StepServiceReview';
import {
  createService,
  updateService,
  ensureServiceVariant,
  changeServiceStatus,
  fetchServiceById,
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

function nextStep(current: ServiceStep): ServiceStep | null {
  const idx = STEPS.findIndex((s) => s.id === current);
  if (idx < 0 || idx >= STEPS.length - 1) return null;
  return STEPS[idx + 1].id;
}

function prevStep(current: ServiceStep): ServiceStep | null {
  const idx = STEPS.findIndex((s) => s.id === current);
  if (idx <= 0) return null;
  return STEPS[idx - 1].id;
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

interface ServiceWizardState {
  serviceId: string | null;
  service: ServiceProduct | null;
  price: number | null;
  config: ServiceConfig | null;
  currentStep: ServiceStep;
  completedSteps: ServiceStep[];
  isSaving: boolean;
  stepError: string | null;
}

type ServiceWizardAction =
  | { type: 'SET_STEP'; step: ServiceStep }
  | { type: 'SET_SAVING'; value: boolean }
  | { type: 'SET_STEP_ERROR'; error: string }
  | { type: 'SAVE_COMPLETE'; updates: Partial<ServiceWizardState> };

const INITIAL_STATE: ServiceWizardState = {
  serviceId: null,
  service: null,
  price: null,
  config: null,
  currentStep: 'basic-info',
  completedSteps: [],
  isSaving: false,
  stepError: null,
};

function wizardReducer(state: ServiceWizardState, action: ServiceWizardAction): ServiceWizardState {
  switch (action.type) {
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

export function ServiceUpload() {
  const [state, dispatch] = useReducer(wizardReducer, INITIAL_STATE);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const apiError = useApiError();

  function advance(updates: Partial<ServiceWizardState> = {}) {
    const next = nextStep(state.currentStep);
    dispatch({
      type: 'SAVE_COMPLETE',
      updates: {
        ...updates,
        currentStep: next ?? state.currentStep,
        completedSteps: state.completedSteps.includes(state.currentStep)
          ? state.completedSteps
          : [...state.completedSteps, state.currentStep],
      },
    });
  }

  // ─── Details ─────────────────────────────────────────────────────────────────

  const handleBasicsSave = useCallback(
    async (values: ServiceBasicsFormValues) => {
      dispatch({ type: 'SET_SAVING', value: true });
      try {
        const payload = {
          title: values.title,
          category: values.category,
          ...descriptionCreateWire(values.descriptionRich),
          tags: values.tags,
          seoTitle: values.seoTitle || undefined,
          seoDescription: values.seoDescription || undefined,
        };
        // Idempotent: create on first save, update when revisiting the step.
        const service = state.serviceId
          ? await updateService(state.serviceId, payload)
          : await createService(payload);
        advance({ service, serviceId: service.id });
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
    [state.serviceId, state.currentStep, state.completedSteps],
  );

  // ─── Images ───────────────────────────────────────────────────────────────────

  const handleImagesSave = useCallback(
    async (fileIds: string[]) => {
      const serviceId = state.serviceId;
      if (!serviceId) return;
      // Nothing picked — just move on (images are optional).
      if (fileIds.length === 0) {
        advance();
        return;
      }
      dispatch({ type: 'SET_SAVING', value: true });
      try {
        const service = await updateService(serviceId, { fileIds });
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
    [state.serviceId, state.currentStep, state.completedSteps],
  );

  // ─── Booking settings ─────────────────────────────────────────────────────────

  const handleBookingSave = useCallback(
    async (values: ServiceSettingsFormValues) => {
      const serviceId = state.serviceId;
      if (!serviceId) return;

      dispatch({ type: 'SET_SAVING', value: true });
      try {
        const config = buildServiceConfig(values as unknown as ServiceConfigFormShape);
        await ensureServiceVariant(serviceId, { price: values.price, serviceConfig: config });
        // Refresh the product so `defaultVariantId` (auto-set on first variant) is
        // current for the Review step's activation pre-flight.
        const service = await fetchServiceById(serviceId);
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
    [state.serviceId, state.currentStep, state.completedSteps],
  );

  // ─── Availability ───────────────────────────────────────────────────────────

  const handleAvailabilityContinue = useCallback(() => {
    advance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.currentStep, state.completedSteps]);

  // ─── Review / publish ─────────────────────────────────────────────────────────

  const handlePublish = useCallback(
    async ({ vectorisationEnabled }: { vectorisationEnabled: boolean }) => {
      const serviceId = state.serviceId;
      if (!serviceId) return;
      dispatch({ type: 'SET_SAVING', value: true });
      try {
        // Activate first, THEN set vectorisationEnabled: the enable flow runs an
        // eligibility check (status must be active) — enabling while still a draft
        // would be rejected and silently reset the flag to false.
        await changeServiceStatus(serviceId, 'active');
        await updateService(serviceId, { vectorisationEnabled });
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
    [state.serviceId, navigate, t, apiError],
  );

  const handleSaveDraft = useCallback(
    async ({ vectorisationEnabled }: { vectorisationEnabled: boolean }) => {
      const serviceId = state.serviceId;
      if (!serviceId) return;
      // The service already exists as a draft (created in step 1); persist the
      // vectorisation preference before leaving.
      dispatch({ type: 'SET_SAVING', value: true });
      try {
        await updateService(serviceId, { vectorisationEnabled });
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
    [state.serviceId, navigate, t, apiError],
  );

  // ─── Navigation ───────────────────────────────────────────────────────────────

  const handleBack = useCallback(() => {
    const prev = prevStep(state.currentStep);
    if (prev) {
      dispatch({ type: 'SET_STEP', step: prev });
    } else {
      // Back on the first step leaves the wizard.
      navigate('/dashboard/services');
    }
  }, [state.currentStep, navigate]);

  // ─── Render ───────────────────────────────────────────────────────────────────

  function renderStep() {
    switch (state.currentStep) {
      case 'basic-info':
        return (
          <StepServiceBasics
            defaultValues={{
              title: state.service?.title ?? '',
              category: state.service?.category ?? '',
              description: state.service?.description ?? '',
              descriptionRich: hydrateDoc(
                state.service?.descriptionRich,
                state.service?.description,
              ),
              seoTitle: state.service?.seo?.title ?? '',
              seoDescription: state.service?.seo?.description ?? '',
              tags: state.service?.tags ?? [],
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
            existingFiles={state.service?.files ?? []}
            isSaving={state.isSaving}
            stepError={state.stepError}
            onSaveComplete={handleImagesSave}
            onBack={handleBack}
          />
        );
      case 'booking':
        return (
          <StepServiceBooking
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
        return state.serviceId ? (
          <StepServiceAvailability
            productId={state.serviceId}
            onContinue={handleAvailabilityContinue}
            onBack={handleBack}
          />
        ) : null;
      case 'review':
        return (
          <StepServiceReview
            service={state.service}
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
    <EditorPageShell
      title={t('services.wizard.createTitle')}
      description={t('services.wizard.createSubtitle')}
      backTo="/dashboard/services"
      backLabel={t('services.wizard.backToServices')}
    >
      <Card className="rounded-none border-x-0 md:rounded-xl md:border">
        <CardContent className="p-3 sm:p-4">
          <ProductStepIndicator
            steps={STEPS}
            currentStep={state.currentStep}
            completedSteps={state.completedSteps}
            onStepClick={(stepId) => {
              if (state.completedSteps.includes(stepId as ServiceStep)) {
                dispatch({ type: 'SET_STEP', step: stepId as ServiceStep });
              }
            }}
          />
        </CardContent>
      </Card>

      <Card className="rounded-none border-x-0 md:rounded-xl md:border">
        <CardContent className="p-4 sm:p-6">{renderStep()}</CardContent>
      </Card>
    </EditorPageShell>
  );
}
