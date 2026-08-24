import { useReducer, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertCircle, Box, Package, ImageIcon, Tag, FileDigit, CheckSquare } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { EditorPageShell } from '@/components/layout/EditorPageShell';
import { ProductStepIndicator } from '@/components/products/ProductStepIndicator';
import {
  StepProductMode,
  type ProductCreationChoice,
} from '@/components/products/steps/StepProductMode';
import { StepBasicInfo } from '@/components/products/steps/StepBasicInfo';
import { StepMedia } from '@/components/products/steps/StepMedia';
import { StepVariants } from '@/components/products/steps/StepVariants';
import { StepDigitalFormats } from '@/components/products/steps/StepDigitalFormats';
import { StepReview } from '@/components/products/steps/StepReview';
import {
  fetchProductById,
  createProduct,
  updateProduct,
  createOption,
  bulkAddOptionValues,
  fetchOptions,
  fetchVariants,
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
  applyBargainEdits,
} from '@/services/products.service';
import { ACTIVATION_ERROR_KEYS, getDeliveryErrorMessage } from '@/services/products.service';
import type { BargainCeilingEdit } from '@/components/products/bargain';
import type { PendingStockInfo } from '@/components/inventory/PendingStockBadge';
import { useApiError, useFormatters, useTranslation, type TranslationKey } from '@/i18n';
import { getAgencyConnectionErrorMessage } from '@/services/agency-connections.service';
import { getUploadErrorMessage } from '@/lib/uploadErrors';
import { descriptionCreateWire } from '@/lib/richtext';
import { ApiError } from '@/types/api';
import type {
  WizardState,
  WizardAction,
  WizardStep,
  ApiProductType,
  DigitalFormatRow,
  ApiFileDetail,
  ApiPickupLocation,
} from '@/types/product.types';
import type { BasicInfoFormValues } from '@/components/products/schemas/product.schemas';
import type { VariantPhase1Payload, VariantPhase2Payload } from '@/components/products/variants';

// ─── Step definitions ─────────────────────────────────────────────────────────

const PHYSICAL_STEPS: { id: WizardStep; labelKey: TranslationKey; icon: React.ElementType }[] = [
  { id: 'type', labelKey: 'products.wizard.stepType', icon: Box },
  { id: 'basic-info', labelKey: 'products.wizard.stepBasicInfo', icon: Package },
  { id: 'media', labelKey: 'products.wizard.stepMedia', icon: ImageIcon },
  { id: 'options-variants', labelKey: 'products.wizard.stepVariants', icon: Tag },
  { id: 'review', labelKey: 'products.wizard.stepReview', icon: CheckSquare },
];

const DIGITAL_STEPS: { id: WizardStep; labelKey: TranslationKey; icon: React.ElementType }[] = [
  { id: 'type', labelKey: 'products.wizard.stepType', icon: Box },
  { id: 'basic-info', labelKey: 'products.wizard.stepBasicInfo', icon: Package },
  { id: 'media', labelKey: 'products.wizard.stepMedia', icon: ImageIcon },
  { id: 'formats', labelKey: 'products.wizard.stepFormats', icon: FileDigit },
  { id: 'review', labelKey: 'products.wizard.stepReview', icon: CheckSquare },
];

// ─── Reducer ──────────────────────────────────────────────────────────────────

const INITIAL_STATE: WizardState = {
  productId: null,
  productType: null,
  serverProduct: null,
  serverVariants: [],
  serverOptions: [],
  currentStep: 'type',
  completedSteps: [],
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
        isSaving: false,
      };
    default:
      return state;
  }
}

function getSteps(productType: ApiProductType | null) {
  if (productType === 'digital') return DIGITAL_STEPS;
  if (productType === 'physical') return PHYSICAL_STEPS;
  return [PHYSICAL_STEPS[0]];
}

function nextStep(current: WizardStep, productType: ApiProductType | null): WizardStep | null {
  const steps = getSteps(productType);
  const idx = steps.findIndex((s) => s.id === current);
  if (idx < 0 || idx >= steps.length - 1) return null;
  return steps[idx + 1].id;
}

function prevStep(current: WizardStep, productType: ApiProductType | null): WizardStep | null {
  const steps = getSteps(productType);
  const idx = steps.findIndex((s) => s.id === current);
  if (idx <= 0) return null;
  return steps[idx - 1].id;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProductUpload() {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const apiError = useApiError();
  const [state, dispatch] = useReducer(wizardReducer, INITIAL_STATE);
  // Session-local variant image overrides (persisted immediately server-side;
  // kept here so the matrix shows current images after a step remount).
  const [variantImageEdits, setVariantImageEdits] = useState<Record<string, ApiFileDetail[]>>({});
  /**
   * Open stock requests per saved variant id — what explains a stock input that
   * snapped back after a save on an agency-warehoused product. Page level, not
   * the variant reducer, which rebuilds rows from `serverVariants` on every
   * SAVE_COMPLETE and would wipe it.
   */
  const [pendingStock, setPendingStock] = useState<Record<string, PendingStockInfo>>({});
  const navigate = useNavigate();

  const handleVariantImagesChange = useCallback(
    (variantId: string, files: ApiFileDetail[]) => {
      setVariantImageEdits((prev) => ({ ...prev, [variantId]: files }));
    },
    [],
  );

  const steps = getSteps(state.productType);
  const visibleSteps = state.productType ? steps : [];
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

  // ─── Mode / type select ──────────────────────────────────────────────────────
  // Step 0 now branches on editor as well as product type: Quick add hands off
  // to the one-shot simple editor, the other two continue into this wizard.

  const handleModeSelect = useCallback(
    (choice: ProductCreationChoice) => {
      if (choice === 'simple') {
        navigate('/dashboard/product-upload/simple');
        return;
      }
      dispatch({
        type: 'SAVE_COMPLETE',
        updates: { productType: choice, currentStep: 'basic-info', completedSteps: ['type'] },
      });
    },
    [navigate],
  );

  // ─── Basic info ──────────────────────────────────────────────────────────────

  const handleBasicInfoSave = useCallback(
    async (updates: Partial<WizardState> & { _basicInfoValues?: BasicInfoFormValues }) => {
      const values = updates._basicInfoValues;
      if (!values || !state.productType) return;

      dispatch({ type: 'SET_SAVING', value: true });
      try {
        const product = await createProduct({
          type: state.productType,
          title: values.title,
          category: values.category,
          // Emits `description` (the plain projection) plus `descriptionRich`
          // once the backend accepts it — see RICH_DESCRIPTION_WIRE_ENABLED.
          ...descriptionCreateWire(values.descriptionRich),
          tags: values.tags,
          seoTitle: values.seoTitle || undefined,
          seoDescription: values.seoDescription || undefined,
        });

        // Free delivery is ON for every new physical product. `POST /products`
        // takes no `delivery` block, so the default has to be written straight
        // after the create — it cannot ride along.
        //
        // Not a promotion: the platform never bills delivery to the customer at
        // checkout, so the vendor carries the agency fee either way, and `false`
        // only means the fee gets folded into the price instead. Starting there
        // would quietly make every new listing look more expensive than it is.
        //
        // Deliberately non-blocking — a draft that exists with the wrong default
        // is recoverable from the review step's switch; a wizard that refuses to
        // advance because a default could not be written is not.
        let created = product;
        if (state.productType === 'physical') {
          try {
            const { data } = await updateProduct(product.id, {
              delivery: { freeDelivery: true },
            });
            created = data;
          } catch {
            // Left at the backend default; the review step shows the real value.
          }
        }

        advance({ serverProduct: created, productId: created.id });
      } catch (err: unknown) {
        const msg = apiError.resolve(err, { fallbackKey: 'products.errors.saveFailed' });
        dispatch({ type: 'SET_STEP_ERROR', error: msg });
      }
    },
    [state.productType, state.currentStep, state.completedSteps],
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
        const { data: updated } = await updateProduct(productId, { fileIds });
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

      // Go back to options editor — no server calls
      if (updates._resetToOptions) {
        dispatch({ type: 'SET_VARIANT_MODE', mode: 'options' });
        return;
      }

      // ── Phase 1: process option changes server-side ───────────────────────
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
          // 1. DESTRUCTIVE — archive variants first (before any option/value deletion)
          for (const variantId of variantsToArchive) {
            await archiveVariant(productId, variantId);
          }

          // 2. DESTRUCTIVE — delete removed option values (for retained options)
          for (const { optionServerId, valueServerId } of valuesToDelete) {
            await deleteOptionValue(productId, optionServerId, valueServerId);
          }

          // 3. DESTRUCTIVE — delete removed options (cascades their values)
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

          dispatch({
            type: 'SAVE_COMPLETE',
            updates: {
              serverOptions: freshOptions,
              serverVariants: freshVariants,
              variantMode: 'matrix',
            },
          });
        } catch (err: unknown) {
          const msg = apiError.resolve(err, { fallbackKey: 'products.errors.optionsFailed' });
          dispatch({ type: 'SET_STEP_ERROR', error: msg });
        }
        return;
      }

      // ── Phase 2: save variant rows ───────────────────────────────────────
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

          const updateResults = await Promise.all(
            toUpdate.map(async (row) => ({
              row,
              res: await updateVariant(productId, row.serverId, {
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
            })),
          );

          // Rows on an agency-warehoused product applied everything EXCEPT the
          // quantity, which is now a request awaiting the agency's approval.
          const queued = updateResults.filter((r) => r.res.stockAdjustment);
          if (queued.length) {
            setPendingStock((prev) => ({
              ...prev,
              ...Object.fromEntries(
                queued.map((q) => [
                  q.row.serverId,
                  {
                    requestId: q.res.stockAdjustment!.request.id,
                    requestedQuantity: q.res.stockAdjustment!.request.requestedQuantity,
                  },
                ]),
              ),
            }));
          }

          // Authoritative — for a queued row this deliberately returns the OLD
          // quantity. The pending badge is what explains the difference.
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

          if (queued.length) {
            toast.warning(
              t('products.toast.variantsSavedStockQueued', { count: queued.length }),
            );
          } else {
            toast.success(t('products.toast.variantsSaved'));
          }
          dispatch({
            type: 'SAVE_COMPLETE',
            updates: {
              serverVariants: freshVariants,
              ...(patchedProduct ? { serverProduct: patchedProduct } : {}),
            },
          });
        } catch (err: unknown) {
          const msg = apiError.resolve(err, { fallbackKey: 'products.errors.variantsFailed' });
          dispatch({ type: 'SET_STEP_ERROR', error: msg });
        }
        return;
      }

      // No payload: just advance to next step
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

        toast.success(t('products.toast.formatsSaved'));
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

  // ─── Review / publish ─────────────────────────────────────────────────────────

  // ─── Agency ──────────────────────────────────────────────────────────────────

  const handleAgencyChange = useCallback(
    async (agencyId: string | null) => {
      const productId = state.productId;
      if (!productId) return;
      dispatch({ type: 'SET_SAVING', value: true });
      try {
        const { message } = await updateProduct(productId, { delivery: { agencyId } });
        const updated = await fetchProductById(productId);
        dispatch({ type: 'SAVE_COMPLETE', updates: { serverProduct: updated } });
        toast.success(
          message ??
            t(agencyId ? 'products.toast.agencyUpdated' : 'products.toast.agencyDefault'),
        );
      } catch (err: unknown) {
        const msg = err instanceof ApiError
          ? getAgencyConnectionErrorMessage(err)
          : t('products.errors.agencyFailed');
        dispatch({ type: 'SET_STEP_ERROR', error: msg });
        toast.error(msg);
      }
    },
    [state.productId],
  );

  const handleFreeDeliveryChange = useCallback(
    async (freeDelivery: boolean) => {
      const productId = state.productId;
      if (!productId) return;
      dispatch({ type: 'SET_SAVING', value: true });
      try {
        await updateProduct(productId, { delivery: { freeDelivery } });
        const updated = await fetchProductById(productId);
        dispatch({ type: 'SAVE_COMPLETE', updates: { serverProduct: updated } });
        toast.success(
          t(freeDelivery
            ? 'products.toast.freeDeliveryEnabled'
            : 'products.toast.freeDeliveryDisabled'),
        );
      } catch (err: unknown) {
        const msg = apiError.resolve(err, { fallbackKey: 'products.errors.freeDeliveryFailed' });
        dispatch({ type: 'SET_STEP_ERROR', error: msg });
        toast.error(msg);
      }
    },
    [state.productId],
  );

  const handlePickupLocationChange = useCallback(
    async (pickupLocation: ApiPickupLocation | null) => {
      const productId = state.productId;
      if (!productId) return;
      dispatch({ type: 'SET_SAVING', value: true });
      try {
        await updateProduct(productId, { delivery: { pickupLocation } });
        const updated = await fetchProductById(productId);
        dispatch({ type: 'SAVE_COMPLETE', updates: { serverProduct: updated } });
        toast.success(t('products.toast.pickupUpdated'));
      } catch (err: unknown) {
        const msg = getDeliveryErrorMessage(err);
        dispatch({ type: 'SET_STEP_ERROR', error: msg });
        toast.error(msg);
      }
    },
    [state.productId],
  );

  /**
   * Write the review step's negotiation ceilings. Returns false when any row
   * failed, in which case the caller must stop — see the ordering note below.
   *
   * These are variant writes, so they have to land BEFORE `vectorisationEnabled`
   * is flipped: that flip sets `vectorisationStatus: 'pending'`, after which every
   * variant write returns 409. They also go before the status change, so a product
   * that is already indexing fails here with nothing else having moved.
   */
  const flushBargainEdits = useCallback(
    async (productId: string, edits: BargainCeilingEdit[]): Promise<boolean> => {
      const failures = await applyBargainEdits(productId, edits);
      if (failures.length === 0) return true;

      // Per-variant, not a single count: the rows fail independently and for
      // different reasons, and the vendor has to know which one to fix.
      for (const f of failures) {
        toast.error(
          `${f.label} — ${apiError.resolve(f.error, {
            fallbackKey: 'products.errors.variantsFailed',
          })}`,
        );
      }
      dispatch({
        type: 'SET_STEP_ERROR',
        error: t('products.errors.bargainPartial', {
          variants: fmt.list(failures.map((f) => f.label)),
        }),
      });
      // The rows that succeeded are saved; re-read so a retry sends only what is
      // still outstanding. "Render as returned, never as submitted."
      try {
        dispatch({
          type: 'SET_SERVER_VARIANTS',
          variants: await fetchVariants(productId),
        });
      } catch {
        // Best-effort refresh — the error above is what the vendor acts on.
      }
      return false;
    },
    [apiError, fmt, t],
  );

  const handlePublish = useCallback(
    async ({
      vectorisationEnabled,
      bargainEdits,
    }: {
      vectorisationEnabled: boolean;
      bargainEdits: BargainCeilingEdit[];
    }) => {
      const productId = state.productId;
      if (!productId) return;

      dispatch({ type: 'SET_SAVING', value: true });
      try {
        // Ceilings first — see flushBargainEdits. Aborting rather than publishing
        // anyway: flipping vectorisation on a half-applied set would send the
        // product into `pending`, where the failed row cannot be retried at all.
        if (!(await flushBargainEdits(productId, bargainEdits))) return;

        // Always send vectorisationEnabled in the general PATCH so the body is
        // never empty and the backend persists the toggle on publish.
        await updateProductStatus(productId, 'active');
        await updateProduct(productId, { vectorisationEnabled });
        toast.success(t('products.toast.published'));
        navigate('/dashboard/products');
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'code' in err) {
          const code = (err as { code: string }).code;
          const activationKey = ACTIVATION_ERROR_KEYS[code];
          dispatch({
            type: 'SET_STEP_ERROR',
            error: activationKey
              ? t(activationKey)
              : apiError.resolve(err, { fallbackKey: 'products.errors.publishFailed' }),
          });
        } else {
          dispatch({
            type: 'SET_STEP_ERROR',
            error: apiError.resolve(err, { fallbackKey: 'products.errors.publishFailed' }),
          });
        }
      }
    },
    [state.productId, navigate, flushBargainEdits],
  );

  const handleSaveDraft = useCallback(
    async ({
      vectorisationEnabled,
      bargainEdits,
    }: {
      vectorisationEnabled: boolean;
      bargainEdits: BargainCeilingEdit[];
    }) => {
      const productId = state.productId;
      if (!productId) {
        navigate('/dashboard/products');
        return;
      }
      // Deliberately outside the try/finally below: that block navigates away
      // regardless of outcome, which is right for the vectorisation write but
      // wrong here — a rejected ceiling has to keep the vendor on this step.
      dispatch({ type: 'SET_SAVING', value: true });
      if (!(await flushBargainEdits(productId, bargainEdits))) return;

      try {
        await updateProduct(productId, { vectorisationEnabled });
        toast.success(t('products.toast.savedAsDraft'));
      } catch (err: unknown) {
        toast.error(apiError.resolve(err, { fallbackKey: 'products.errors.draftFailed' }));
      } finally {
        navigate('/dashboard/products');
      }
    },
    [state.productId, navigate, flushBargainEdits],
  );

  const handleBack = useCallback(() => {
    const prev = prevStep(state.currentStep, state.productType);
    if (prev) dispatch({ type: 'SET_STEP', step: prev });
    else navigate('/dashboard/products');
  }, [state.currentStep, state.productType, navigate]);

  // ─── Render ───────────────────────────────────────────────────────────────────

  const sharedStepProps = {
    mode: 'create' as const,
    productId: state.productId,
    serverData: state,
    isSaving: state.isSaving,
    stepError: state.stepError,
    onBack: handleBack,
  };

  function renderStep() {
    switch (state.currentStep) {
      case 'type':
        return <StepProductMode onSelect={handleModeSelect} />;
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
            pendingStockByVariantId={pendingStock}
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
            onFreeDeliveryChange={handleFreeDeliveryChange}
            onPickupLocationChange={handlePickupLocationChange}
          />
        );
      default:
        return null;
    }
  }

  return (
    <EditorPageShell
      title={t('products.wizard.createTitle')}
      description={t('products.wizard.createSubtitle')}
      backTo="/dashboard/products"
      backLabel={t('products.wizard.backToProducts')}
    >
      {state.productType && visibleSteps.length > 0 && (
        <Card className="rounded-none border-x-0 md:rounded-xl md:border">
          <CardContent className="p-3 sm:p-4">
            <ProductStepIndicator
              steps={visibleSteps}
              currentStep={state.currentStep}
              completedSteps={state.completedSteps}
              onStepClick={(stepId) => {
                if (state.completedSteps.includes(stepId as WizardStep)) {
                  dispatch({ type: 'SET_STEP', step: stepId as WizardStep });
                }
              }}
            />
          </CardContent>
        </Card>
      )}

      {isLockedForVectorisation && state.currentStep !== 'review' && (
        <div className="px-4 md:px-0">
          <Alert>
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>
              {t('products.wizard.lockedIndexing')}
            </AlertDescription>
          </Alert>
        </div>
      )}

      <Card className="rounded-none border-x-0 md:rounded-xl md:border">
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
    </EditorPageShell>
  );
}
