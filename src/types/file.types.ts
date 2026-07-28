// ─── File Management types ──────────────────────────────────────────────────
// Mirrors the backend File Management Service (api-doc/vendor/file-management.md).
// Files are FLAT (no folders) and owned by the actor (vendor). Many entities
// *reference* files (products, variants, digital assets, tickets, and the
// vendor/store/agency profiles via logo/banner/cover/avatar) — a file is never
// owned by them.
//
// IMPORTANT: attachment is determined by the `usage` references object returned
// by GET /files/:id — NOT by `usageCount` (which can be stale on legacy data).

export type StorageProvider =
  | 'local'
  | 's3'
  | 'gcs'
  | 'r2'
  | 'firebase'
  | 'cloudinary';

export type FileOwnerType =
  | 'vendor'
  | 'admin'
  | 'customer'
  | 'agent'
  | 'agency'
  | 'system';

// Coarse UI category derived from the MIME type.
export type FileKind = 'image' | 'video' | 'audio' | 'document';

// Broad media category understood by the backend `category` filter on GET /files.
// Superset of FileKind — adds `archive` and `other`.
export type MediaCategory =
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'archive'
  | 'other';

// Canonical "resolved file reference" — the shape every read endpoint now returns
// for a single file slot (product media, avatar, logo, banner, cover). Mirrors the
// product-image object `{ id, key, url, mimeType, size, originalName }`. A slot that
// is unset reads back as `null`. Normalize to a displayable URL with `fileRefUrl`.
export interface FileRef {
  id: string;
  key: string;
  url: string;
  mimeType: string;
  size: number;
  originalName?: string;
}

// List-item shape returned by GET /files. `url` is populated by the backend when
// available; when absent we construct a public URL from `key` (see resolveFileUrl).
export interface ApiFile {
  id: string;
  key: string;
  url?: string;
  provider: StorageProvider;
  mimeType: string;
  size: number;
  originalName?: string;
  // Reference count — present in the payload but intentionally NOT used for UI
  // logic. Attachment status is computed from `usage` (GET /files/:id).
  usageCount: number;
  ownerType?: FileOwnerType;
  ownerId?: string;
  createdAt: string;
  updatedAt: string;
}

// Where a file is referenced — the single source of truth for "attached or not".
export interface FileUsageProduct {
  id: string;
  title: string;
  type: string;
  status: string;
}

export interface FileUsageVariant {
  id: string;
  productId: string;
  sku: string;
  status: string;
}

export interface FileUsageDigitalAsset {
  id: string;
  productId?: string;
  variantId?: string;
  name?: string;
  status?: string;
}

// Every entity type that can reference a file. Open-ended (`string`) so a type
// the backend adds later still resolves to a generic row instead of breaking.
export type FileReferenceEntityType =
  | 'product'
  | 'variant'
  | 'digital_asset'
  | 'ticket'
  | 'vendor'
  | 'store'
  | 'agency'
  | 'customer'
  | 'agent'
  | 'admin'
  | (string & {});

// The slot on the entity the file fills.
export type FileReferenceField =
  | 'media'
  | 'logo'
  | 'banner'
  | 'cover'
  | 'avatar'
  | 'attachment'
  | (string & {});

// Preferred, future-proof usage shape (api-doc/vendor/file-management.md): one
// entry per live reference, across ALL entity types (not just the catalog).
export interface FileReference {
  entityType: FileReferenceEntityType;
  entityId: string;
  field: FileReferenceField;
  /** Human-readable name: product title, ticket subject, store/vendor name… */
  label: string;
}

export interface FileUsage {
  totalReferences: number;
  /**
   * Preferred source of truth for "where is this used". Covers every entity
   * type (logo/banner/avatar/ticket attachments included). Optional so an older
   * backend that only sends the legacy arrays below still works.
   */
  references?: FileReference[];
  // ── Legacy arrays (catalog-only) — kept for backward compatibility. Prefer
  //    `references`, which is a superset. ───────────────────────────────────
  products: FileUsageProduct[];
  variants: FileUsageVariant[];
  digitalAssets: FileUsageDigitalAsset[];
}

// Single-resource shape returned by GET /files/:id — adds checksum + usage.
export interface ApiFileDetail extends ApiFile {
  checksum?: string;
  usage: FileUsage;
}

export interface FilePagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export type FileSortField = 'createdAt' | 'updatedAt' | 'size' | 'originalName';

export interface FileListParams {
  page?: number;
  limit?: number;
  // Case-insensitive substring match on originalName.
  search?: string;
  // Broad category filter. Ignored by the backend when `mimeType` is set.
  category?: MediaCategory;
  // Exact MIME type — takes precedence over `category`.
  mimeType?: string;
  provider?: StorageProvider;
  ownerType?: FileOwnerType;
  // Size bounds, in bytes (inclusive).
  minSize?: number;
  maxSize?: number;
  // ISO-8601 date bounds.
  createdAfter?: string;
  createdBefore?: string;
  sortBy?: FileSortField;
  sortOrder?: 'asc' | 'desc';
}

// ─── Storage usage (api-doc/vendor/storage.md §2) ─────────────────────────────
// Total media bytes a vendor stores against their plan cap. Digital-product
// assets are excluded by the backend, so they never inflate `usedBytes`.

export interface StorageCategoryUsage {
  bytes: number;
  count: number;
}

export interface StorageUsage {
  /** Active plan's `max_storage_bytes`. `null` for non-vendor roles (no cap). */
  limitBytes: number | null;
  /** Total media bytes in use; equals the sum of `byCategory[*].bytes`. */
  usedBytes: number;
  /** `max(0, limitBytes − usedBytes)`. `null` when there is no limit. */
  remainingBytes: number | null;
  /** Per-category `bytes` + file `count`. Absent on the embedded list summary. */
  byCategory?: Record<MediaCategory, StorageCategoryUsage>;
}

export interface StorageResponse {
  success: boolean;
  data: StorageUsage;
}

// ─── Response envelopes ───────────────────────────────────────────────────────

export interface FileListResponse {
  success: boolean;
  data: {
    files: ApiFile[];
    pagination: FilePagination;
    // Same storage object as GET /files/storage, embedded so a media-library
    // screen can show usage without a second call. `null` for admins.
    storage?: StorageUsage | null;
  };
}

export interface FileDetailResponse {
  success: boolean;
  data: ApiFileDetail;
}

export interface FileUploadResponse {
  success: boolean;
  data: ApiFile[];
  message?: string;
  meta?: { count: number; roleLimit: string };
}

export interface FileUpdateResponse {
  success: boolean;
  data: ApiFile;
  message?: string;
}
