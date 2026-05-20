import { useReducer, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Box, Package, ImageIcon, Tag, FileDigit, DollarSign, CheckSquare } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ProductStepIndicator } from '@/components/products/ProductStepIndicator';
import { StepTypeSelect } from '@/components/products/steps/StepTypeSelect';
import { StepBasicInfo } from '@/components/products/steps/StepBasicInfo';
import { StepMedia } from '@/components/products/steps/StepMedia';
import { StepVariants } from '@/components/products/steps/StepVariants';
import { StepDigitalAsset } from '@/components/products/steps/StepDigitalAsset';
import { StepPricing } from '@/components/products/steps/StepPricing';
import { StepReview } from '@/components/products/steps/StepReview';
import {
  fetchProductById,
  fetchVariants,
  fetchOptions,
  updateProduct,
  uploadFiles,
  createOption,
  bulkAddOptionValues,
  createVariant,
  updateVariant,
  archiveVariant,
  deleteOption,
  deleteOptionValue,
  setDefaultVariant,
  uploadDigitalAsset,
  replaceDigitalAsset,
  deleteDigitalAsset,
  updateProductStatus,
  renameOption,
  renameOptionValue,
  reorderOptions,
} from '@/services/products.service';
import { ACTIVATION_ERROR_MAP } from '@/services/products.service';
import type {
  WizardState,
  WizardAction,
  WizardStep,
  ApiProductType,
  LicenseTierRow,
} from '@/types/product.types';
import { getProductFileCount } from '@/types/product.types';
import type { BasicInfoFormValues } from '@/components/products/schemas/product.schemas';
import type { MediaOrderItem } from '@/components/products/ProductMediaUpload';
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
  { id: 'digital-asset', label: 'Asset', icon: FileDigit },
  { id: 'pricing', label: 'Pricing', icon: DollarSign },
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
    if (product.digitalConfig?.assetId) steps.push('digital-asset');
    if (variants.length > 0) steps.push('pricing');
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
          description: values.description || undefined,
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
    async (updates: Partial<WizardState> & { _mediaOrder?: MediaOrderItem[] }) => {
      const productId = state.productId;
      if (!productId) return;

      const order = updates._mediaOrder ?? [];
      const newItems = order.filter((i): i is { kind: 'new'; file: File } => i.kind === 'new');

      dispatch({ type: 'SET_SAVING', value: true });
      try {
        let uploadedIds: string[] = [];
        if (newItems.length > 0) {
          const uploaded = await uploadFiles(newItems.map((i) => i.file));
          uploadedIds = uploaded.map((f) => f.id);
        }

        let newIdx = 0;
        const fileIds = order.map((item) => {
          if (item.kind === 'saved') return item.id;
          return uploadedIds[newIdx++];
        });

        const updated = await updateProduct(productId, { fileIds });

        if (newItems.length > 0) {
          toast.success(`${newItems.length} image${newItems.length !== 1 ? 's' : ''} uploaded.`);
        } else {
          toast.success('Media saved.');
        }
        advance({ serverProduct: updated });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to save images.';
        dispatch({ type: 'SET_STEP_ERROR', error: msg });
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

          if (freshVariants.length > 0 && !state.serverProduct?.defaultVariantId) {
            await setDefaultVariant(productId, freshVariants[0].id);
          }

          toast.success('Variants saved.');
          dispatch({
            type: 'SAVE_COMPLETE',
            updates: { serverVariants: freshVariants },
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

  // ─── Digital asset ───────────────────────────────────────────────────────────

  const handleDigitalAssetSave = useCallback(
    async (updates: Partial<WizardState> & { _pendingAssetFile?: File | null }) => {
      const productId = state.productId;
      if (!productId) return;

      const file = updates._pendingAssetFile;
      if (file === undefined) {
        advance();
        return;
      }

      dispatch({ type: 'SET_SAVING', value: true });
      try {
        if (file === null) {
          await deleteDigitalAsset(productId);
        } else {
          const hasExistingAsset = !!state.serverProduct?.digitalConfig?.asset?.id;
          const uploadFn = hasExistingAsset ? replaceDigitalAsset : uploadDigitalAsset;
          await uploadFn(productId, file);
        }
        const updated = await fetchProductById(productId);
        toast.success(file === null ? 'Asset removed.' : 'Asset uploaded.');
        advance({ serverProduct: updated });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to update asset.';
        dispatch({ type: 'SET_STEP_ERROR', error: msg });
      }
    },
    [state.productId, state.serverProduct, state.currentStep, state.completedSteps],
  );

  // ─── Pricing (digital) ───────────────────────────────────────────────────────

  const handlePricingSave = useCallback(
    async (
      updates: Partial<WizardState> & {
        _pendingTiers?: LicenseTierRow[];
        _digitalConfig?: { maxDownloads: number | null; expiresAfterDays: number | null };
      },
    ) => {
      const productId = state.productId;
      if (!productId) return;

      if (!updates._pendingTiers) {
        advance();
        return;
      }

      const tiers = updates._pendingTiers;
      dispatch({ type: 'SET_SAVING', value: true });
      try {
        const results = await Promise.all(
          tiers.map((tier) => {
            if (tier.serverId) {
              return updateVariant(productId, tier.serverId, {
                sku: tier.sku,
                name: tier.name,
                price: tier.price,
                compareAtPrice: tier.compareAtPrice,
              });
            }
            const existingSkus = new Set(state.serverVariants.map((v) => v.sku));
            if (existingSkus.has(tier.sku)) return Promise.resolve(null);
            return createVariant(productId, {
              sku: tier.sku,
              name: tier.name,
              price: tier.price,
              compareAtPrice: tier.compareAtPrice,
              isInfiniteStock: true,
            });
          }),
        );

        const validResults = results.filter(Boolean);
        if (validResults.length > 0 && !state.serverProduct?.defaultVariantId) {
          await setDefaultVariant(productId, validResults[0]!.id);
        }

        if (updates._digitalConfig) {
          await updateProduct(productId, {
            digitalConfig: {
              maxDownloads: updates._digitalConfig.maxDownloads,
              expiresAfterDays: updates._digitalConfig.expiresAfterDays,
            },
          });
        }

        const updatedProduct = await fetchProductById(productId);
        toast.success('Pricing tiers saved.');
        advance({
          serverVariants: tiers.map(
            (t, i) => results[i] ?? state.serverVariants.find((v) => v.id === t.serverId)!,
          ),
          serverProduct: updatedProduct,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to save pricing.';
        dispatch({ type: 'SET_STEP_ERROR', error: msg });
      }
    },
    [state.productId, state.serverVariants, state.serverProduct, state.currentStep, state.completedSteps],
  );

  // ─── Publish ──────────────────────────────────────────────────────────────────

  const handlePublish = useCallback(async () => {
    const productId = state.productId;
    if (!productId) return;

    dispatch({ type: 'SET_SAVING', value: true });
    try {
      await updateProductStatus(productId, 'active');
      toast.success('Product published!');
      navigate('/dashboard/products');
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err) {
        const code = (err as { code: string }).code;
        const human = ACTIVATION_ERROR_MAP[code];
        dispatch({ type: 'SET_STEP_ERROR', error: human ?? 'Could not publish product.' });
      } else {
        const msg = err instanceof Error ? err.message : 'Failed to publish.';
        dispatch({ type: 'SET_STEP_ERROR', error: msg });
      }
    }
  }, [state.productId, navigate]);

  const handleSaveDraft = useCallback(() => {
    navigate('/dashboard/products');
  }, [navigate]);

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
      <div className="space-y-6 max-w-3xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  function renderStep() {
    console.log("state.currentStep: ", state.currentStep)
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
          />
        ) : null;
      case 'digital-asset':
        return state.productId ? (
          <StepDigitalAsset
            {...sharedStepProps}
            productId={state.productId}
            onSaveComplete={handleDigitalAssetSave}
          />
        ) : null;
      case 'pricing':
        return <StepPricing {...sharedStepProps} onSaveComplete={handlePricingSave} />;
      case 'review':
        return (
          <StepReview
            {...sharedStepProps}
            onPublish={handlePublish}
            onSaveDraft={handleSaveDraft}
          />
        );
      default:
        return null;
    }
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Edit Product</h1>
        {state.serverProduct && (
          <p className="text-muted-foreground text-sm mt-1 truncate">
            {state.serverProduct.title}
          </p>
        )}
      </div>

      {state.productType && (
        <Card>
          <CardContent className="p-4">
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

      <Card>
        <CardContent className="p-6">{renderStep()}</CardContent>
      </Card>
    </div>
  );
}
