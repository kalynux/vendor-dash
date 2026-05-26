// ─── Product Types & Status ───────────────────────────────────────────────────

export type ApiProductType = 'physical' | 'digital';

export type ApiProductStatus =
  | 'draft'
  | 'active'
  | 'archived'
  | 'pending_review'
  | 'suspended';

export type ApiVectorisationStatus = 'not_started' | 'pending' | 'completed' | 'failed';

export interface ApiProductDelivery {
  agencyId: string | null;
}

// ─── API Response Shapes ──────────────────────────────────────────────────────

export interface ApiProductSeo {
  title: string;
  description: string;
}

export interface ApiDigitalConfig {
  assetId?: string; // absent (undefined) when no asset has been uploaded yet
  asset?: ApiFileDetail;  
  maxDownloads: number | null;
  expiresAfterDays: number | null;
  isActive: boolean;
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
  digitalConfig?: {
    maxDownloads?: number | null;
    expiresAfterDays?: number | null;
    isActive?: boolean;
  };
  vectorisationEnabled?: boolean;
  delivery?: {
    agencyId?: string | null;
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

export interface DigitalToggleResponse {
  success: boolean;
  data: { isActive: boolean };
  message: string;
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
export type DigitalStep = 'type' | 'basic-info' | 'media' | 'digital-asset' | 'pricing' | 'review';
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

// ─── Digital pricing tier row (used by StepPricing) ──────────────────────────

export interface LicenseTierRow {
  tempId: string;
  sku: string;
  name: string;
  price: number;
  compareAtPrice?: number;
  // Set after saved to server
  serverId?: string;
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
