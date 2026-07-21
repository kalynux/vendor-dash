// Vendor's public storefront profile — see api-doc/vendor/store.md
// (GET/PATCH /api/vendor/store). One store per vendor, created during onboarding.
export interface VendorStore {
  id: string;
  vendorId: string;
  name: string;
  /** URL-safe, read-only in the vendor API. */
  slug: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  description: string | null;
  address: string | null;
  city: string | null;
  /** ISO country code, read-only. */
  country: string;
  supportEmail: string | null;
  supportPhone: string | null;
  supportWhatsapp: string | null;
  /** Vacation-mode toggle: true = open for business, false = temporarily closed. */
  isOpen: boolean;
  /** Computed from `slug` — the public storefront URL. */
  publicUrl: string;
  /** Optimistic-locking counter. */
  version: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * `PATCH /api/vendor/store` — editable storefront fields. Send only what changed
 * plus the current `version` (optimistic locking). `slug` and `country` are
 * immutable and rejected by the backend if sent.
 */
export interface StoreUpdatePayload {
  name?: string;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  description?: string | null;
  address?: string | null;
  city?: string | null;
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
