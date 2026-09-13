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

// Which of three classes a referenced file is in. Always present on a `FileRef`,
// and — since the backend change of 2026-09-08 — on every `/api/files/*` record too.
//
// ⚠ THREE values, not two. `quota_blocked` was missing from this union until
// 2026-09-08, and its absence was not a documentation gap: it made a blocked file
// literally unrepresentable here, so the media library rendered one as ordinary
// public media. The bytes are still on the static mount (blocking is a flag, not an
// unmount), so nothing looked wrong — the plan-quota enforcement was simply invisible
// on the screen built to show storage.
//
// ⚠ The backend classifier FAILS CLOSED: a storage tree it does not recognise is
// reported as `authorized`. So a tree added later reads as private until somebody
// says otherwise, and this stays a branch — never an `=== 'public'` assumption —
// even for product imagery.
export type FileAccess = 'public' | 'authorized' | 'quota_blocked';

// Canonical "resolved file reference" — the shape every read endpoint returns for
// a single file slot (product media, avatar, logo, banner, cover). A slot that is
// unset reads back as `null`. Normalize to a displayable URL with `fileRefUrl`.
//
// 🔴 `url` is `string | null`, not `string` (api-doc/files/private-files.md).
// It is `null` exactly when `access === 'authorized'`, and it is null rather than
// a private path ON PURPOSE: an authorized path is indistinguishable from a public
// URL, so a client that kept `<img src={url}>` would render nothing for anyone not
// signed in — a bug that presents as "the photo is sometimes missing". Do NOT
// reconstruct a URL from `key` to work around it; the static mount serves the
// public trees only and a rebuilt private path 404s.
//
// In practice a vendor is barely affected: of the three private trees, `shipments/`
// never reaches a vendor route, `ticket-attachments/` is legacy and unwritten, and
// `digital/` assets are not a `FileRef` at all (see `AssetDetail`).
export interface FileRef {
  id: string;
  key: string;
  url: string | null;
  access: FileAccess;
  mimeType: string;
  size: number;
  // Omitted from the JSON entirely when the backend has none — not sent as null.
  originalName?: string;
}

// The least a value needs to carry for `fileRefUrl`/`resolveFileUrl` to answer.
// Both fields are optional only so a locally-built placeholder still satisfies it;
// every server payload now sends both.
export interface FileUrlSource {
  key: string;
  url?: string | null;
  access?: FileAccess;
}

// List-item shape returned by GET /files. The route returns the stored file record
// PLUS the two computed fields `url` and `access` — a strict superset of a
// `FileRef`, keeping `provider`, the owner fields and the timestamps a `FileRef`
// does not carry (api-doc/uploads/README.md).
//
// ⚠ `url` and `access` were absent until the backend change of 2026-09-08, and this
// dashboard reconstructed them from `key`. That workaround is GONE — see
// `resolveFileUrl` in services/files.service.ts. Do not bring it back: rebuilding a
// URL from `key` cannot express `quota_blocked`, treats an unclassified tree as
// public where the server treats it as private, and mishandles the backslashes a key
// written on Windows carries.
//
// They stay optional on the type so a payload from an older backend still compiles;
// read them, and treat a missing `url` as "nothing to render" rather than deriving one.
export interface ApiFile {
  id: string;
  key: string;
  url?: string | null;
  access?: FileAccess;
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
  /**
   * Soft-delete stamp. `null` on a live file.
   *
   * 🔴 **`GET /api/files` is the one list endpoint that does NOT exclude these**
   * (F-26 — the query is built from ownership plus your filters and never touches
   * `deletedAt`). Every id-scoped route does exclude them. `listFiles` filters
   * client-side; without that a deleted file reappears in the media browser.
   */
  deletedAt?: string | null;
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
