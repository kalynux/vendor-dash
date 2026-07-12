// ─── Product Types & Status ───────────────────────────────────────────────────

import type { ApiFile } from '@/types/file.types';
// Service variants carry serviceConfig. Type-only import (erased at compile) —
// no runtime circular dependency with services.types.
import type { ServiceConfig } from '@/types/services.types';

export type ApiProductType = 'physical' | 'digital';

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
}

export interface ApiProductDelivery {
  agencyId: string | null;
  freeDelivery: boolean;
  pickupLocation?: ApiPickupLocation | null;
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

export interface ApiVariant {
  id: string;
  productId: string;
  sku: string;
  name?: string;
  status: 'active' | 'archived';
  optionSignature: string; // READ-ONLY — system-generated, never send to server
  price: number;
  compareAtPrice?: number;
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

export interface CreateVariantPayload {
  sku: string;
  price: number;
  name?: string;
  compareAtPrice?: number;
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
  region: string;
  city: string;
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
  logoUrl: string | null;
  kycVerified: boolean;
  headquartersAddress: VendorAgencyHQAddressDto | null;
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
