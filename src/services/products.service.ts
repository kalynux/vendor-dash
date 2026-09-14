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
  ApiProductSuspension,
  ProductSuspensionReason,
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
import { bargainBody, type BargainCeilingEdit } from '@/components/products/bargain';
import { fetchDefaultDeliveryAgency } from '@/services/agencies.service';
import { apiErrorMessage, type TranslationKey } from '@/i18n';

// ─── Adapters ─────────────────────────────────────────────────────────────────

function adaptToListItem(p: ApiProduct): ProductListItem {
  return {
    id: p.id,
    title: p.title,
    type: p.type,
    status: p.status,
    // Only set while suspended; the reason decides what we tell the vendor.
    suspension: p.suspension ?? null,
    category: p.category,
    tags: p.tags,
    // Absent on a backend build that predates simple mode — fall back to the
    // advanced editor, which every pre-existing product belongs to anyway.
    mode: p.mode ?? 'advanced',
    firstFileUrl: p.fileIds[0]?.url ?? null,
    // Carry the access class, not just the URL: a quota-blocked image and an
    // unset one both arrive as `url: null` and mean opposite things.
    firstFileAccess: p.fileIds[0]?.access ?? null,
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

/**
 * Did this write silently take the product offline?
 *
 * 🔴 After **every** update the backend re-runs the activation check on an
 * `active` product, and rewrites it to `draft` if it now fails — with no error,
 * no warning and no `message`. The `status` field in the response you already
 * hold is the only signal there is; a vendor who is not told will find out from a
 * customer.
 *
 * Pass the status from before the write and the product that came back.
 * See api-doc/vendor/product-update.md § 2.
 */
export function wasSilentlyDemoted(
  statusBefore: ApiProductStatus | undefined,
  after: Pick<ApiProduct, 'status'>,
): boolean {
  return statusBefore === 'active' && after.status === 'draft';
}

export async function updateProductStatus(id: string, status: ApiProductStatus): Promise<ApiProduct> {
  const res = await api.patch<{ success: boolean; data: ApiProduct; message: string }>(`/vendor/products/${id}/status`, { status });
  return res.data;
}

/**
 * Both bulk routes cap at 50 ids — more is a `400 VALIDATION_ERROR` — so larger
 * selections are chunked and the per-chunk results summed.
 *
 * ⚠ Neither route is behind the vectorisation-lock middleware that guards the
 * single-product writes. They filter pending products out per row instead and
 * report them in `errors[]`, so a bulk call never 409s as a whole.
 *
 * ⚠ `productIds` entries are NOT ObjectId-validated by the schema. A garbage
 * string passes Zod and is dropped silently inside the query, surfacing only as
 * a higher `failed` count.
 */
const BULK_CHUNK_SIZE = 50;

/**
 * A bulk run that a later chunk aborted. `totals` holds what the earlier chunks
 * really did apply — throwing it away and reporting "nothing happened" is a lie
 * the vendor then acts on.
 */
export class BulkPartialError extends Error {
  // Assigned in the body rather than declared as constructor parameter
  // properties: `erasableSyntaxOnly` is on, and that syntax emits code.
  readonly cause: unknown;
  readonly totals: BulkArchiveResult;

  constructor(cause: unknown, totals: BulkArchiveResult) {
    super('Bulk operation stopped partway');
    this.name = 'BulkPartialError';
    this.cause = cause;
    this.totals = totals;
  }
}

async function runBulk(
  path: string,
  productIds: string[],
  extra: Record<string, unknown> = {},
): Promise<BulkArchiveResult> {
  const totals: BulkArchiveResult = { success: 0, failed: 0, total: 0, errors: [] };
  for (let i = 0; i < productIds.length; i += BULK_CHUNK_SIZE) {
    let res: BulkArchiveResponse;
    try {
      res = await api.post<BulkArchiveResponse>(path, {
        ...extra,
        productIds: productIds.slice(i, i + BULK_CHUNK_SIZE),
      });
    } catch (err) {
      // A well-formed bulk request normally answers 200 with per-row `errors[]`.
      // `bulk/status` with `draft` is the exception: it is quota-gated and
      // refuses the WHOLE request with 403 BILLING_LIMIT_EXCEEDED, so on a
      // multi-chunk selection the earlier chunks have already applied.
      if (i > 0) throw new BulkPartialError(err, totals);
      throw err;
    }
    totals.success += res.data.success;
    totals.failed += res.data.failed;
    totals.total += res.data.total;
    // Omitted rather than empty when nothing failed.
    if (res.data.errors?.length) totals.errors.push(...res.data.errors);
  }
  return totals;
}

/**
 * Bulk archive via POST /vendor/products/bulk/archive. The backend only archives
 * draft/active products; anything else is skipped and counted in `failed`.
 *
 * On this path only vectorisation-pending rows get an `errors[]` entry — a wrong
 * status, a bad id or another vendor's product is invisible beyond the count.
 */
export async function bulkArchiveProducts(productIds: string[]): Promise<BulkArchiveResult> {
  return runBulk('/vendor/products/bulk/archive', productIds);
}

/**
 * Bulk status change via POST /vendor/products/bulk/status.
 *
 * `active` is the interesting target: it runs the full activation gate per
 * product, and it is the ONE path where every failure gets an `errors[]` row with
 * a human `reason` — which is the only explanation a vendor gets for why a
 * product would not publish. Surface it.
 *
 * `draft` and `archived` explain only vectorisation-pending rows, like archive.
 */
export async function bulkUpdateProductStatus(
  productIds: string[],
  status: Extract<ApiProductStatus, 'active' | 'draft' | 'archived'>,
): Promise<BulkArchiveResult> {
  return runBulk('/vendor/products/bulk/status', productIds, { status });
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
  // The response's own `message` is deliberately not carried through. The
  // backend writes it for a vendor to read ("Product saved as a draft. Resolve
  // 1 issue(s) to publish.") but only ever in English, and every outcome it
  // describes already has localized copy — the checklist itself is rebuilt from
  // `activation.blockers` in ActivationBlockersPanel.
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

export interface BargainWriteFailure {
  variantId: string;
  label: string;
  /** Raw — the caller resolves it through `apiError`, which needs React context. */
  error: unknown;
}

/**
 * Apply per-variant negotiation ceilings.
 *
 * `allSettled`, not `all`: these are independent requests, so the ones that
 * succeed commit regardless, and the docs require reporting WHICH variants
 * failed. A single rejection would discard the successes' identities.
 *
 * Callers must run this BEFORE flipping `vectorisationEnabled` — that flip sets
 * `vectorisationStatus: 'pending'`, after which every variant write returns
 * 409 CATALOG_PRODUCT_VECTORISATION_PENDING.
 */
export async function applyBargainEdits(
  productId: string,
  edits: BargainCeilingEdit[],
): Promise<BargainWriteFailure[]> {
  if (edits.length === 0) return [];
  const results = await Promise.allSettled(
    edits.map((e) => updateVariant(productId, e.variantId, bargainBody(e.maxPrice))),
  );
  return results.flatMap((r, i) =>
    r.status === 'rejected'
      ? [{ variantId: edits[i].variantId, label: edits[i].label, error: r.reason }]
      : [],
  );
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

// ─── Suspension ───────────────────────────────────────────────────────────────
// A suspended product used to mean exactly one thing here — a delivery-agency
// problem — and all three notices said so. Since 2026-08-24 a plan downgrade
// suspends over-cap products too (api-doc/vendor/products.md § 11), and that one
// needs the opposite advice: there is no agency to fix, and no restore endpoint
// lifts it. Only room reappearing does.
//
// The three delivery-agency reasons keep their existing, screen-specific wording
// (each names where the fix lives on that screen), so those return the caller's
// fallback key rather than a generic replacement.

const SUSPENSION_NOTICE_KEYS: Partial<Record<ProductSuspensionReason, TranslationKey>> = {
  agency_storage_suspended: 'products.suspension.agencyStorage',
  vendor_suspended: 'products.suspension.vendorSuspended',
  platform_oversight: 'products.suspension.platformOversight',
  plan_quota_exceeded: 'products.suspension.planQuota',
};

/**
 * Which sentence explains this suspension.
 *
 * `fallback` is the screen's own delivery-agency copy — returned for the three
 * agency-link reasons and when the backend sends no `suspension` at all, which is
 * what every build before 2026-08-24 did. Guessing "delivery agency" there keeps
 * the previous behaviour rather than inventing a cause.
 */
export function suspensionNoticeKey(
  suspension: ApiProductSuspension | null | undefined,
  fallback: TranslationKey,
): TranslationKey {
  if (!suspension) return fallback;
  return SUSPENSION_NOTICE_KEYS[suspension.reason] ?? fallback;
}

/** Only a plan-quota suspension has an action the vendor can take from here. */
export function isPlanQuotaSuspension(
  suspension: ApiProductSuspension | null | undefined,
): boolean {
  return suspension?.reason === 'plan_quota_exceeded';
}

// ─── Activation pre-flight ────────────────────────────────────────────────────
// 422 error codes from the status endpoint → the catalog key that explains them.
// Keys rather than sentences: this module has no React context, so the call site
// resolves them (`t`, `useMessage`) and they follow a language switch.

export const ACTIVATION_ERROR_KEYS: Record<string, TranslationKey> = {
  CATALOG_PRODUCT_INVALID_STATE: 'errors.codes.CATALOG_PRODUCT_INVALID_STATE',
  // A 403, not a 422, and new to this map: since 2026-08-24 `PATCH /:id/status`
  // out of `archived` and `POST /:id/duplicate` are both quota-gated, because a
  // draft occupies a plan slot. `details.{limit,current,requested,available}`
  // reach the string as interpolation params.
  BILLING_LIMIT_EXCEEDED: 'products.activation.planLimitExceeded',
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
  CATALOG_VARIANT_BARGAIN_RANGE_INVALID:
    'errors.contexts.simpleProduct.CATALOG_VARIANT_BARGAIN_RANGE_INVALID',
  CATALOG_VARIANT_BARGAIN_PRICE_MISMATCH:
    'errors.contexts.simpleProduct.CATALOG_VARIANT_BARGAIN_PRICE_MISMATCH',
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
  // admin moderation. `suspended` stays editable but is NOT one cause with one
  // cure: `suspension.reason` decides who lifts it, and since 2026-08-24 that
  // includes `plan_quota_exceeded`, which NO restore endpoint lifts — only room
  // reappearing does (upgrade, or archive something older). Read the reason
  // before telling the vendor anything; `suspensionNoticeKey` does that.
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
