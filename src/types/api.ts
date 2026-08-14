import type { GeoAddress } from './geo.types';
import type { FileRef } from './file.types';

// ─── API User ────────────────────────────────────────────────────────────────

export interface ApiUser {
  _id: string;
  login_phone: string;
  login_email?: string;
  roles: string[];
  status: 'active' | 'suspended' | 'pending_verification';
}

// ─── Vendor Role Entity ───────────────────────────────────────────────────────

/** Populated file reference returned for a branding image slot. */
export interface BrandingFileRef {
  id: string;
  key: string;
  url: string;
  mimeType: string;
  size: number;
  originalName?: string;
}

/**
 * @deprecated The business logo/cover moved to the **Store** — read them from
 * `GET /api/vendor/store` as `logo` / `banner` (see `VendorStore`).
 * `GET /api/vendor/profile` no longer returns a `branding` block.
 */
export interface Branding {
  logo: BrandingFileRef | null;
  coverImage: BrandingFileRef | null;
}

/**
 * Write shape for the **onboarding branding step only** (`PUT
 * /vendor/onboarding/branding`), which still accepts it and persists it to the
 * Store. `PATCH /vendor/profile` no longer accepts `branding` — edit the store's
 * images via `logoFileId` / `bannerFileId` on `PATCH /api/vendor/store`.
 */
export interface BrandingWritePayload {
  logo_file_id?: string | null;
  cover_image_file_id?: string | null;
}

export interface KycDetails {
  national_id_number: string | null;
  legit_verified: boolean;
}

export interface SocialLinks {
  instagram: string | null;
  facebook: string | null;
  twitter: string | null;
}

export interface BusinessAddress {
  /**
   * Mongo subdocument id. Omit when adding a new address (a fresh one is
   * generated); echo back the existing value when resubmitting an existing
   * address, otherwise a new id is generated and any physical product whose
   * `delivery.pickupLocation` pointed at the old one is demoted to draft.
   * Not remapped to `id` like the outer profile object — kept as `_id` to
   * match the backend's pass-through serialization.
   */
  _id?: string;
  label?: string;
  address_line1: string;
  address_line2?: string | null;
  city: string;
  state?: string | null;
  location?: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  } | null;
  /**
   * Canonical geospatial address (see api-doc/geo/README.md). Set from the
   * address-search box; the loose fields above are kept for back-compat. Echo it
   * back on resubmit (full-replace) or it's cleared.
   */
  geo?: GeoAddress | null;
}

export interface MobileMoneyDetails {
  provider: string;
  phone_number: string;
  account_name: string;
}

export interface BankDetails {
  bank_name: string;
  account_number: string;
  account_name: string;
  country: string;
}

/**
 * A card payout destination — Visa, Mastercard and friends.
 *
 * The API never accepts (and never stores) a card number or a CVV: sending one
 * is a `400`, not a silent drop. A destination is brand + last 4 + holder +
 * expiry, plus an optional gateway token for a future automated push-to-card.
 * See api-doc/vendor/payout-methods.md#card.
 */
export interface CardPayoutDetails {
  /** Lower-case network name — `visa`, `mastercard`, `amex`, … */
  brand: string;
  last4: string;
  card_holder_name: string;
  expiry_month: number;
  expiry_year: number;
  country: string;
  issuing_bank?: string | null;
  /** Write-only; the gateway that issued `gateway_token`. Never returned. */
  gateway_provider?: string | null;
  /** Write-only; the gateway's handle for this card. Never returned. */
  gateway_token?: string | null;
  /** Read-only, server-rendered (`•••• •••• •••• 4242`). Never sent back. */
  number_masked?: string;
}

export type PayoutDetails =
  | { method: 'mobile_money'; mobile_money: MobileMoneyDetails; bank?: null; card?: null }
  | { method: 'bank'; bank: BankDetails; mobile_money?: null; card?: null }
  | { method: 'card'; card: CardPayoutDetails; mobile_money?: null; bank?: null };

export interface VendorRoleEntity {
  _id: string;
  user_id: string;
  /**
   * @deprecated Moved to the Store as `name`. `GET /vendor/profile` no longer
   * returns it; optional here because `role_entity` comes from `/auth/me`, which
   * may still carry it. Read `useStoreStore().store?.name` instead.
   */
  business_name?: string;
  display_name: string | null;
  /** @deprecated Moved to the Store as `description`. Read it from `VendorStore`. */
  business_description?: string | null;
  email: string;
  phone: string;
  email_verified: boolean;
  phone_verified: boolean;
  country: string | null;
  timezone: string;
  /** Language every notification is rendered in (en | fr | pt | es | ar). Default `en`. */
  preferred_language?: string | null;
  /**
   * The vendor's personal profile avatar (distinct from the business logo/banner,
   * which live on the Store). A populated file reference, or `null` when unset.
   * Set via `avatarFileId` on PATCH /vendor/profile.
   */
  avatar?: BrandingFileRef | null;
  /**
   * @deprecated Moved to the Store (`logo` / `banner`). `GET /vendor/profile` no
   * longer returns it; optional so any remaining reader is compile-checked.
   */
  branding?: Branding;
  business_addresses: BusinessAddress[];
  /** Ordered array — index 0 is the preferred payout method. */
  payout_details: PayoutDetails[] | null;
  /** ID of the vendor's selected default delivery agency. */
  default_delivery_agency_id?: string | null;
  kyc_details: KycDetails;
  social_links: SocialLinks;
  /**
   * 0 = onboarding complete (dashboard access granted)
   * 1 = Basic Setup required
   * 2 = Delivery Linking required (skippable)
   * 3 = Branding required (skippable)
   * 4 = Policy Setup required (skippable)
   */
  onboarding_step: 0 | 1 | 2 | 3 | 4;
  /** Vendor-defined store policies (return, cancellation, support). */
  policies?: VendorPolicies | null;
  status: string;
  wa?: boolean;
  /** Optimistic concurrency version. Pass back with each write. */
  version?: number;
}

// ─── Auth Responses ───────────────────────────────────────────────────────────

export interface AuthMeVendorResponse {
  user: ApiUser;
  role: 'vendor';
  role_entity: VendorRoleEntity;
}

// ─── Vendor Policies ──────────────────────────────────────────────────────────

export interface ReturnPolicy {
  return_eligible: boolean;
  return_window_days: number;
  refund_type: 'full' | 'partial' | 'none';
  refund_percentage?: number | null;
  return_shipping_payer: 'vendor' | 'customer' | 'customer_reimbursed_if_defect';
  refund_processing_days: number;
  return_condition_notes?: string | null;
}

export interface CancellationPolicy {
  cancellable: boolean;
  cancellation_deadline?: string | null;
  cancellation_deadline_days?: number | null;
  cancellation_fee_type?: 'none' | 'fixed' | 'percentage' | 'full_non_refundable' | null;
  cancellation_fee_value?: number | null;
  late_cancellation_refund_type?: 'fixed' | 'percentage' | 'full_non_refundable' | null;
  late_cancellation_refund_value?: number | null;
}

export interface SupportChannel {
  type: 'email' | 'phone' | 'whatsapp' | 'telegram';
  contact: string;
}

export interface SupportPolicy {
  channels: SupportChannel[];
  eligibility_notes?: string | null;
  required_info?: string[];
  availability?: '24_7' | 'business_hours' | 'limited' | null;
  availability_description?: string | null;
  languages?: string[];
}

export interface VendorPolicies {
  return_policy?: ReturnPolicy | null;
  cancellation_policy?: CancellationPolicy | null;
  support_policy?: SupportPolicy | null;
  /** Supporting policy documents (PDFs). Max 2 URLs. Full-replace — cleared if omitted. */
  documents?: string[] | null;
  version?: number;
}

// ─── Onboarding ───────────────────────────────────────────────────────────────

export type VendorOnboardingStep = 0 | 1 | 2 | 3 | 4;

export interface CompletionStatus {
  onboardingStep: VendorOnboardingStep;
  isComplete: boolean;
  missingFields: string[];
  stepLabel: string;
}

export interface OnboardingStepResponse {
  success: boolean;
  data: {
    profile: VendorRoleEntity;
    completionStatus: CompletionStatus;
  };
}

// Step 1 — Basic Setup
// No `step` field — the endpoint path determines the step.
export interface BasicSetupPayload {
  country: string;
  timezone: string;
  /** Ordered array of payout methods; index 0 is the preferred/default. Min 1, max 3. */
  payout_details: PayoutDetails[];
  /** Optimistic concurrency guard — pass the version received from the last profile response. */
  version?: number;
}

// Step 2 — Delivery Linking
// No longer accepts `default_delivery_agency_id` — agency assignment now happens
// entirely through Agency Connections (see agency-connection.types.ts), async and
// independent of onboarding progress. This step is a pure advance; `skip` is kept
// only for backward compatibility with older clients and is otherwise ignored.
export type DeliveryLinkingPayload = Record<string, never> | { skip: true };

// Step 3 — Branding (skippable)
export type BrandingPayload =
  | { skip?: false; branding?: BrandingWritePayload; business_addresses?: BusinessAddress[]; version?: number }
  | { skip: true };

// Step 4 — Policy Setup (skippable; all three sub-policies are independently optional)
export type PolicySetupPayload =
  | { skip: true }
  | {
      skip?: false;
      return_policy?: ReturnPolicy;
      cancellation_policy?: CancellationPolicy;
      support_policy?: SupportPolicy;
      documents?: string[] | null;
      version?: number;
    };

// ─── Order automation settings ─────────────────────────────────────────────────
// Per-vendor automation toggles on dedicated /vendor/profile sub-routes.

export interface AutoRedirectSettings {
  /** When true, a paid physical order's shipments advance pending → assigned automatically. */
  autoRedirectOrdersToAgency: boolean;
  /** Max order total (order's own currency) for which auto-redirect applies. Null = no cap. */
  autoRedirectThresholdAmount: number | null;
}

export interface AutoCancelSettings {
  /** Days an order may remain unpaid before the daily sweep auto-cancels it. Default 3. */
  autoCancelUnpaidDays: number;
}

// ─── Post-onboarding profile update (PATCH /vendor/profile) ────────────────────
// Partial update — send only the fields that changed. Object/array fields are a
// FULL REPLACE (send the complete desired value). `version` is always required.
// Note: default_delivery_agency_id is NOT editable here — use the dedicated
// /vendor/profile/default-delivery-agency routes.

// `businessName`, `businessDescription` and `branding` are NOT accepted here any
// more — they belong to the store (`PATCH /api/vendor/store`).
export interface VendorProfileUpdatePayload {
  displayName?: string;
  phone?: string;
  country?: string;
  timezone?: string;
  /** Language for rendered notifications (en | fr | pt | es | ar). */
  preferred_language?: string;
  /**
   * Personal profile avatar. MongoDB ObjectId of a file uploaded via
   * `POST /api/files/upload`, or `null`/`""` to detach. Registers the file as
   * in-use (`entityType: "vendor", field: "avatar"`) so it can't be deleted
   * until detached. Read back as the populated `avatar` object.
   */
  avatarFileId?: string | null;
  payout_details?: PayoutDetails[];
  business_addresses?: BusinessAddress[];
  social_links?: Partial<SocialLinks>;
  policies?: {
    return_policy?: ReturnPolicy | null;
    cancellation_policy?: CancellationPolicy | null;
    support_policy?: SupportPolicy | null;
    documents?: string[] | null;
  } | null;
  notificationPreferences?: { email?: boolean; whatsapp?: boolean; phone?: boolean };
  /** Required — optimistic-locking guard. Pass the version from the last profile load. */
  version: number;
}

/** Response from PATCH /vendor/profile. The DTO shape differs from VendorRoleEntity
 *  (camelCase), so callers should merge optimistically and read `version` from here. */
export interface VendorProfileUpdateResponse {
  success: boolean;
  message?: string;
  data: { version?: number; [key: string]: unknown };
}

// ─── Password change (PATCH /me/password, role-agnostic) ───────────────────────

export interface ChangePasswordPayload {
  oldPassword: string;
  newPassword: string;
}

export interface ChangePasswordResponse {
  success: boolean;
  message?: string;
}

// ─── Delivery Agency ──────────────────────────────────────────────────────────

export interface DeliveryAgencyHQAddress {
  /** Derived from the entry's geocode — `null` when it resolves none. */
  region: string | null;
  /** Derived from the entry's geocode — `null` for rural/landmark addresses. */
  city: string | null;
  /** Always present. Use it when `region`/`city` are null (see formatAgencyLocality). */
  address_description: string;
}

export interface DeliveryAgencyPolicies {
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

export interface DeliveryAgency {
  id: string;
  agencyName: string;
  /** Agency logo as a resolved file object (`{ id, key, url, … }`), or `null` if unset. */
  logo: FileRef | null;
  kycVerified: boolean;
  headquartersAddress: DeliveryAgencyHQAddress | null;
  coverageAreas: string[];
  rating: number | null;
  policies: DeliveryAgencyPolicies | null;
}

export interface AgencyListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── API Error ────────────────────────────────────────────────────────────────

/**
 * One field-level validation failure, normalized.
 *
 * The backend's Zod projection sends `details.fields[] = { path, message, code }`;
 * a few older endpoints documented a bare `details[] = { field, message }`.
 * `buildApiError` flattens both into this shape, so `field` is always populated
 * and `path`/`code` carry the raw values through for callers that want them.
 */
export interface ApiErrorDetail {
  field: string;
  message: string;
  /** The backend's dotted path (`translations.0.body.3.href`), when it sent one. */
  path?: string;
  /** Zod issue code (`invalid_string`, `too_small`, `custom`, …), when sent. */
  code?: string;
}

/**
 * `error.category` — the nine-value taxonomy every error carries (Phase 16).
 *
 * Branch on `error.code` when there is something particular to do; fall back to
 * the category for the ~547 codes there is not. See api-doc/errors/README.md.
 */
export type ApiErrorCategory =
  | 'authentication'
  | 'authorization'
  | 'validation'
  | 'not_found'
  | 'conflict'
  | 'business_rule'
  | 'rate_limit'
  | 'external_service'
  | 'internal';

/**
 * Machine-readable reasons returned per file when a file upload fails the
 * security/policy pipeline (`UPLOAD_POLICY_VIOLATION`). See
 * `api-doc/errors/README.md` §7.
 */
export type UploadViolationCode =
  /**
   * The four cheap pre-pipeline gates used to answer with hand-built
   * `{ code, message }` bodies; they now raise the same
   * `UPLOAD_POLICY_VIOLATION` the sniffing pipeline does, and their names appear
   * here instead of as a top-level `error.code`.
   */
  | 'NO_FILES_UPLOADED'
  | 'FILE_TOO_LARGE'
  | 'MIME_NOT_ALLOWED'
  | 'TOO_MANY_FILES'
  | 'QUOTA_EXCEEDED'
  | 'VIRUS_DETECTED'
  | 'PERMISSION_DENIED'
  | 'TOTAL_SIZE_EXCEEDED'
  | 'DUPLICATE_FILE'
  | 'MIME_TYPE_MISMATCH'
  | 'POLYGLOT_DETECTED'
  | 'UNDETECTABLE_TYPE';

/** One entry of `error.details.violations` on an `UPLOAD_POLICY_VIOLATION`. */
export interface UploadViolation {
  code: UploadViolationCode | string;
  message: string;
  /** 0-based index into the uploaded files array; absent for request-wide violations. */
  fileIndex?: number;
  metadata?: Record<string, unknown> & { originalName?: string; detectedMimeType?: string };
}

/** One entry of `error.details.blockedAddresses` on a `VENDOR_BUSINESS_ADDRESS_IN_USE`. */
export interface BlockedAddress {
  addressId: string;
  label: string;
  productCount: number;
}

/**
 * One per-row failure from an all-or-nothing bulk operation (e.g. inventory
 * `PATCH /vendor/inventory/bulk-update`). Backend returns the confirmed shape
 * `{ success: false, errors: [{ row, variantId, error, message }] }`; the older
 * `error.details.rowErrors` shape (row + error only) is also tolerated, so
 * `variantId`/`message` are optional.
 */
export interface ApiRowError {
  /** 1-indexed row number of the failing item. */
  row?: number;
  /** The variant that failed. */
  variantId?: string;
  /** Machine-readable error code (or the message text in the legacy shape). */
  error: string;
  /** Human-readable reason. Absent in the legacy `details.rowErrors` shape. */
  message?: string;
}

/**
 * Everything past `(status, code, message)`. An options bag rather than nine
 * positional parameters, so a call site that only carries violations does not
 * have to count `undefined`s to reach them.
 */
export interface ApiErrorExtras {
  details?: ApiErrorDetail[];
  requestId?: string;
  category?: ApiErrorCategory;
  retryAfterSeconds?: number;
  violations?: UploadViolation[];
  blockedAddresses?: BlockedAddress[];
  rowErrors?: ApiRowError[];
  detailsObject?: Record<string, unknown>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: ApiErrorDetail[];
  readonly requestId?: string;
  /**
   * The nine-value taxonomy, present on every backend error. Use it as the
   * default branch for codes with no specific handling — it is what tells you
   * whether to retry, re-authenticate, blame the input, or blame us.
   */
  readonly category?: ApiErrorCategory;
  /**
   * Seconds to wait before retrying, on a `429 RATE_LIMIT_EXCEEDED`. Read from
   * the `Retry-After` header first (the documented preference), falling back to
   * `details.retryAfterSeconds`.
   */
  readonly retryAfterSeconds?: number;
  /** Populated for `UPLOAD_POLICY_VIOLATION` — per-file upload failure reasons. */
  readonly violations?: UploadViolation[];
  /** Populated for `VENDOR_BUSINESS_ADDRESS_IN_USE` — which addresses blocked the update. */
  readonly blockedAddresses?: BlockedAddress[];
  /** Populated for all-or-nothing bulk operations — per-row validation failures. */
  readonly rowErrors?: ApiRowError[];
  /**
   * The raw non-array `error.details` object, for codes whose payload is not one
   * of the arrays lifted above — e.g. `CATALOG_PRODUCT_SIMPLE_MODE_LOCKED`'s
   * `{ mode, convertEndpoint }` or a `VALIDATION_ERROR`'s `{ fields }`. Without
   * this those payloads were parsed and discarded.
   */
  readonly detailsObject?: Record<string, unknown>;

  constructor(status: number, code: string, message: string, extra: ApiErrorExtras = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = extra.details;
    this.requestId = extra.requestId;
    this.category = extra.category;
    this.retryAfterSeconds = extra.retryAfterSeconds;
    this.violations = extra.violations;
    this.blockedAddresses = extra.blockedAddresses;
    this.rowErrors = extra.rowErrors;
    this.detailsObject = extra.detailsObject;
  }

  get isUnauthorized() {
    return this.status === 401;
  }

  get isForbidden() {
    return this.status === 403;
  }

  get isValidation() {
    return this.status === 400;
  }

  get isConflict() {
    return this.status === 409;
  }

  get isServer() {
    return this.status >= 500;
  }

  /**
   * The session ended and no refresh can save it: the account's password was
   * changed, so every token minted before it is refused — the refresh cookie
   * included. Terminal by contract: clear local state and sign in again.
   */
  get isPasswordChanged() {
    return this.status === 401 && this.code === 'AUTH_PASSWORD_CHANGED';
  }

  /** True when the file being deleted is still attached to something. */
  get isFileStillReferenced() {
    return this.status === 409 && this.code === 'CATALOG_FILE_STILL_REFERENCED';
  }

  /** True when a concurrent write was detected (OCC version mismatch). */
  get isConcurrentModification() {
    return this.status === 409 && this.code === 'VENDOR_ONBOARDING_CONCURRENT_MODIFICATION';
  }

  /** True when a `business_addresses` update was rejected because one or more
   *  addresses are still in use as a product's pickup location. */
  get isBusinessAddressInUse() {
    return this.status === 409 && this.code === 'VENDOR_BUSINESS_ADDRESS_IN_USE';
  }

  /** True when an advanced-only operation was attempted on a `mode: "simple"` product. */
  get isSimpleModeLocked() {
    return this.status === 409 && this.code === 'CATALOG_PRODUCT_SIMPLE_MODE_LOCKED';
  }

  /**
   * `details.convertEndpoint` on a simple-mode lock. This is a DISPLAY string of
   * the form `POST /api/vendor/products/<id>/convert-to-advanced` — it carries
   * the verb and the `/api` prefix that BASE_URL already supplies, so never
   * build a request from it. Call `convertToAdvanced(id)` instead.
   */
  get convertEndpoint(): string | null {
    const value = this.detailsObject?.convertEndpoint;
    return typeof value === 'string' ? value : null;
  }

  /**
   * Field-level validation errors, already flattened from either documented
   * shape by `buildApiError` — `details: [{ field, message }]` (legacy) or
   * `details: { fields: [{ path, message, code }] }` (the platform-wide Zod
   * projection). `field` is populated in both cases.
   */
  get fieldErrors(): ApiErrorDetail[] {
    return this.details ?? [];
  }
}
