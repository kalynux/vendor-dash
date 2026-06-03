import { useReducer, useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertCircle, Box, Package, ImageIcon, Tag, FileDigit, CheckSquare } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ProductStepIndicator } from '@/components/products/ProductStepIndicator';
import { StepTypeSelect } from '@/components/products/steps/StepTypeSelect';
import { StepBasicInfo } from '@/components/products/steps/StepBasicInfo';
import { StepMedia } from '@/components/products/steps/StepMedia';
import { StepVariants } from '@/components/products/steps/StepVariants';
import { StepDigitalFormats } from '@/components/products/steps/StepDigitalFormats';
import { StepReview } from '@/components/products/steps/StepReview';
import {
  fetchProductById,
  fetchVariants,
  fetchOptions,
  updateProduct,
  createOption,
  bulkAddOptionValues,
  createVariant,
  updateVariant,
  archiveVariant,
  deleteOption,
  deleteOptionValue,
  setDefaultVariant,
  uploadVariantAsset,
  replaceVariantAsset,
  removeVariantAsset,
  updateProductStatus,
  renameOption,
  renameOptionValue,
  reorderOptions,
} from '@/services/products.service';
import { ACTIVATION_ERROR_MAP } from '@/services/products.service';
import { getUploadErrorMessage } from '@/lib/uploadErrors';
import type {
  WizardState,
  WizardAction,
  WizardStep,
  ApiProductType,
  DigitalFormatRow,
  ApiFileDetail,
} from '@/types/product.types';
import { getProductFileCount } from '@/types/product.types';
import type { BasicInfoFormValues } from '@/components/products/schemas/product.schemas';
import type { VariantPhase1Payload, VariantPhase2Payload } from '@/components/products/variants';

// ─── Step definitions ─────────────────────────────────────────────────────────

const PHYSICAL_STEPS: { id: WizardStep; label: string; icon: React.ElementType }[] = [
  { id: 'type', label: 'Type', icon: Box },
  { id: 'basic-info', label: 'Basic Info', icon: Package },
  { id: 'media', label: 'Media', icon: ImageIcon },
  { id: 'options-variants', label: 'Variants', icon: Tag },
  { id: 'review', label: 'Review', icon: CheckSquare },
];

const DIGITAL_STEPS: { id: WizardStep; label: string; icon: React.ElementType }[] = [
  { id: 'type', label: 'Type', icon: Box },
  { id: 'basic-info', label: 'Basic Info', icon: Package },
  { id: 'media', label: 'Media', icon: ImageIcon },
  { id: 'formats', label: 'Formats', icon: FileDigit },
  { id: 'review', label: 'Review', icon: CheckSquare },
];

// ─── Reducer ──────────────────────────────────────────────────────────────────

const INITIAL_STATE: WizardState = {
  productId: null,
  productType: null,
  serverProduct: null,
  serverVariants: [],
  serverOptions: [],
  currentStep: 'basic-info',
  completedSteps: ['type'],
  isSaving: false,
  stepError: null,
  pendingMediaFiles: [],
  variantMode: 'options',
};

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SET_PRODUCT_TYPE':
      return { ...state, productType: action.productType };
    case 'SET_STEP':
      return { ...state, currentStep: action.step, stepError: null };
    case 'SET_SAVING':
      return { ...state, isSaving: action.value };
    case 'SET_STEP_ERROR':
      return { ...state, stepError: action.error, isSaving: false };
    case 'SAVE_COMPLETE':
      return { ...state, ...action.updates, isSaving: false, stepError: null };
    case 'SET_PENDING_MEDIA':
      return { ...state, pendingMediaFiles: action.files };
    case 'SET_VARIANT_MODE':
      return { ...state, variantMode: action.mode };
    case 'SET_SERVER_VARIANTS':
      return { ...state, serverVariants: action.variants };
    case 'SET_SERVER_OPTIONS':
      return { ...state, serverOptions: action.options };
    case 'LOAD_COMPLETE':
      return {
        ...state,
        serverProduct: action.product,
        serverVariants: action.variants,
        serverOptions: action.options,
        productId: action.product.id,
        productType: action.product.type,
        variantMode: action.options.length > 0 ? 'matrix' : 'options',
        completedSteps: buildCompletedSteps(action.product.type, action.variants, action.options, action.product),
        isSaving: false,
      };
    default:
      return state;
  }
}

function buildCompletedSteps(
  type: ApiProductType,
  variants: WizardState['serverVariants'],
  _options: WizardState['serverOptions'],
  product: NonNullable<WizardState['serverProduct']>,
): WizardStep[] {
  const steps: WizardStep[] = ['type', 'basic-info'];
  if (getProductFileCount(product) > 0) steps.push('media');
  if (type === 'physical') {
    if (variants.length > 0) steps.push('options-variants');
  } else {
    if (variants.length > 0) steps.push('formats');
  }
  return steps;
}

function getSteps(productType: ApiProductType | null) {
  if (productType === 'digital') return DIGITAL_STEPS;
  if (productType === 'physical') return PHYSICAL_STEPS;
  return PHYSICAL_STEPS;
}

function prevStep(current: WizardStep, productType: ApiProductType | null): WizardStep | null {
  const steps = getSteps(productType);
  const idx = steps.findIndex((s) => s.id === current);
  if (idx <= 1) return null;
  return steps[idx - 1].id;
}

function nextStep(current: WizardStep, productType: ApiProductType | null): WizardStep | null {
  const steps = getSteps(productType);
  const idx = steps.findIndex((s) => s.id === current);
  if (idx < 0 || idx >= steps.length - 1) return null;
  return steps[idx + 1].id;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProductEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(wizardReducer, INITIAL_STATE);
  // Session-local variant image overrides (persisted immediately server-side;
  // kept here so the matrix shows current images after a step remount).
  const [variantImageEdits, setVariantImageEdits] = useState<Record<string, ApiFileDetail[]>>({});

  const handleVariantImagesChange = useCallback(
    (variantId: string, files: ApiFileDetail[]) => {
      setVariantImageEdits((prev) => ({ ...prev, [variantId]: files }));
    },
    [],
  );

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      try {
        const [product, variants, options] = await Promise.all([
          fetchProductById(id!),
          fetchVariants(id!),
          fetchOptions(id!),
        ]);
        if (!cancelled) {
          dispatch({ type: 'LOAD_COMPLETE', product, variants, options });
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Failed to load product.';
          dispatch({ type: 'SET_STEP_ERROR', error: msg });
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [id]);

  const steps = getSteps(state.productType);
  const isLockedForVectorisation =
    state.serverProduct?.vectorisationStatus === 'pending';

  function advance(updates: Partial<WizardState> = {}) {
    const next = nextStep(state.currentStep, state.productType);
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

  // ─── Basic info ──────────────────────────────────────────────────────────────

  const handleBasicInfoSave = useCallback(
    async (updates: Partial<WizardState> & { _basicInfoValues?: BasicInfoFormValues }) => {
      const values = updates._basicInfoValues;
      const productId = state.productId;
      if (!values || !productId) return;

      dispatch({ type: 'SET_SAVING', value: true });
      try {
        const updated = await updateProduct(productId, {
          title: values.title,
          category: values.category,
          description: values.description,
          tags: values.tags,
          seoTitle: values.seoTitle || undefined,
          seoDescription: values.seoDescription || undefined,
        });
        toast.success('Product info saved.');
        advance({ serverProduct: updated });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to save.';
        dispatch({ type: 'SET_STEP_ERROR', error: msg });
      }
    },
    [state.productId, state.currentStep, state.completedSteps],
  );

  // ─── Media ───────────────────────────────────────────────────────────────────

  const handleMediaSave = useCallback(
    async (updates: Partial<WizardState> & { _mediaFileIds?: string[] }) => {
      const productId = state.productId;
      if (!productId) return;

      // Picker selections are already-uploaded library files — just persist the
      // ordered fileIds. The backend reconciles usageCount against the diff.
      const fileIds = updates._mediaFileIds ?? [];

      dispatch({ type: 'SET_SAVING', value: true });
      try {
        const updated = await updateProduct(productId, { fileIds });
        toast.success('Media saved.');
        advance({ serverProduct: updated });
      } catch (err: unknown) {
        dispatch({ type: 'SET_STEP_ERROR', error: getUploadErrorMessage(err) });
      }
    },
    [state.productId, state.currentStep, state.completedSteps],
  );

  // ─── Variants (physical) ─────────────────────────────────────────────────────

  const handleVariantsSave = useCallback(
    async (
      updates: Partial<WizardState> & {
        _phase1?: VariantPhase1Payload;
        _phase2?: VariantPhase2Payload;
        _resetToOptions?: true;
      },
    ) => {
      const productId = state.productId;
      if (!productId) return;

      if (updates._resetToOptions) {
        dispatch({ type: 'SET_VARIANT_MODE', mode: 'options' });
        return;
      }

      // ── Phase 1: apply option structure changes ────────────────────────
      if (updates._phase1) {
        const {
          variantsToArchive,
          optionsToDelete,
          valuesToDelete,
          optionsToCreate,
          valuesToAdd,
          optionsToRename,
          valuesToRename,
          optionIdsForReorder,
        } = updates._phase1;

        dispatch({ type: 'SET_SAVING', value: true });
        try {
          // 1. DESTRUCTIVE — archive variants before deletion
          for (const variantId of variantsToArchive) {
            await archiveVariant(productId, variantId);
          }

          // 2. DESTRUCTIVE — delete removed option values
          for (const { optionServerId, valueServerId } of valuesToDelete) {
            await deleteOptionValue(productId, optionServerId, valueServerId);
          }

          // 3. DESTRUCTIVE — delete removed options (cascades values)
          for (const optionServerId of optionsToDelete) {
            await deleteOption(productId, optionServerId);
          }

          // 4. ADDITIVE — create new options + values
          for (const { name, values } of optionsToCreate) {
            const created = await createOption(productId, { name });
            if (values.length > 0) {
              await bulkAddOptionValues(productId, created.id, values);
            }
          }

          // 5. ADDITIVE — add new values to existing options
          for (const { optionServerId, values } of valuesToAdd) {
            if (values.length > 0) {
              await bulkAddOptionValues(productId, optionServerId, values);
            }
          }

          // 6. SAFE RENAMES — rename options
          for (const { optionServerId, name } of optionsToRename) {
            await renameOption(productId, optionServerId, name);
          }

          // 7. SAFE RENAMES — rename option values
          for (const { optionServerId, valueServerId, newValue } of valuesToRename) {
            await renameOptionValue(productId, optionServerId, valueServerId, newValue);
          }

          // 8. REORDER — atomic position update
          if (optionIdsForReorder && optionIdsForReorder.length > 0) {
            await reorderOptions(productId, optionIdsForReorder);
          }

          // 9. REFRESH — fetch fresh server state
          const [freshOptions, freshVariants] = await Promise.all([
            fetchOptions(productId),
            fetchVariants(productId),
          ]);

          toast.success('Options saved.');
          dispatch({
            type: 'SAVE_COMPLETE',
            updates: {
              serverOptions: freshOptions,
              serverVariants: freshVariants,
              variantMode: 'matrix',
            },
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Failed to apply option changes.';
          dispatch({ type: 'SET_STEP_ERROR', error: msg });
        }
        return;
      }

      // ── Phase 2: persist variant details ──────────────────────────────────
      if (updates._phase2) {
        const { toCreate, toUpdate } = updates._phase2;
        dispatch({ type: 'SET_SAVING', value: true });
        try {
          await Promise.all(
            toCreate.map((row) =>
              createVariant(productId, {
                sku: row.sku,
                price: row.price,
                compareAtPrice: row.compareAtPrice,
                stock: row.stock,
                isInfiniteStock: row.isInfiniteStock,
                optionValueIds: row.optionValueIds,
                weight: row.weight,
                length: row.length,
                width: row.width,
                height: row.height,
              }),
            ),
          );

          await Promise.all(
            toUpdate.map((row) =>
              updateVariant(productId, row.serverId, {
                sku: row.sku,
                price: row.price,
                compareAtPrice: row.compareAtPrice,
                stock: row.stock,
                isInfiniteStock: row.isInfiniteStock,
                weight: row.weight,
                length: row.length,
                width: row.width,
                height: row.height,
              }),
            ),
          );

          const freshVariants = await fetchVariants(productId);

          // The backend auto-sets the first variant as default when none is set
          // yet. Mirror that locally to keep `serverProduct.defaultVariantId` in
          // sync without an extra fetch — otherwise the Review step would
          // falsely report "A default variant must be set" until reload.
          const needsDefaultVariant =
            freshVariants.length > 0 && !state.serverProduct?.defaultVariantId;
          if (needsDefaultVariant) {
            await setDefaultVariant(productId, freshVariants[0].id);
          }

          const patchedProduct =
            needsDefaultVariant && state.serverProduct
              ? { ...state.serverProduct, defaultVariantId: freshVariants[0].id }
              : null;

          toast.success('Variants saved.');
          dispatch({
            type: 'SAVE_COMPLETE',
            updates: {
              serverVariants: freshVariants,
              ...(patchedProduct ? { serverProduct: patchedProduct } : {}),
            },
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Failed to save variants.';
          dispatch({ type: 'SET_STEP_ERROR', error: msg });
        }
        return;
      }

      advance();
    },
    [state.productId, state.serverProduct, state.currentStep, state.completedSteps],
  );

  // ─── Digital formats ───────────────────────────────────────────────────────

  const handleFormatsSave = useCallback(
    async (
      updates: Partial<WizardState> & {
        _pendingFormats?: DigitalFormatRow[];
        _digitalIsActive?: boolean;
      },
    ) => {
      const productId = state.productId;
      if (!productId) return;

      const formats = updates._pendingFormats;
      if (!formats) {
        advance();
        return;
      }

      dispatch({ type: 'SET_SAVING', value: true });
      try {
        // 1. Product-wide downloads toggle
        if (
          updates._digitalIsActive !== undefined &&
          updates._digitalIsActive !== state.serverProduct?.digitalConfig?.isActive
        ) {
          await updateProduct(productId, {
            digitalConfig: { isActive: updates._digitalIsActive },
          });
        }

        // 2. Archive variants the vendor removed
        const keptIds = new Set(formats.filter((f) => f.serverId).map((f) => f.serverId));
        for (const v of state.serverVariants.filter((v) => !keptIds.has(v.id))) {
          await archiveVariant(productId, v.id);
        }

        // 3. Create / update each format + its asset (sequential — files are large)
        for (const f of formats) {
          let variantId = f.serverId;
          if (!variantId) {
            const created = await createVariant(productId, {
              sku: f.sku,
              name: f.name,
              price: f.price,
              compareAtPrice: f.compareAtPrice,
              isInfiniteStock: true,
              digitalConfig: {
                maxDownloads: f.maxDownloads,
                expiresAfterDays: f.expiresAfterDays,
              },
            });
            variantId = created.id;
            if (f.pendingFile instanceof File) {
              await uploadVariantAsset(productId, variantId, f.pendingFile);
            }
          } else {
            await updateVariant(productId, variantId, {
              sku: f.sku,
              name: f.name,
              price: f.price,
              compareAtPrice: f.compareAtPrice,
              digitalConfig: {
                maxDownloads: f.maxDownloads,
                expiresAfterDays: f.expiresAfterDays,
              },
            });
            if (f.pendingFile instanceof File) {
              if (f.asset) await replaceVariantAsset(productId, variantId, f.pendingFile);
              else await uploadVariantAsset(productId, variantId, f.pendingFile);
            } else if (f.pendingFile === null && f.asset) {
              await removeVariantAsset(productId, variantId);
            }
          }

          // Preview image (optional, max 1) — applies to both create & update.
          // The picker hands back an already-uploaded library file, so we just
          // attach its id; `null` means the existing preview was removed.
          if (f.pendingImage) {
            await updateVariant(productId, variantId, { fileIds: [f.pendingImage.id] });
          } else if (f.pendingImage === null && f.image) {
            await updateVariant(productId, variantId, { fileIds: [] });
          }
        }

        // 4. Refresh server state
        const [freshVariants, updatedProduct] = await Promise.all([
          fetchVariants(productId),
          fetchProductById(productId),
        ]);

        // 5. Ensure a default variant points at an active (asset-backed) format
        let serverProduct: typeof updatedProduct = updatedProduct;
        if (!updatedProduct.defaultVariantId) {
          const firstActive = freshVariants.find((v) => v.status === 'active');
          if (firstActive) {
            await setDefaultVariant(productId, firstActive.id);
            serverProduct = { ...updatedProduct, defaultVariantId: firstActive.id };
          }
        }

        toast.success('Formats saved.');
        advance({ serverVariants: freshVariants, serverProduct });
      } catch (err: unknown) {
        dispatch({ type: 'SET_STEP_ERROR', error: getUploadErrorMessage(err) });
      }
    },
    [state.productId, state.serverVariants, state.serverProduct, state.currentStep, state.completedSteps],
  );

  // ─── Per-variant status toggle (digital formats) ─────────────────────────────
  // Keeps the wizard's `serverVariants` in sync with status changes the formats
  // step persists individually, so Review and a remount of Formats don't read
  // a stale list.
  const handleVariantStatusChanged = useCallback(
    (variantId: string, status: 'active' | 'archived') => {
      dispatch({
        type: 'SET_SERVER_VARIANTS',
        variants: state.serverVariants.map((v) =>
          v.id === variantId ? { ...v, status } : v,
        ),
      });
    },
    [state.serverVariants],
  );

  // ─── Agency ──────────────────────────────────────────────────────────────────

  const handleAgencyChange = useCallback(
    async (agencyId: string | null) => {
      const productId = state.productId;
      if (!productId) return;
      dispatch({ type: 'SET_SAVING', value: true });
      try {
        await updateProduct(productId, { delivery: { agencyId } });
        const updated = await fetchProductById(productId);
        dispatch({ type: 'SAVE_COMPLETE', updates: { serverProduct: updated } });
        toast.success(
          agencyId ? 'Delivery agency updated.' : 'Using your default delivery agency.',
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Could not update delivery agency.';
        dispatch({ type: 'SET_STEP_ERROR', error: msg });
        toast.error(msg);
      }
    },
    [state.productId],
  );

  // ─── Publish ──────────────────────────────────────────────────────────────────

  const handlePublish = useCallback(
    async ({ vectorisationEnabled }: { vectorisationEnabled: boolean }) => {
      const productId = state.productId;
      if (!productId) return;

      dispatch({ type: 'SET_SAVING', value: true });
      try {
        // Always send vectorisationEnabled in the general PATCH so the body is
        // never empty and the backend persists the toggle on publish.
        await updateProductStatus(productId, 'active');
        await updateProduct(productId, { vectorisationEnabled });
        toast.success('Product published!');
        navigate('/dashboard/products');
      } catch (err: unknown) {
        console.log('err', err)
        if (err && typeof err === 'object' && 'code' in err) {
          const code = (err as { code: string }).code;
          const human = ACTIVATION_ERROR_MAP[code];
          dispatch({ type: 'SET_STEP_ERROR', error: human ?? 'Could not publish product.' });
        } else {
          const msg = err instanceof Error ? err.message : 'Failed to publish.';
          dispatch({ type: 'SET_STEP_ERROR', error: msg });
        }
      }
    },
    [state.productId, navigate],
  );

  const handleSaveDraft = useCallback(
    async ({ vectorisationEnabled }: { vectorisationEnabled: boolean }) => {
      const productId = state.productId;
      if (!productId) {
        navigate('/dashboard/products');
        return;
      }
      try {
        await updateProduct(productId, { vectorisationEnabled });
        toast.success('Changes saved.');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Could not save changes.';
        toast.error(msg);
      } finally {
        navigate('/dashboard/products');
      }
    },
    [state.productId, navigate],
  );

  const handleBack = useCallback(() => {
    const prev = prevStep(state.currentStep, state.productType);
    if (prev) dispatch({ type: 'SET_STEP', step: prev });
  }, [state.currentStep, state.productType]);

  // ─── Render ───────────────────────────────────────────────────────────────────

  const sharedStepProps = {
    mode: 'edit' as const,
    productId: state.productId,
    serverData: state,
    isSaving: state.isSaving,
    stepError: state.stepError,
    onBack: handleBack,
  };

  if (!state.serverProduct && !state.stepError) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto px-1">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  function renderStep() {
    switch (state.currentStep) {
      case 'type':
        return <StepTypeSelect selectedType={state.productType} onSelect={() => { }} disabled />;
      case 'basic-info':
        return <StepBasicInfo {...sharedStepProps} onSaveComplete={handleBasicInfoSave} />;
      case 'media':
        return <StepMedia {...sharedStepProps} onSaveComplete={handleMediaSave} />;
      case 'options-variants':
        return state.productId ? (
          <StepVariants
            {...sharedStepProps}
            productId={state.productId}
            onSaveComplete={handleVariantsSave}
            imageEditsByVariantId={variantImageEdits}
            onVariantImagesChange={handleVariantImagesChange}
          />
        ) : null;
      case 'formats':
        return (
          <StepDigitalFormats
            {...sharedStepProps}
            onSaveComplete={handleFormatsSave}
            onVariantStatusChanged={handleVariantStatusChanged}
          />
        );
      case 'review':
        return (
          <StepReview
            {...sharedStepProps}
            onPublish={handlePublish}
            onSaveDraft={handleSaveDraft}
            onAgencyChange={handleAgencyChange}
          />
        );
      default:
        return null;
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in max-w-3xl mx-auto -mx-6 sm:mx-auto">
      <div className="px-4 sm:px-0">
        <h1 className="text-xl sm:text-2xl font-bold">Edit Product</h1>
        {state.serverProduct && (
          <p className="text-muted-foreground text-xs sm:text-sm mt-1 truncate">
            {state.serverProduct.title}
          </p>
        )}
      </div>

      {state.productType && (
        <Card className="rounded-none border-x-0 sm:rounded-xl sm:border">
          <CardContent className="p-3 sm:p-4">
            <ProductStepIndicator
              steps={steps}
              currentStep={state.currentStep}
              completedSteps={state.completedSteps}
              onStepClick={(stepId) => {
                dispatch({ type: 'SET_STEP', step: stepId as WizardStep });
              }}
            />
          </CardContent>
        </Card>
      )}

      {isLockedForVectorisation && state.currentStep !== 'review' && (
        <div className="px-4 sm:px-0">
          <Alert>
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>
              Product is being indexed for AI search. Editing is temporarily disabled —
              head to the Review step to refresh status.
            </AlertDescription>
          </Alert>
        </div>
      )}

      <Card className="rounded-none border-x-0 sm:rounded-xl sm:border">
        <CardContent className="p-4 sm:p-6">
          <div
            className={
              isLockedForVectorisation && state.currentStep !== 'review'
                ? 'pointer-events-none opacity-60'
                : ''
            }
          >
            {renderStep()}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
