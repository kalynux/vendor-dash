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
import { ApiError } from '@/types/api';
import { validateActivation } from '@/components/products/schemas/product.schemas';
import { fetchDefaultDeliveryAgency } from '@/services/agencies.service';
import { AGENCY_CONNECTION_ERROR_LABELS } from '@/services/agency-connections.service';

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
    message: res.message,
  };
}

/** One flat body edits both the product and its single variant. 200. */
export async function updateSimpleProduct(
  id: string,
  payload: SimpleProductUpdatePayload,
): Promise<SimpleProductResult> {
  const res = await api.patch<SimpleProductResponse>(`/vendor/products/${id}/simple`, payload);
  return {
    product: res.data,
    activation: res.meta?.activation ?? fallbackActivation(res.data),
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

export async function updateVariant(
  productId: string,
  variantId: string,
  payload: UpdateVariantPayload,
): Promise<ApiVariant> {
  const res = await api.patch<VariantDetailResponse>(
    `/vendor/products/${productId}/variants/${variantId}`,
    payload,
  );
  return res.data;
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
// Map 422 error codes from the status endpoint to human-readable messages.

export const ACTIVATION_ERROR_MAP: Record<string, string> = {
  CATALOG_PRODUCT_INVALID_STATE:
    "This status change isn't allowed from the product's current status",
  CATALOG_PRODUCT_NO_DESCRIPTION: 'A product description is required',
  CATALOG_PRODUCT_NO_VARIANTS: 'At least one variant with a price is required',
  CATALOG_PRODUCT_VARIANT_ZERO_PRICE: 'All active variants must have a price greater than 0',
  CATALOG_PRODUCT_NO_DEFAULT_VARIANT: 'A default variant must be set',
  CATALOG_VARIANT_NO_DIGITAL_ASSET: 'Upload a file for each format before publishing',
  CATALOG_DIGITAL_VARIANT_LIMIT_EXCEEDED: 'A digital product can have at most 5 formats',
  CATALOG_PRODUCT_NO_DELIVERY_AGENCY:
    'Your default delivery agency must be active, and this product must have an active delivery agency assigned (its own override or your default)',
  CATALOG_PRODUCT_NO_PICKUP_LOCATION: 'A pickup location is required for physical products',
  CATALOG_PRODUCT_INVALID_PICKUP_LOCATION:
    "This pickup location isn't valid for the assigned delivery agency, or its business address no longer exists",
  CATALOG_PRODUCT_VECTORISATION_PENDING:
    'This product is currently processing background operations. Please try again in a few seconds.',
  CATALOG_PRODUCT_VECTORISATION_NOT_ELIGIBLE:
    'Product is not eligible for vectorisation. It must be active, vectorisation enabled, and have a title, description, and category.',
};

// Combines the activation error map with agency-connection error labels for
// use when saving delivery.agencyId / delivery.pickupLocation directly (not
// just at activation time) — e.g. CONNECTION_NOT_ACTIVE on either write.
export function getDeliveryErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    return ACTIVATION_ERROR_MAP[err.code] ?? AGENCY_CONNECTION_ERROR_LABELS[err.code] ?? err.message;
  }
  return 'Something went wrong. Please try again.';
}

// ─── Simple mode errors & guidance ────────────────────────────────────────────

export const SIMPLE_MODE_ERROR_MAP: Record<string, string> = {
  VALIDATION_ERROR: 'Some fields need attention — check the highlighted inputs.',
  CATALOG_IMAGE_LIMIT_EXCEEDED: 'A product can have at most 7 images.',
  // The doc guarantees the whole transaction rolls back, so the message has to
  // say nothing was saved — otherwise vendors go hunting for a half-made product.
  CATALOG_PRODUCT_ACCESS_DENIED:
    'One of the selected images belongs to another account. Nothing was saved — remove it and try again.',
  BILLING_LIMIT_EXCEEDED:
    "You've reached your plan's limit for active products. Upgrade your plan, or archive another product, to publish this one.",
  CATALOG_PRODUCT_NOT_FOUND: 'This product no longer exists.',
  CATALOG_VARIANT_SKU_EXISTS:
    'That SKU is already taken. SKUs are unique across the whole platform — choose another, or leave it blank to generate one automatically.',
  CATALOG_PRODUCT_SIMPLE_MODE_LOCKED:
    'This product uses the quick editor, so that action is not available. Switch it to the advanced editor first.',
  CATALOG_PRODUCT_NOT_SIMPLE_MODE:
    'This product uses the advanced editor. Open it in the full product editor instead.',
  CATALOG_PRODUCT_VECTORISATION_PENDING:
    'This product is being indexed for AI search. Please try again in a few seconds.',
  CATALOG_PRODUCT_INVALID_PICKUP_LOCATION:
    "That pickup location isn't valid for the delivery agency handling this product.",
  CATALOG_PRODUCT_NO_DEFAULT_VARIANT:
    'This product lost its variant. Open it in the advanced editor to repair it.',
};

// Chains through ACTIVATION_ERROR_MAP so blocker codes that also arrive as
// thrown errors (e.g. from PATCH /products/:id/status) still get a sentence.
export function getSimpleProductErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    return SIMPLE_MODE_ERROR_MAP[err.code] ?? ACTIVATION_ERROR_MAP[err.code] ?? err.message;
  }
  return 'Something went wrong. Please try again.';
}

export type PickupGuidanceAction =
  | { kind: 'none' }
  | { kind: 'address_picker' }
  | { kind: 'link'; to: string; label: string }
  | { kind: 'retry' };

export interface PickupReasonGuidance {
  title: string;
  body: string;
  action: PickupGuidanceAction;
}

// What the UI should do about `meta.activation.pickupReason`. The blockers list
// says what is wrong; this says where to go and fix it.
export const PICKUP_REASON_GUIDANCE: Record<PickupReason, PickupReasonGuidance> = {
  derived_single_address: { title: '', body: '', action: { kind: 'none' } },
  derived_agency_storage: { title: '', body: '', action: { kind: 'none' } },
  explicit: { title: '', body: '', action: { kind: 'none' } },

  multiple_addresses: {
    title: 'Which address should the courier collect from?',
    body: 'You have several business addresses and none is set as the default, so we did not guess.',
    action: { kind: 'address_picker' },
  },
  no_agency: {
    title: 'No delivery agency yet',
    body: 'Connect an agency and set it as your default to publish physical products.',
    action: { kind: 'link', to: '/dashboard/agency/connections', label: 'Set up delivery' },
  },
  agency_inactive: {
    title: 'Your delivery agency is not active',
    body: 'Reactivate the connection, or connect a different agency.',
    action: { kind: 'link', to: '/dashboard/agency/connections', label: 'Review connections' },
  },
  no_business_address: {
    title: 'Add a business address',
    body: 'Your agency only collects from a vendor address, and you have none saved.',
    action: { kind: 'link', to: '/dashboard/account/addresses', label: 'Add an address' },
  },
  agency_offers_neither: {
    title: 'This agency supports neither pickup model',
    body: 'It offers neither collection from your address nor storage of your stock. Choose a different agency.',
    action: {
      kind: 'link',
      to: '/dashboard/agency/connections',
      label: 'Choose another agency',
    },
  },
  resolution_failed: {
    title: 'We could not work out a pickup location',
    body: 'This is usually temporary.',
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
  label: string;
  destructive: boolean;
  needsPreflight: boolean;
  confirmMessage?: string;
}

export const STATUS_TRANSITIONS: Record<ApiProductStatus, StatusTransition[]> = {
  draft: [
    {
      intent: 'activate',
      target: 'active',
      label: 'Publish Product',
      destructive: false,
      needsPreflight: true,
    },
    {
      intent: 'archive',
      target: 'archived',
      label: 'Archive Product',
      destructive: true,
      needsPreflight: false,
      confirmMessage: 'Archive this product? It will no longer appear in your store.',
    },
  ],
  active: [
    {
      intent: 'demote_to_draft',
      target: 'draft',
      label: 'Demote to Draft',
      destructive: false,
      needsPreflight: false,
      confirmMessage:
        'Demote this product to draft? It will be removed from your storefront until you republish.',
    },
    {
      intent: 'archive',
      target: 'archived',
      label: 'Archive Product',
      destructive: true,
      needsPreflight: false,
      confirmMessage:
        'Archive this live product? It will be removed from your storefront immediately.',
    },
  ],
  archived: [
    {
      intent: 'restore',
      target: 'draft',
      label: 'Restore to Draft',
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
// Returns the list of human-readable errors; empty array means the activation
// request is safe to send.
export async function runActivationPreflight(productId: string): Promise<string[]> {
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
        errors.push(ACTIVATION_ERROR_MAP.CATALOG_PRODUCT_NO_DELIVERY_AGENCY);
      }
    }
    if (!product.delivery?.pickupLocation) {
      errors.push(ACTIVATION_ERROR_MAP.CATALOG_PRODUCT_NO_PICKUP_LOCATION);
    }
  }

  return errors;
}
