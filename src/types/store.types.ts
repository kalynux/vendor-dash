import type { FileRef } from '@/types/file.types';

// Vendor's public storefront profile — see api-doc/vendor/store.md
// (GET/PATCH /api/vendor/store). One store per vendor, created during onboarding.
// The store carries no address/city of its own — physical locations are the
// vendor profile's `business_addresses`.
export interface VendorStore {
  id: string;
  vendorId: string;
  name: string;
  /** URL-safe, read-only in the vendor API. */
  slug: string;
  /** Populated file object (`{ id, key, url, … }`), or `null`. Set via `logoFileId`. */
  logo: FileRef | null;
  /** Populated file object (`{ id, key, url, … }`), or `null`. Set via `bannerFileId`. */
  banner: FileRef | null;
  description: string | null;
  /**
   * ISO country code, read-only — sourced from the vendor profile, not stored
   * on the store. `null` until onboarding Step 1 sets it.
   */
  country: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  supportWhatsapp: string | null;
  /** Vacation-mode toggle: true = open for business, false = temporarily closed. */
  isOpen: boolean;
  /**
   * Computed from `slug` — the public storefront URL.
   *
   * @deprecated Do not render or copy this. The backend bakes it from its own
   * `STORE_PUBLIC_URL_BASE`, so it is an absolute production URL that is wrong
   * whenever the storefront is running anywhere else (every local dev setup).
   * Use `storefrontUrl(storePath(store.slug))` from `@/lib/storefront/urls`,
   * which mirrors the storefront's route module and honours
   * `VITE_STOREFRONT_BASE_URL`.
   */
  publicUrl: string;
  /** Optimistic-locking counter. */
  version: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * `PATCH /api/vendor/store` — editable storefront fields. Send only what changed
 * plus the current `version` (optimistic locking). `slug` and `country` are
 * immutable and rejected by the backend if sent (country lives on the vendor
 * profile, set-once).
 */
export interface StoreUpdatePayload {
  name?: string;
  /** Id of a file uploaded via `POST /api/files/upload`, or `null`/`""` to detach. Read back as the populated `logo` object. */
  logoFileId?: string | null;
  /** Id of a file uploaded via `POST /api/files/upload`, or `null`/`""` to detach. Read back as the populated `banner` object. */
  bannerFileId?: string | null;
  description?: string | null;
  supportEmail?: string | null;
  supportPhone?: string | null;
  supportWhatsapp?: string | null;
  /** Required — optimistic-locking guard. Read from the current store first. */
  version: number;
}

/** `PATCH /api/vendor/store/status` — vacation-mode toggle. */
export interface StoreStatusPayload {
  /** true = open for business, false = on vacation (temporarily closed). */
  isOpen: boolean;
  /** Required — optimistic-locking guard. */
  version: number;
}

/** Standard envelope for the store read/write endpoints. */
export interface StoreResponse {
  success: boolean;
  data: VendorStore;
  message?: string;
}
