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
  DigitalToggleResponse,
  FileUploadResponse,
  FileUploadItem,

  ArchiveResponse,
  DefaultVariantResponse,
  CreateProductPayload,
  UpdateProductPayload,
  ApiProductStatus,
  CreateVariantPayload,
  UpdateVariantPayload,
  CreateOptionPayload,
} from '@/types/product.types';

// ─── Adapters ─────────────────────────────────────────────────────────────────

function adaptToListItem(p: ApiProduct): ProductListItem {
  return {
    id: p.id,
    title: p.title,
    type: p.type,
    status: p.status,
    category: p.category,
    tags: p.tags,
    firstFileId: p.fileIds.length > 0 ? p.fileIds[0] : null,
    hasVariants: p.hasVariants,
    defaultVariantId: p.defaultVariantId,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    digitalConfig: p.digitalConfig,
  };
}

function buildQueryString(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== '',
  );
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
}

// ─── File Upload ──────────────────────────────────────────────────────────────

export async function uploadFiles(files: File[]): Promise<FileUploadItem[]> {
  const fd = new FormData();
  // Field name per spec: `files` (1–10 files per request)
  files.forEach((f) => fd.append('files', f));
  const res = await api.postFormData<FileUploadResponse>('/files/upload', fd);
  return res.data;
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

// ─── Digital Asset ────────────────────────────────────────────────────────────

export async function uploadDigitalAsset(
  productId: string,
  file: File,
): Promise<DigitalAssetUploadData> {
  // Field name `file` (singular) per API spec
  const fd = new FormData();
  fd.append('file', file);
  const res = await api.postFormData<DigitalAssetResponse>(
    `/vendor/products/${productId}/digital/asset`,
    fd,
  );
  return res.data;
}

export async function replaceDigitalAsset(
  productId: string,
  file: File,
): Promise<DigitalAssetUploadData> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await api.putFormData<DigitalAssetResponse>(
    `/vendor/products/${productId}/digital/asset`,
    fd,
  );
  return res.data;
}

export async function deleteDigitalAsset(productId: string): Promise<void> {
  await api.delete<ArchiveResponse>(`/vendor/products/${productId}/digital/asset`);
}

export async function toggleDigitalAsset(productId: string): Promise<{ isActive: boolean }> {
  const res = await api.patch<DigitalToggleResponse>(
    `/vendor/products/${productId}/digital/toggle`,
  );
  return res.data;
}

// ─── Activation pre-flight ────────────────────────────────────────────────────
// Map 422 error codes from the status endpoint to human-readable messages.

export const ACTIVATION_ERROR_MAP: Record<string, string> = {
  CATALOG_PRODUCT_NO_VARIANTS: 'At least one variant with a price is required',
  CATALOG_PRODUCT_VARIANT_ZERO_PRICE: 'All active variants must have a price greater than 0',
  CATALOG_PRODUCT_NO_DEFAULT_VARIANT: 'A default variant must be set',
  CATALOG_PRODUCT_DIGITAL_NO_ASSET: 'A digital asset file must be uploaded before publishing',
};
