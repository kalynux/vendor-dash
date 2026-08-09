import { api } from './api';
import type {
  ApiProduct,
  ApiProductDetail,
  ApiVariant,
  ApiProductOption,
  ApiOptionValue,
  ProductListItem,
  ProductListMeta,
  ProductsQueryParams,
  ProductListResponse,
  ProductDetailResponse,
  VariantListResponse,
  VariantDetailResponse,
  OptionsListResponse,
  OptionValueBulkResponse,
  DigitalAssetResponse,
  DigitalAssetUploadData,

  ArchiveResponse,
  BulkArchiveResult,
  BulkArchiveResponse,
  DefaultVariantResponse,
  CreateProductPayload,
  UpdateProductPayload,
  ApiProductStatus,
  CreateVariantPayload,
  UpdateVariantPayload,
  CreateOptionPayload,
  VectorisationStatusDto,
  VectorisationActionResponse,
  SimpleProductPayload,
  SimpleProductUpdatePayload,
  SimpleProductResponse,
  SimpleProductData,
  SimpleActivationMeta,
  ConvertToAdvancedResponse,
  PickupReason,
} from '@/types/product.types';
import type { ServiceConfig } from '@/types/services.types';
import type { StockAdjustmentMeta } from '@/types/stock-requests.types';
import { ApiError } from '@/types/api';
import { validateActivation } from '@/components/products/schemas/product.schemas';
import { fetchDefaultDeliveryAgency } from '@/services/agencies.service';
import { apiErrorMessage, type TranslationKey } from '@/i18n';

// ─── Adapters ─────────────────────────────────────────────────────────────────

function adaptToListItem(p: ApiProduct): ProductListItem {
  return {
    id: p.id,
    title: p.title,
    type: p.type,
    status: p.status,
    category: p.category,
    tags: p.tags,
    // Absent on a backend build that predates simple mode — fall back to the
    // advanced editor, which every pre-existing product belongs to anyway.
    mode: p.mode ?? 'advanced',
    firstFileUrl: p.fileIds[0]?.url ?? null,
    hasVariants: p.hasVariants,
    defaultVariantId: p.defaultVariantId,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    digitalConfig: p.digitalConfig,
    vectorisationEnabled: p.vectorisationEnabled ?? false,
    vectorisationStatus: p.vectorisationStatus ?? 'not_started',
  };
}

function buildQueryString(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== '',
  );
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
}

// ─── Products CRUD ────────────────────────────────────────────────────────────

export async function fetchProducts(
  params: ProductsQueryParams = {},
): Promise<{ data: ProductListItem[]; meta: ProductListMeta }> {
  const qs = buildQueryString(params as Record<string, unknown>);
  const res = await api.get<ProductListResponse>(`/vendor/products${qs}`);
  return {
    data: res.data.map(adaptToListItem),
    meta: res.meta,
  };
}

export async function fetchProductById(id: string): Promise<ApiProductDetail> {
  const res = await api.get<ProductDetailResponse>(`/vendor/products/${id}`);
  return res.data;
}

export async function createProduct(payload: CreateProductPayload): Promise<ApiProduct> {
  const res = await api.post<{ success: boolean; data: ApiProduct; message?: string }>('/vendor/products', payload);
  return res.data;
}

export async function updateProduct(
  id: string,
  payload: UpdateProductPayload,
): Promise<{ data: ApiProduct; message?: string }> {
  const res = await api.patch<{ success: boolean; data: ApiProduct; message?: string }>(`/vendor/products/${id}`, payload);
  return { data: res.data, message: res.message };
}

export async function updateProductStatus(id: string, status: ApiProductStatus): Promise<ApiProduct> {
  const res = await api.patch<{ success: boolean; data: ApiProduct; message: string }>(`/vendor/products/${id}/status`, { status });
  return res.data;
}

export async function archiveProduct(id: string): Promise<void> {
  await api.delete<ArchiveResponse>(`/vendor/products/${id}`);
}

/**
 * Bulk archive via POST /vendor/products/bulk/archive (max 50 ids per request —
 * larger selections are chunked). The backend only archives draft/active
 * products; anything else is skipped and counted in `failed`.
 */
export async function bulkArchiveProducts(productIds: string[]): Promise<BulkArchiveResult> {
  const CHUNK_SIZE = 50;
  const totals: BulkArchiveResult = { success: 0, failed: 0, total: 0 };
  for (let i = 0; i < productIds.length; i += CHUNK_SIZE) {
    const res = await api.post<BulkArchiveResponse>('/vendor/products/bulk/archive', {
      productIds: productIds.slice(i, i + CHUNK_SIZE),
    });
    totals.success += res.data.success;
    totals.failed += res.data.failed;
    totals.total += res.data.total;
  }
  return totals;
}

export async function duplicateProduct(id: string): Promise<ApiProduct> {
  const res = await api.post<{ success: boolean; data: ApiProduct; message?: string }>(`/vendor/products/${id}/duplicate`);
  return res.data;
}

// ─── Simple mode (one-shot editor) ────────────────────────────────────────────
// See api-doc/vendor/simple-products.md. `api.post`/`api.patch` return the whole
// parsed body, so `meta.activation` survives as long as the generic declares it.

export interface SimpleProductResult {
  product: SimpleProductData;
  activation: SimpleActivationMeta;
  /**
   * Non-null ⇒ the product is agency-warehoused, so `stock`/`isInfiniteStock`
   * were dropped from the write and queued for the agency's approval:
   * `product.defaultVariant.stock` is the OLD quantity. Never set on create —
   * an initial quantity is a declaration, not an adjustment, and is not gated.
   */
  stockAdjustment: StockAdjustmentMeta | null;
  message?: string;
}

// A response without `meta` shouldn't happen, but the product still exists — so
// derive the one fact the UI actually branches on rather than throwing.
function fallbackActivation(product: SimpleProductData): SimpleActivationMeta {
  return { attempted: false, published: product.status === 'active', blockers: [] };
}

/**
 * Creates the product, its single variant and its delivery config in one
 * transaction, then attempts to publish. Always 201 even when it could not
 * publish — the outcome is in `activation`, not the status code.
 */
export async function createSimpleProduct(
  payload: SimpleProductPayload,
): Promise<SimpleProductResult> {
  const res = await api.post<SimpleProductResponse>('/vendor/products/simple', payload);
  return {
    product: res.data,
    activation: res.meta?.activation ?? fallbackActivation(res.data),
    stockAdjustment: res.meta?.stockAdjustment ?? null,
    message: res.message,
  };
}

/**
 * One flat body edits both the product and its single variant. 200.
 *
 * For an agency-warehoused product `stock`/`isInfiniteStock` are dropped from
 * the write and become a pending stock request — still 200, `product` shows the
 * OLD quantity, and `stockAdjustment` says what is queued. Every other field in
 * the body applies as normal.
 */
export async function updateSimpleProduct(
  id: string,
  payload: SimpleProductUpdatePayload,
): Promise<SimpleProductResult> {
  const res = await api.patch<SimpleProductResponse>(`/vendor/products/${id}/simple`, payload);
  return {
    product: res.data,
    activation: res.meta?.activation ?? fallbackActivation(res.data),
    stockAdjustment: res.meta?.stockAdjustment ?? null,
    message: res.message,
  };
}

/**
 * Unlocks the full variant/option API. Flips `mode` and nothing else — no data
 * migration, no repair. Idempotent, and one-way (there is no convert-to-simple).
 */
export async function convertToAdvanced(id: string): Promise<ApiProduct> {
  const res = await api.post<ConvertToAdvancedResponse>(
    `/vendor/products/${id}/convert-to-advanced`,
  );
  return res.data;
}

/**
 * Load path for the simple editor. `defaultVariant` is only documented on the
 * simple create/update responses, so resolve the single variant from the
 * variants list rather than assuming the detail response carries it.
 */
export async function fetchSimpleProduct(
  id: string,
): Promise<{ product: ApiProductDetail; variant: ApiVariant | null }> {
  const [product, variants] = await Promise.all([fetchProductById(id), fetchVariants(id)]);
  const variant =
    variants.find((v) => v.id === product.defaultVariantId) ?? variants[0] ?? null;
  return { product, variant };
}

// ─── Default Variant ──────────────────────────────────────────────────────────

export async function setDefaultVariant(productId: string, variantId: string): Promise<void> {
  await api.patch<DefaultVariantResponse>(`/vendor/products/${productId}/default-variant`, { variantId });
}

// ─── Variants ─────────────────────────────────────────────────────────────────

export async function fetchVariants(productId: string): Promise<ApiVariant[]> {
  const res = await api.get<VariantListResponse>(`/vendor/products/${productId}/variants`);
  return res.data;
}

export async function fetchVariantById(productId: string, variantId: string): Promise<ApiVariant> {
  const res = await api.get<VariantDetailResponse>(
    `/vendor/products/${productId}/variants/${variantId}`,
  );
  return res.data;
}

export async function createVariant(
  productId: string,
  payload: CreateVariantPayload,
): Promise<ApiVariant> {
  const res = await api.post<VariantDetailResponse>(
    `/vendor/products/${productId}/variants`,
    payload,
  );
  return res.data;
}

export interface VariantUpdateResult {
  variant: ApiVariant;
  /**
   * Non-null ⇒ the product is agency-warehoused: `stock`/`isInfiniteStock` were
   * stripped from the write and queued for the agency's approval, so
   * `variant.stock` is the OLD quantity. Render `variant` as returned — never as
   * submitted — and show a "120 → 90 pending" badge.
   */
  stockAdjustment: StockAdjustmentMeta | null;
}

/**
 * Update a variant. Every field applies immediately EXCEPT `stock`/`isInfiniteStock`
 * on an agency-warehoused product, which queue as a stock request (still 200, not
 * 202 — you have to read the body either way). See api-doc/vendor/variants.md.
 */
export async function updateVariant(
  productId: string,
  variantId: string,
  payload: UpdateVariantPayload,
): Promise<VariantUpdateResult> {
  const res = await api.patch<VariantDetailResponse>(
    `/vendor/products/${productId}/variants/${variantId}`,
    payload,
  );
  return { variant: res.data, stockAdjustment: res.meta?.stockAdjustment ?? null };
}

export async function archiveVariant(productId: string, variantId: string): Promise<void> {
  await api.delete<ArchiveResponse>(`/vendor/products/${productId}/variants/${variantId}`);
}

// Toggle a variant between active/archived. For digital variants, activation
// requires an uploaded asset — the backend returns 422 CATALOG_VARIANT_NO_DIGITAL_ASSET otherwise.
export async function updateVariantStatus(
  productId: string,
  variantId: string,
  status: 'active' | 'archived',
): Promise<ApiVariant> {
  const res = await api.patch<VariantDetailResponse>(
    `/vendor/products/${productId}/variants/${variantId}/status`,
    { status },
  );
  return res.data;
}

// ─── Options ──────────────────────────────────────────────────────────────────

export async function fetchOptions(productId: string): Promise<ApiProductOption[]> {
  const res = await api.get<OptionsListResponse>(`/vendor/products/${productId}/options`);
  return res.data;
}

export async function createOption(
  productId: string,
  payload: CreateOptionPayload,
): Promise<ApiProductOption> {
  const res = await api.post<{ success: boolean; data: ApiProductOption }>(
    `/vendor/products/${productId}/options`,
    payload,
  );
  return res.data;
}

export async function bulkAddOptionValues(
  productId: string,
  optionId: string,
  values: string[],
): Promise<ApiOptionValue[]> {
  const res = await api.post<OptionValueBulkResponse>(
    `/vendor/products/${productId}/options/${optionId}/values/bulk`,
    { values },
  );
  return res.data;
}

export async function deleteOption(productId: string, optionId: string): Promise<void> {
  await api.delete<ArchiveResponse>(`/vendor/products/${productId}/options/${optionId}`);
}

export async function deleteOptionValue(
  productId: string,
  optionId: string,
  valueId: string,
): Promise<void> {
  await api.delete<ArchiveResponse>(
    `/vendor/products/${productId}/options/${optionId}/values/${valueId}`,
  );
}

export async function renameOption(
  productId: string,
  optionId: string,
  name: string,
): Promise<ApiProductOption> {
  const res = await api.patch<{ success: boolean; data: ApiProductOption }>(
    `/vendor/products/${productId}/options/${optionId}`,
    { name },
  );
  return res.data;
}

export async function renameOptionValue(
  productId: string,
  optionId: string,
  valueId: string,
  newValue: string,
): Promise<ApiOptionValue> {
  const res = await api.patch<{ success: boolean; data: ApiOptionValue; message?: string }>(
    `/vendor/products/${productId}/options/${optionId}/values/${valueId}`,
    { value: newValue },
  );
  return res.data;
}

export async function reorderOptions(
  productId: string,
  optionIds: string[],
): Promise<void> {
  await api.put<{ success: boolean; message: string }>(
    `/vendor/products/${productId}/options/reorder`,
    { optionIds },
  );
}

// ─── Digital Variant Assets ─────────────────────────────────────────────────
// Assets are per-variant: each digital "format" variant owns exactly one asset.
// Uploading flips the variant to `active`; removing it returns it to `archived`.

export async function uploadVariantAsset(
  productId: string,
  variantId: string,
  file: File,
): Promise<DigitalAssetUploadData> {
  // Field name `file` (singular) per API spec
  const fd = new FormData();
  fd.append('file', file);
  const res = await api.postFormData<DigitalAssetResponse>(
    `/vendor/products/${productId}/variants/${variantId}/digital/asset`,
    fd,
  );
  return res.data;
}

export async function replaceVariantAsset(
  productId: string,
  variantId: string,
  file: File,
): Promise<DigitalAssetUploadData> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await api.putFormData<DigitalAssetResponse>(
    `/vendor/products/${productId}/variants/${variantId}/digital/asset`,
    fd,
  );
  return res.data;
}

export async function removeVariantAsset(
  productId: string,
  variantId: string,
): Promise<void> {
  await api.delete<ArchiveResponse>(
    `/vendor/products/${productId}/variants/${variantId}/digital/asset`,
  );
}

export async function updateVariantDigitalConfig(
  productId: string,
  variantId: string,
  config: { maxDownloads?: number | null; expiresAfterDays?: number | null },
): Promise<void> {
  await api.patch<ArchiveResponse>(
    `/vendor/products/${productId}/variants/${variantId}/digital/config`,
    config,
  );
}

// Service variant only — merge-patch the scheduling/peak config (duration,
// buffers, bookingMode, maxBookings, peakHours). Mirrors the digital/config
// endpoint above. Returns the updated variant.
export async function updateVariantServiceConfig(
  productId: string,
  variantId: string,
  serviceConfig: Partial<ServiceConfig>,
): Promise<ApiVariant> {
  const res = await api.patch<VariantDetailResponse>(
    `/vendor/products/${productId}/variants/${variantId}/service/config`,
    serviceConfig,
  );
  return res.data;
}

// ─── Vectorisation ────────────────────────────────────────────────────────────

export async function getVectorisationStatus(productId: string): Promise<VectorisationStatusDto> {
  const res = await api.get<VectorisationActionResponse>(
    `/vendor/products/${productId}/vectorisation/status`,
  );
  return res.data;
}

// Consolidated toggle — replaces the previous POST /vectorisation/enable and
// POST /vectorisation/disable routes (both removed). Pass `enabled: true|false`.
// The backend may return success: true with the action silently rejected
// (e.g. eligibility check failed) — detect that and surface the message.
export async function setVectorisationEnabled(
  productId: string,
  enabled: boolean,
): Promise<VectorisationStatusDto> {
  const res = await api.patch<VectorisationActionResponse>(
    `/vendor/products/${productId}/vectorisation`,
    { enabled },
  );
  if (res.data.vectorisationEnabled !== enabled) {
    throw new ApiError(
      200,
      'CATALOG_PRODUCT_VECTORISATION_NOT_APPLIED',
      res.message ?? 'AI search could not be updated.',
    );
  }
  return res.data;
}

export async function retryVectorisation(productId: string): Promise<VectorisationStatusDto> {
  const res = await api.post<VectorisationActionResponse>(
    `/vendor/products/${productId}/vectorisation/retry`,
  );
  if (!res.data.vectorisationEnabled) {
    throw new ApiError(
      200,
      'CATALOG_PRODUCT_VECTORISATION_NOT_APPLIED',
      res.message ?? 'AI search retry could not be queued.',
    );
  }
  return res.data;
}

// ─── Activation pre-flight ────────────────────────────────────────────────────
// 422 error codes from the status endpoint → the catalog key that explains them.
// Keys rather than sentences: this module has no React context, so the call site
// resolves them (`t`, `useMessage`) and they follow a language switch.

export const ACTIVATION_ERROR_KEYS: Record<string, TranslationKey> = {
  CATALOG_PRODUCT_INVALID_STATE: 'errors.codes.CATALOG_PRODUCT_INVALID_STATE',
  CATALOG_PRODUCT_NO_DESCRIPTION: 'products.activation.noDescription',
  CATALOG_PRODUCT_NO_VARIANTS: 'errors.codes.CATALOG_PRODUCT_NO_VARIANTS',
  CATALOG_PRODUCT_VARIANT_ZERO_PRICE: 'products.activation.zeroPrice',
  CATALOG_PRODUCT_NO_DEFAULT_VARIANT: 'products.activation.noDefaultVariant',
  CATALOG_VARIANT_NO_DIGITAL_ASSET: 'errors.codes.CATALOG_VARIANT_NO_DIGITAL_ASSET',
  CATALOG_DIGITAL_VARIANT_LIMIT_EXCEEDED: 'errors.codes.CATALOG_DIGITAL_VARIANT_LIMIT_EXCEEDED',
  CATALOG_PRODUCT_NO_DELIVERY_AGENCY: 'errors.codes.CATALOG_PRODUCT_NO_DELIVERY_AGENCY',
  CATALOG_PRODUCT_NO_PICKUP_LOCATION: 'errors.codes.CATALOG_PRODUCT_NO_PICKUP_LOCATION',
  CATALOG_PRODUCT_INVALID_PICKUP_LOCATION: 'errors.contexts.delivery.CATALOG_PRODUCT_INVALID_PICKUP_LOCATION',
  CATALOG_PRODUCT_AGENCY_STORAGE_INFINITE_STOCK: 'products.activation.agencyStorageInfiniteStock',
  CATALOG_PRODUCT_VECTORISATION_PENDING: 'errors.contexts.delivery.CATALOG_PRODUCT_VECTORISATION_PENDING',
  CATALOG_PRODUCT_VECTORISATION_NOT_ELIGIBLE:
    'errors.contexts.delivery.CATALOG_PRODUCT_VECTORISATION_NOT_ELIGIBLE',
};

// Combines the activation error map with agency-connection error labels for
// use when saving delivery.agencyId / delivery.pickupLocation directly (not
// just at activation time) — e.g. CONNECTION_NOT_ACTIVE on either write.
export function getDeliveryErrorMessage(err: unknown): string {
  return apiErrorMessage(err, { context: 'delivery', fallbackKey: 'products.errors.saveFailed' });
}

// ─── Simple mode errors & guidance ────────────────────────────────────────────
// Same key-not-sentence rule as ACTIVATION_ERROR_KEYS above: every entry points
// at `errors.contexts.simpleProduct`, which is where the wording lives.

export const SIMPLE_MODE_ERROR_KEYS: Record<string, TranslationKey> = {
  VALIDATION_ERROR: 'errors.contexts.simpleProduct.VALIDATION_ERROR',
  CATALOG_IMAGE_LIMIT_EXCEEDED: 'errors.contexts.simpleProduct.CATALOG_IMAGE_LIMIT_EXCEEDED',
  CATALOG_PRODUCT_ACCESS_DENIED: 'errors.contexts.simpleProduct.CATALOG_PRODUCT_ACCESS_DENIED',
  BILLING_LIMIT_EXCEEDED: 'errors.contexts.simpleProduct.BILLING_LIMIT_EXCEEDED',
  CATALOG_PRODUCT_NOT_FOUND: 'errors.contexts.simpleProduct.CATALOG_PRODUCT_NOT_FOUND',
  CATALOG_VARIANT_SKU_EXISTS: 'errors.contexts.simpleProduct.CATALOG_VARIANT_SKU_EXISTS',
  CATALOG_PRODUCT_SIMPLE_MODE_LOCKED:
    'errors.contexts.simpleProduct.CATALOG_PRODUCT_SIMPLE_MODE_LOCKED',
  CATALOG_PRODUCT_NOT_SIMPLE_MODE: 'errors.contexts.simpleProduct.CATALOG_PRODUCT_NOT_SIMPLE_MODE',
  CATALOG_PRODUCT_VECTORISATION_PENDING:
    'errors.contexts.simpleProduct.CATALOG_PRODUCT_VECTORISATION_PENDING',
  CATALOG_PRODUCT_INVALID_PICKUP_LOCATION:
    'errors.contexts.simpleProduct.CATALOG_PRODUCT_INVALID_PICKUP_LOCATION',
  CATALOG_PRODUCT_NO_DEFAULT_VARIANT:
    'errors.contexts.simpleProduct.CATALOG_PRODUCT_NO_DEFAULT_VARIANT',
};

// Chains through ACTIVATION_ERROR_MAP so blocker codes that also arrive as
// thrown errors (e.g. from PATCH /products/:id/status) still get a sentence.
export function getSimpleProductErrorMessage(err: unknown): string {
  return apiErrorMessage(err, {
    context: 'simpleProduct',
    fallbackKey: 'products.errors.saveFailed',
  });
}

export type PickupGuidanceAction =
  | { kind: 'none' }
  | { kind: 'address_picker' }
  | { kind: 'link'; to: string; labelKey: TranslationKey }
  | { kind: 'retry' };

export interface PickupReasonGuidance {
  titleKey: TranslationKey;
  bodyKey: TranslationKey;
  action: PickupGuidanceAction;
}

/** Stands in for the happy paths, which render nothing. */
const NO_GUIDANCE = {
  titleKey: 'common.labels.emptyValue',
  bodyKey: 'common.labels.emptyValue',
  action: { kind: 'none' },
} as const satisfies PickupReasonGuidance;

// What the UI should do about `meta.activation.pickupReason`. The blockers list
// says what is wrong; this says where to go and fix it.
export const PICKUP_REASON_GUIDANCE: Record<PickupReason, PickupReasonGuidance> = {
  derived_single_address: NO_GUIDANCE,
  derived_agency_storage: NO_GUIDANCE,
  explicit: NO_GUIDANCE,

  multiple_addresses: {
    titleKey: 'products.delivery.guidance.multipleAddressesTitle',
    bodyKey: 'products.delivery.guidance.multipleAddressesBody',
    action: { kind: 'address_picker' },
  },
  no_agency: {
    titleKey: 'products.delivery.guidance.noAgencyTitle',
    bodyKey: 'products.delivery.guidance.noAgencyBody',
    action: {
      kind: 'link',
      to: '/dashboard/agency/connections',
      labelKey: 'products.delivery.guidance.noAgencyAction',
    },
  },
  agency_inactive: {
    titleKey: 'products.delivery.guidance.agencyInactiveTitle',
    bodyKey: 'products.delivery.guidance.agencyInactiveBody',
    action: {
      kind: 'link',
      to: '/dashboard/agency/connections',
      labelKey: 'products.delivery.guidance.agencyInactiveAction',
    },
  },
  no_business_address: {
    titleKey: 'products.delivery.guidance.noBusinessAddressTitle',
    bodyKey: 'products.delivery.guidance.noBusinessAddressBody',
    action: {
      kind: 'link',
      to: '/dashboard/account/addresses',
      labelKey: 'products.delivery.guidance.noBusinessAddressAction',
    },
  },
  agency_offers_neither: {
    titleKey: 'products.delivery.guidance.agencyOffersNeitherTitle',
    bodyKey: 'products.delivery.guidance.agencyOffersNeitherBody',
    action: {
      kind: 'link',
      to: '/dashboard/agency/connections',
      labelKey: 'products.delivery.guidance.agencyOffersNeitherAction',
    },
  },
  resolution_failed: {
    titleKey: 'products.delivery.guidance.resolutionFailedTitle',
    bodyKey: 'products.delivery.guidance.resolutionFailedBody',
    action: { kind: 'retry' },
  },
};

/** Returns null for the happy paths (and unknown reasons) — nothing to render. */
export function getPickupGuidance(reason?: string | null): PickupReasonGuidance | null {
  if (!reason) return null;
  const guidance = PICKUP_REASON_GUIDANCE[reason as PickupReason];
  return guidance && guidance.action.kind !== 'none' ? guidance : null;
}

// ─── Status Flow ──────────────────────────────────────────────────────────────
// Allowed transitions per the vendor product status flow doc. Driving the UI
// off this map keeps the dropdown contents consistent with backend rules.

export type StatusTransitionIntent =
  | 'activate'
  | 'demote_to_draft'
  | 'restore'
  | 'archive';

export interface StatusTransition {
  intent: StatusTransitionIntent;
  target: ApiProductStatus;
  labelKey: TranslationKey;
  destructive: boolean;
  needsPreflight: boolean;
  /** Overrides the intent's default confirmation copy. */
  confirmKey?: TranslationKey;
}

export const STATUS_TRANSITIONS: Record<ApiProductStatus, StatusTransition[]> = {
  draft: [
    {
      intent: 'activate',
      target: 'active',
      labelKey: 'products.transitions.activate',
      destructive: false,
      needsPreflight: true,
    },
    {
      intent: 'archive',
      target: 'archived',
      labelKey: 'products.transitions.archive',
      destructive: true,
      needsPreflight: false,
      confirmKey: 'products.transitions.confirm.archive',
    },
  ],
  active: [
    {
      intent: 'demote_to_draft',
      target: 'draft',
      labelKey: 'products.transitions.demote_to_draft',
      destructive: false,
      needsPreflight: false,
      confirmKey: 'products.transitions.confirm.demote_to_draft',
    },
    {
      intent: 'archive',
      target: 'archived',
      labelKey: 'products.transitions.archive',
      destructive: true,
      needsPreflight: false,
      confirmKey: 'products.transitions.confirm.archiveActive',
    },
  ],
  archived: [
    {
      intent: 'restore',
      target: 'draft',
      labelKey: 'products.transitions.restore',
      destructive: false,
      needsPreflight: false,
    },
  ],
  // System-locked statuses — the backend rejects every vendor-triggered
  // transition with CATALOG_PRODUCT_INVALID_STATE. pending_review clears via
  // admin moderation; suspended clears automatically once the delivery-agency
  // cause is fixed (the product itself stays editable).
  pending_review: [],
  suspended: [],
};

export function getAllowedStatusTransitions(status: ApiProductStatus): StatusTransition[] {
  return STATUS_TRANSITIONS[status] ?? [];
}

// Runs the client-side activation checklist from the status flow doc.
// Returns the blockers as translation keys; an empty array means the activation
// request is safe to send.
export async function runActivationPreflight(productId: string): Promise<TranslationKey[]> {
  const [product, variants] = await Promise.all([
    fetchProductById(productId),
    fetchVariants(productId),
  ]);

  const errors = validateActivation({
    productType: product.type,
    description: product.description,
    variants: variants.map((v) => ({ price: v.price, status: v.status })),
    defaultVariantId: product.defaultVariantId,
  });

  if (product.type === 'physical') {
    if (!product.delivery?.agencyId) {
      const defaultAgency = await fetchDefaultDeliveryAgency();
      if (!defaultAgency) {
        errors.push(ACTIVATION_ERROR_KEYS.CATALOG_PRODUCT_NO_DELIVERY_AGENCY);
      }
    }
    if (!product.delivery?.pickupLocation) {
      errors.push(ACTIVATION_ERROR_KEYS.CATALOG_PRODUCT_NO_PICKUP_LOCATION);
    }
    // A warehouse holds a countable number of things, so agency storage and
    // unlimited stock are mutually exclusive. NOT a `stock > 0` rule — a
    // warehoused product may legitimately be at zero, and requiring a positive
    // quantity would demote it the moment it sold out.
    if (
      product.delivery?.pickupLocation?.source === 'agency_storage' &&
      variants.some((v) => v.status === 'active' && v.isInfiniteStock)
    ) {
      errors.push(ACTIVATION_ERROR_KEYS.CATALOG_PRODUCT_AGENCY_STORAGE_INFINITE_STOCK);
    }
  }

  return errors;
}
