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
  DefaultVariantResponse,
  CreateProductPayload,
  UpdateProductPayload,
  ApiProductStatus,
  CreateVariantPayload,
  UpdateVariantPayload,
  CreateOptionPayload,
  VectorisationStatusDto,
  VectorisationActionResponse,
} from '@/types/product.types';
import type { ServiceConfig } from '@/types/services.types';
import { ApiError } from '@/types/api';
import { validateActivation } from '@/components/products/schemas/product.schemas';
import { fetchDefaultDeliveryAgency } from '@/services/agencies.service';

// ─── Adapters ─────────────────────────────────────────────────────────────────

function adaptToListItem(p: ApiProduct): ProductListItem {
  return {
    id: p.id,
    title: p.title,
    type: p.type,
    status: p.status,
    category: p.category,
    tags: p.tags,
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

export async function updateProduct(id: string, payload: UpdateProductPayload): Promise<ApiProduct> {
  const res = await api.patch<{ success: boolean; data: ApiProduct; message?: string }>(`/vendor/products/${id}`, payload);
  return res.data;
}

export async function updateProductStatus(id: string, status: ApiProductStatus): Promise<ApiProduct> {
  const res = await api.patch<{ success: boolean; data: ApiProduct; message: string }>(`/vendor/products/${id}/status`, { status });
  return res.data;
}

export async function archiveProduct(id: string): Promise<void> {
  await api.delete<ArchiveResponse>(`/vendor/products/${id}`);
}

export async function duplicateProduct(id: string): Promise<ApiProduct> {
  const res = await api.post<{ success: boolean; data: ApiProduct; message?: string }>(`/vendor/products/${id}/duplicate`);
  return res.data;
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
  CATALOG_PRODUCT_NO_DESCRIPTION: 'A product description is required',
  CATALOG_PRODUCT_NO_VARIANTS: 'At least one variant with a price is required',
  CATALOG_PRODUCT_VARIANT_ZERO_PRICE: 'All active variants must have a price greater than 0',
  CATALOG_PRODUCT_NO_DEFAULT_VARIANT: 'A default variant must be set',
  CATALOG_VARIANT_NO_DIGITAL_ASSET: 'Upload a file for each format before publishing',
  CATALOG_DIGITAL_VARIANT_LIMIT_EXCEEDED: 'A digital product can have at most 5 formats',
  CATALOG_PRODUCT_NO_DELIVERY_AGENCY:
    'A delivery agency must be assigned to this product or set as your default',
  CATALOG_PRODUCT_VECTORISATION_PENDING:
    'This product is currently processing background operations. Please try again in a few seconds.',
  CATALOG_PRODUCT_VECTORISATION_NOT_ELIGIBLE:
    'Product is not eligible for vectorisation. It must be active, vectorisation enabled, and have a title, description, and category.',
};

// ─── Status Flow ──────────────────────────────────────────────────────────────
// Allowed transitions per the vendor product status flow doc. Driving the UI
// off this map keeps the dropdown contents consistent with backend rules.

export type StatusTransitionIntent =
  | 'activate'
  | 'demote_to_draft'
  | 'restore'
  | 'cancel_review'
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
  pending_review: [
    {
      intent: 'cancel_review',
      target: 'draft',
      label: 'Cancel Review & Edit',
      destructive: false,
      needsPreflight: false,
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

  if (product.type === 'physical' && !product.delivery?.agencyId) {
    const defaultAgency = await fetchDefaultDeliveryAgency();
    if (!defaultAgency) {
      errors.push(ACTIVATION_ERROR_MAP.CATALOG_PRODUCT_NO_DELIVERY_AGENCY);
    }
  }

  return errors;
}
