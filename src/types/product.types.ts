// ─── Product Types & Status ───────────────────────────────────────────────────

import type { ApiFile, FileRef } from '@/types/file.types';
// Service variants carry serviceConfig. Type-only import (erased at compile) —
// no runtime circular dependency with services.types.
import type { ServiceConfig } from '@/types/services.types';
import type { StockAdjustmentMeta } from '@/types/stock-requests.types';

export type ApiProductType = 'physical' | 'digital';

/**
 * Which editor a product belongs to.
 *  - `simple`   → physical · exactly one variant · zero options. Created by
 *                 POST /vendor/products/simple. Advanced operations (adding
 *                 variants/options, archiving the only variant, setting the
 *                 default variant) 409 with CATALOG_PRODUCT_SIMPLE_MODE_LOCKED.
 *  - `advanced` → everything else, and what every pre-existing product reports.
 */
export type ProductMode = 'simple' | 'advanced';

export type ApiProductStatus =
  | 'draft'
  | 'active'
  | 'archived'
  | 'pending_review'
  | 'suspended';

export type ApiVectorisationStatus = 'not_started' | 'pending' | 'completed' | 'failed';

export type PickupLocationSource = 'vendor_address' | 'agency_storage';

export interface ApiPickupLocation {
  source: PickupLocationSource;
  /** Required (must match a business_addresses._id) when source is 'vendor_address'; null/omitted for 'agency_storage'. */
  vendorAddressId: string | null;
  /**
   * Which of the agency's depots warehouses this product, when source is
   * 'agency_storage' (omit for 'vendor_address'). Options come from
   * `GET /vendor/delivery-agencies/:agencyId/locations`.
   *
   * **`null` is meaningful, not "unset": it means the agency's *primary*
   * depot**, and keeps tracking it if the agency reorders its locations.
   * Storing the primary's id instead pins that specific depot. Never pre-fill
   * this with the primary's id on the vendor's behalf — those are two different
   * intents. See api-doc/vendor/products.md#update-product.
   */
  agencyAddressId?: string | null;
}

export interface ApiProductDelivery {
  agencyId: string | null;
  freeDelivery: boolean;
  pickupLocation?: ApiPickupLocation | null;
}

/** Resolved address on `ApiProductPickup` — the standard address shape. */
export interface ApiPickupAddress {
  label: string | null;
  formattedAddress: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  coordinates: { lat: number; lng: number } | null;
}

/**
 * Read-only mirror of `delivery.pickupLocation` on product **detail** responses,
 * with the referenced address resolved so the current choice can be labelled
 * without a second request. `null` when the product has no pickup location
 * (digital, service, or an unconfigured physical product).
 *
 * `delivery.pickupLocation` keeps the raw ids — round-trip *that* object on a
 * PATCH, not this one.
 */
export interface ApiProductPickup {
  source: PickupLocationSource;
  vendorAddressId: string | null;
  /** `null` = the agency's primary depot. */
  agencyAddressId: string | null;
  /** `null` when the referenced address no longer exists (e.g. a deleted business address). */
  address: ApiPickupAddress | null;
  /**
   * `true` when `address` is the agency's **primary** depot standing in — either
   * because no depot was chosen or because the chosen one has since been
   * deleted. Worth surfacing: the address shown is a default, not a pick.
   * Always `false` for `vendor_address`.
   */
  isPrimaryFallback: boolean;
}

// ─── API Response Shapes ──────────────────────────────────────────────────────

export interface ApiProductSeo {
  title: string;
  description: string;
}

// Product-wide digital config. Per the multi-variant model, this only carries
// the product-wide download kill switch — assets/limits live on each variant.
export interface ApiDigitalConfig {
  isActive: boolean;
}

// Per-variant digital asset summary (raw download URL is never exposed here).
export interface ApiDigitalAsset {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
}

// The `digital` block present only on variants of a `type: "digital"` product.
export interface ApiVariantDigital {
  asset?: ApiDigitalAsset; // undefined until a file is uploaded
  maxDownloads: number | null;
  expiresAfterDays: number | null;
}

// Fully-populated file object returned by single-resource endpoints
export interface ApiFileDetail {
  id: string;
  key: string;
  url: string;
  mimeType: string;
  size: number;
  originalName?: string;
}

// Shape returned by the list endpoint and mutation endpoints (PATCH, POST)
// that have not yet migrated to returning populated files
export interface ApiProduct {
  id: string;
  vendorId: string;
  type: ApiProductType;
  status: ApiProductStatus;
  /**
   * Optional on the wire on purpose: a backend build that predates simple mode
   * omits it, and every consumer must degrade to 'advanced' rather than crash.
   * Normalised to a required field on ProductListItem by adaptToListItem.
   */
  mode?: ProductMode;
  title: string;
  description: string;
  slug: string;
  category: string;
  tags: string[];
  seo: ApiProductSeo;
  fileIds: ApiFileDetail[];
  hasVariants: boolean;
  defaultVariantId: string | null;
  createdAt: string;
  updatedAt: string;
  // Digital products only
  digitalConfig?: ApiDigitalConfig;
  // Vectorisation (AI search) — present on all product types
  vectorisationEnabled?: boolean;
  vectorisationStatus?: ApiVectorisationStatus;
  vectorisedDataId?: string | null;
  // Physical products only — nested delivery config (agency assignment)
  delivery?: ApiProductDelivery;
  // Detail responses only — `delivery.pickupLocation` with its address resolved.
  pickup?: ApiProductPickup | null;
}

export interface VectorisationStatusDto {
  productId: string;
  vectorisationEnabled: boolean;
  vectorisationStatus: ApiVectorisationStatus;
  vectorisedDataId: string | null;
}

export interface VectorisationActionResponse {
  success: true;
  data: VectorisationStatusDto;
  message?: string;
}

// Shape returned by GET /api/vendor/products/:id — files are fully populated
export type ApiProductDetail = Omit<ApiProduct, 'fileIds'> & {
  files: ApiFileDetail[];
};

// Helper — extract file IDs regardless of which shape is in state
export function getProductFileIds(product: ApiProduct | ApiProductDetail): string[] {
  if ('files' in product) return product.files.map((f) => f.id);
  return product.fileIds.map((f) => f.id);
}

// Helper — get image count regardless of shape
export function getProductFileCount(product: ApiProduct | ApiProductDetail): number {
  if ('files' in product) return product.files.length;
  return product.fileIds.length;
}

/**
 * The bargainable-pricing window, as READ from the server.
 *
 * `minPrice` mirrors the variant's selling price — the backend keeps the two
 * equal on every write path — so it is not a second price and is never sent by
 * this client. Only `maxPrice`, the ceiling negotiation may reach, is a vendor
 * decision. It is NOT a "was" price: never render it struck through or as a
 * discount reference. That is `compareAtPrice`, and the two are unrelated.
 */
export interface ApiVariantBargain {
  minPrice: number;
  maxPrice: number;
}

/**
 * What a client may SEND for a bargain window.
 *
 * `minPrice` is deliberately absent: the backend derives it from `price`, and
 * sending one that differs is 422 CATALOG_VARIANT_BARGAIN_PRICE_MISMATCH.
 * Making it untypeable is cheaper than remembering not to send it.
 */
export interface BargainWrite {
  maxPrice: number;
}

export interface ApiVariant {
  id: string;
  productId: string;
  sku: string;
  name?: string;
  status: 'active' | 'archived';
  optionSignature: string; // READ-ONLY — system-generated, never send to server
  price: number;
  compareAtPrice?: number;
  /** The configured negotiation window. Absent when the vendor set none. */
  bargain?: ApiVariantBargain;
  /**
   * Whether the window is live RIGHT NOW: `vectorisationEnabled && bargain != null`.
   * Never infer this from the presence of `bargain` — a window is fully stored and
   * validated while vectorisation is off, it is simply inert. The flag can also flip
   * on its own when the indexing pipeline demotes an ineligible product, so re-read
   * it rather than caching it.
   */
  bargainable: boolean;
  stock: number;
  isInfiniteStock: boolean;
  lowStockThreshold: number | null;
  allowOversell: boolean;
  // Physical products only:
  weight?: number;           // grams
  length?: number;           // cm
  width?: number;            // cm
  height?: number;           // cm
  optionValueIds: string[];  // physical only
  deliveryAgencyId?: string; // physical only
  files: ApiFileDetail[];
  // Digital products only — computed label + per-variant asset/limits
  displayName?: string;
  digital?: ApiVariantDigital;
  // Service products only — the single variant carries duration/buffers/mode/peak.
  serviceConfig?: ServiceConfig;
  createdAt: string;
  updatedAt: string;
  deletedAt: null;
  purgeAt: null;
}

export interface ApiProductOption {
  id: string;
  productId: string;
  name: string;
  position: number;
  values: ApiOptionValue[];
  createdAt: string;
  updatedAt: string;
}

export interface ApiOptionValue {
  id: string;
  optionId: string;
  value: string;
}

// ─── List Display Shape ───────────────────────────────────────────────────────
// Decouples Products.tsx from the legacy Product type and the raw API shape.

export interface ProductListItem {
  id: string;
  title: string;
  type: ApiProductType;
  status: ApiProductStatus;
  /** Routes the Edit action to the right editor. Defaults to 'advanced'. */
  mode: ProductMode;
  category: string;
  tags: string[];
  firstFileUrl: string | null; // URL of the first file, used for the thumbnail
  hasVariants: boolean;
  defaultVariantId: string | null;
  createdAt: string;
  updatedAt: string;
  digitalConfig?: ApiDigitalConfig;
  vectorisationEnabled: boolean;
  vectorisationStatus: ApiVectorisationStatus;
}

export interface ProductListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Query Params ─────────────────────────────────────────────────────────────

export interface ProductsQueryParams {
  type?: ApiProductType;
  status?: ApiProductStatus;
  q?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'title';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

// ─── Write Payloads ───────────────────────────────────────────────────────────
// Derived strictly from API spec. No invented fields.

export interface CreateProductPayload {
  type: ApiProductType;
  title: string;
  category: string;
  description: string;
  tags?: string[];
  seoTitle?: string;
  seoDescription?: string;
}

export interface UpdateProductPayload {
  title?: string;
  category?: string;
  description?: string;
  tags?: string[];
  seoTitle?: string;
  seoDescription?: string;
  fileIds?: string[];
  // Product-wide download kill switch only (per-variant assets/limits live on the variant).
  digitalConfig?: {
    isActive?: boolean;
  };
  vectorisationEnabled?: boolean;
  // Any sub-field may be sent alone — the backend merges against the
  // existing value rather than replacing the whole object.
  delivery?: {
    agencyId?: string | null;
    freeDelivery?: boolean;
    pickupLocation?: ApiPickupLocation | null;
  };
}

// ─── Simple mode (one-shot editor) ────────────────────────────────────────────
// See api-doc/vendor/simple-products.md. These endpoints create/edit a product,
// its single variant and its delivery config in one transaction.

/**
 * Body for POST /vendor/products/simple.
 *
 * `type`, `mode`, `status`, `deliveryAgencyId`, `optionValueIds`,
 * `digitalConfig` and `serviceConfig` are rejected with 400 — each belongs to a
 * capability this editor does not expose. Never add them here.
 */
export interface SimpleProductPayload {
  title: string;              // 3–200 chars
  description: string;        // non-empty — an empty description blocks publishing
  category: string;           // non-empty
  price: number;              // > 0 — zero is rejected outright
  stock?: number;             // integer ≥ 0, default 0
  isInfiniteStock?: boolean;  // default false
  compareAtPrice?: number;
  /**
   * Negotiation window for the single variant. `{ maxPrice }` alone is a complete
   * configuration — `minPrice` defaults to `price`. No `| null`: clearing is only
   * valid on the update endpoint. Stored but INERT until vectorisation is on.
   */
  bargain?: BargainWrite;
  sku?: string;               // 1–100 chars; auto-generated when omitted
  tags?: string[];            // unique, non-empty
  fileIds?: string[];         // max 7
  seoTitle?: string;          // max 60
  seoDescription?: string;    // max 160
  weight?: number;            // grams
  length?: number;            // cm
  width?: number;             // cm
  height?: number;            // cm
  freeDelivery?: boolean;     // default false
  /**
   * OMIT to let the backend derive it from the vendor profile + agency policy
   * (the outcome is reported in meta.activation.pickupReason). Sending it
   * explicitly is validated and can 422.
   */
  pickupLocation?: ApiPickupLocation;
  publish?: boolean;          // default true; false saves a draft outright
}

/**
 * Body for PATCH /vendor/products/:id/simple — one flat body edits both the
 * product and its single variant. Every field optional; at least one required.
 * 409 CATALOG_PRODUCT_NOT_SIMPLE_MODE on an advanced product.
 */
export interface SimpleProductUpdatePayload {
  // → the product
  title?: string;
  description?: string;
  category?: string;
  tags?: string[];
  /** FULL REPLACEMENT, same as PATCH /products/:id. Order matters (index 0 = thumbnail). */
  fileIds?: string[];
  seoTitle?: string;
  seoDescription?: string;
  freeDelivery?: boolean;
  pickupLocation?: ApiPickupLocation | null;
  // → its single variant
  price?: number;
  compareAtPrice?: number;
  /**
   * `null` CLEARS the window. NOTE this schema is STRICT — a mistyped key is a 400
   * here, unlike the variant PATCH which silently ignores unknown keys. A bare
   * `price` edit auto-moves `minPrice`, but 422s if it would rise above the stored
   * `maxPrice`; send both together to raise the ceiling as well.
   */
  bargain?: BargainWrite | null;
  stock?: number;
  isInfiniteStock?: boolean;
  lowStockThreshold?: number | null;
  allowOversell?: boolean;
  sku?: string;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  /**
   * omitted → status untouched; if the edit broke the active-state invariant the
   *           product is demoted to draft and `blockers` explains why.
   * true     → publish if draft, no-op if already active.
   * false    → never publishes. To unpublish use PATCH /products/:id/status.
   */
  publish?: boolean;
}

/**
 * One entry of `meta.activation.blockers`. `message` is written for a vendor to
 * read — render it verbatim rather than remapping it through an error map.
 */
export interface ActivationBlocker {
  code: string;
  message: string;
}

/** Why the backend did (or did not) persist a pickup location. */
export type PickupReason =
  | 'derived_single_address'
  | 'derived_agency_storage'
  | 'explicit'
  | 'multiple_addresses'
  | 'no_agency'
  | 'agency_inactive'
  | 'no_business_address'
  | 'agency_offers_neither'
  | 'resolution_failed';

export interface SimpleActivationMeta {
  attempted: boolean;
  published: boolean;
  /** The COMPLETE checklist, not the first failure. Render as a to-do list. */
  blockers: ActivationBlocker[];
  // Widened so a reason the backend adds later doesn't break the type.
  pickupReason?: PickupReason | (string & {});
}

/**
 * The single variant, nested on the simple create/update response so no second
 * fetch is needed. Only documented on those two responses — GET /products/:id
 * is not guaranteed to include it, so the edit page loads via fetchVariants.
 */
export type SimpleDefaultVariant = Pick<
  ApiVariant,
  'id' | 'sku' | 'price' | 'stock' | 'status'
> &
  Partial<
    Pick<
      ApiVariant,
      | 'displayName'
      | 'compareAtPrice'
      | 'bargain'
      | 'bargainable'
      | 'isInfiniteStock'
      | 'lowStockThreshold'
      | 'allowOversell'
      | 'weight'
      | 'length'
      | 'width'
      | 'height'
      | 'files'
    >
  >;

export type SimpleProductData = ApiProductDetail & {
  mode: ProductMode;
  defaultVariant?: SimpleDefaultVariant;
};

/** 201 on create, 200 on update — identical shape. Always 201 even when it could not publish. */
export interface SimpleProductResponse {
  success: true;
  data: SimpleProductData;
  meta?: {
    activation: SimpleActivationMeta;
    /**
     * Present only when the product is agency-warehoused and the body carried a
     * quantity: `data.defaultVariant.stock` is then the OLD number and the change
     * is queued for the agency's approval. See api-doc/vendor/simple-products.md.
     */
    stockAdjustment?: StockAdjustmentMeta;
  };
  message?: string;
}

export interface ConvertToAdvancedResponse {
  success: true;
  data: ApiProduct;
  message?: string;
}

export interface CreateVariantPayload {
  sku: string;
  price: number;
  name?: string;
  compareAtPrice?: number;
  /**
   * No `| null` on purpose — `bargain: null` on a CREATE endpoint is a 400
   * VALIDATION_ERROR. Rejected outright (400) on service variants.
   */
  bargain?: BargainWrite;
  stock?: number;
  isInfiniteStock?: boolean;
  // Physical products only — will be rejected (400) for digital:
  optionValueIds?: string[];
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  deliveryAgencyId?: string;
  // Digital products only — per-variant download limits (assetId is set via upload endpoint)
  digitalConfig?: {
    maxDownloads?: number | null;
    expiresAfterDays?: number | null;
  };
  // Service products only — required for the single service variant.
  serviceConfig?: ServiceConfig;
}

export interface UpdateVariantPayload {
  sku?: string;
  name?: string;
  price?: number;
  compareAtPrice?: number;
  /** `null` CLEARS the window. Rejected (400) on service variants except `null`. */
  bargain?: BargainWrite | null;
  stock?: number;
  isInfiniteStock?: boolean;
  lowStockThreshold?: number | null;
  allowOversell?: boolean;
  fileIds?: string[];
  // Physical only:
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  deliveryAgencyId?: string;
  // Digital only — partial; only sent fields change
  digitalConfig?: {
    maxDownloads?: number | null;
    expiresAfterDays?: number | null;
  };
}

export interface CreateOptionPayload {
  name: string;
  position?: number;
}

export interface BulkOptionValuesPayload {
  values: string[];
}

// ─── API Response Envelopes ───────────────────────────────────────────────────

export interface ProductListResponse {
  success: boolean;
  data: ApiProduct[];
  meta: ProductListMeta;
}

export interface ProductDetailResponse {
  success: boolean;
  data: ApiProductDetail;
  message?: string;
}

export interface VariantListResponse {
  success: boolean;
  data: ApiVariant[];
  meta: ProductListMeta;
}

export interface VariantDetailResponse {
  success: boolean;
  data: ApiVariant;
  /**
   * Present only when the product is agency-warehoused: `stock`/`isInfiniteStock`
   * were stripped from the write and queued as a stock request, so `data.stock`
   * is the OLD quantity. Every other field in the same PATCH applied normally.
   * Still a 200, not a 202 — you have to read the body either way.
   * See api-doc/vendor/variants.md.
   */
  meta?: { stockAdjustment?: StockAdjustmentMeta };
  message?: string;
}

export interface OptionsListResponse {
  success: boolean;
  data: ApiProductOption[];
}

export interface OptionValueBulkResponse {
  success: boolean;
  data: ApiOptionValue[];
  message?: string;
}

export interface DigitalAssetUploadData {
  variantId: string;
  assetId: string;
  filename: string;
  size: number;
  mimeType: string;
}

export interface DigitalAssetResponse {
  success: boolean;
  data: DigitalAssetUploadData;
  message?: string;
}

export interface FileUploadItem {
  id: string;
  key: string;
  provider: string;
  mimeType: string;
  size: number;
  originalName: string;
  usageCount: number;
  ownerType: string;
  ownerId: string;
}

export interface FileUploadResponse {
  success: boolean;
  data: FileUploadItem[];
  message?: string;
  meta: { count: number; roleLimit: string };
}

export interface StatusUpdateResponse {
  success: boolean;
  data: ApiProductDetail;
  message: string;
}

export interface DefaultVariantResponse {
  success: boolean;
  message: string;
}

export interface ArchiveResponse {
  success: boolean;
  message: string;
}

/** Aggregated result of POST /vendor/products/bulk/archive (partial success). */
export interface BulkArchiveResult {
  /** Number of products archived. */
  success: number;
  /** Number skipped — only draft/active products can be archived. */
  failed: number;
  total: number;
}

export interface BulkArchiveResponse {
  success: boolean;
  data: BulkArchiveResult;
  message?: string;
}

// ─── Wizard UI Types ──────────────────────────────────────────────────────────

export type PhysicalStep = 'type' | 'basic-info' | 'media' | 'options-variants' | 'review';
export type DigitalStep = 'type' | 'basic-info' | 'media' | 'formats' | 'review';
export type WizardStep = PhysicalStep | DigitalStep;

export interface WizardState {
  productId: string | null;
  productType: ApiProductType | null;
  serverProduct: ApiProduct | ApiProductDetail | null;
  serverVariants: ApiVariant[];
  serverOptions: ApiProductOption[];
  currentStep: WizardStep;
  completedSteps: WizardStep[];
  isSaving: boolean;
  stepError: string | null;
  pendingMediaFiles: File[];
  variantMode: 'options' | 'matrix';
}

export type WizardAction =
  | { type: 'SET_PRODUCT_TYPE'; productType: ApiProductType }
  | { type: 'SET_STEP'; step: WizardStep }
  | { type: 'SET_SAVING'; value: boolean }
  | { type: 'SET_STEP_ERROR'; error: string | null }
  | { type: 'SAVE_COMPLETE'; updates: Partial<WizardState> }
  | { type: 'SET_PENDING_MEDIA'; files: File[] }
  | { type: 'SET_VARIANT_MODE'; mode: 'options' | 'matrix' }
  | { type: 'SET_SERVER_VARIANTS'; variants: ApiVariant[] }
  | { type: 'SET_SERVER_OPTIONS'; options: ApiProductOption[] }
  | { type: 'LOAD_COMPLETE'; product: ApiProductDetail; variants: ApiVariant[]; options: ApiProductOption[] };

// ─── Option / Value API Payloads ──────────────────────────────────────────────

export interface UpdateOptionPayload {
  name?: string;
  position?: number;
}

export interface RenameOptionValuePayload {
  value: string;
}

export interface ReorderOptionsPayload {
  optionIds: string[];
}

// ─── Additional API Response Envelopes ────────────────────────────────────────

export interface OptionValueDetailResponse {
  success: boolean;
  data: ApiOptionValue;
  message?: string;
}

// ─── Digital format row (used by StepDigitalFormats) ─────────────────────────
// Each row is one digital "format" variant that owns its own asset + limits.

export interface DigitalFormatRow {
  tempId: string;
  serverId?: string; // variant id once saved
  sku: string;
  name: string;
  price: number;
  compareAtPrice?: number;
  maxDownloads: number | null;
  expiresAfterDays: number | null;
  asset?: ApiDigitalAsset; // existing uploaded asset (from variant.digital.asset)
  // File = new/replacement upload; null = remove existing; undefined = unchanged
  pendingFile?: File | null;
  // Optional preview image (max 1, separate from the downloadable asset).
  image?: ApiFileDetail; // existing image (from variant.files[0])
  // ApiFile = newly picked library image; null = remove existing; undefined = unchanged
  pendingImage?: ApiFile | null;
  status?: 'active' | 'archived';
}

// ─── Delivery Agencies ────────────────────────────────────────────────────────

export interface VendorAgencyHQAddressDto {
  /** Derived from the entry's geocode — `null` when it resolves none. */
  region: string | null;
  /** Derived from the entry's geocode — `null` for rural/landmark addresses. */
  city: string | null;
  /** Always present. Use it when `region`/`city` are null (see formatAgencyLocality). */
  address_description: string;
}

export interface VendorAgencyPolicySummaryDto {
  pricing: {
    storage_based_enabled: boolean;
    pickup_based_enabled: boolean;
    notes: string | null;
  };
  returns: {
    payer: 'vendor' | 'agency' | 'customer';
    return_window_days: number;
    notes: string | null;
  };
  damage: {
    claim_deadline_days: number;
    max_refund_per_item: number;
    notes: string | null;
  };
}

export interface VendorAgencyListItemDto {
  id: string;
  agencyName: string;
  /** Agency logo as a resolved file object (`{ id, key, url, … }`), or `null` if unset. */
  logo: FileRef | null;
  kycVerified: boolean;
  headquartersAddress: VendorAgencyHQAddressDto | null;
  /**
   * ISO-2 country the agency operates in (e.g. `"CM"`), set once at their
   * onboarding. What scopes `coverageAreas` to a region catalogue.
   * `null` on legacy agencies.
   */
  country: string | null;
  /** Region keys from `locations.json`, always within `country`. */
  coverageAreas: string[];
  rating: number | null;
  policies: VendorAgencyPolicySummaryDto | null;
}

export interface AgencyListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface GetDeliveryAgenciesResponse {
  success: true;
  data: VendorAgencyListItemDto[];
  meta: AgencyListMeta;
}

export interface GetDefaultAgencyResponse {
  success: true;
  data: VendorAgencyListItemDto | null;
}

export interface DeliveryAgenciesQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  region?: string;
  hq_city?: string;
}

/**
 * One physical location (depot / warehouse) an agency operates, from
 * `GET /vendor/delivery-agencies/:agencyId/locations`. Its `id` is what goes
 * into `delivery.pickupLocation.agencyAddressId`.
 *
 * Unlike the agency listing — which only ever exposes the primary HQ — this
 * endpoint is gated on an **active connection** with the agency, matching the
 * gate on setting a product-level agency override. Per-location support
 * contacts are never returned.
 */
export interface AgencyLocationDto {
  id: string;
  /** The agency's own name for the location. `null` on entries saved before labels existed. */
  label: string | null;
  /** Derived from the entry's geocode; `null` when it resolves none (rural / landmark). */
  region: string | null;
  /** Derived from the entry's geocode; `null` when it resolves none. */
  city: string | null;
  /** Always present — use it when `region`/`city` are null. */
  addressDescription: string;
  /** `true` for the agency's primary depot (the first entry). */
  isPrimary: boolean;
}

/** Unpaginated on purpose — an agency has a handful of locations. */
export interface GetAgencyLocationsResponse {
  success: true;
  data: AgencyLocationDto[];
}
