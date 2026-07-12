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

/** Read shape — `GET /vendor/profile` and every onboarding step response. */
export interface Branding {
  logo: BrandingFileRef | null;
  coverImage: BrandingFileRef | null;
}

/** Write shape — `PATCH /vendor/profile` and the onboarding branding step. */
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

export type PayoutDetails =
  | { method: 'mobile_money'; mobile_money: MobileMoneyDetails; bank?: null }
  | { method: 'bank'; bank: BankDetails; mobile_money?: null };

export interface VendorRoleEntity {
  _id: string;
  user_id: string;
  business_name: string;
  display_name: string | null;
  business_description: string | null;
  email: string;
  phone: string;
  email_verified: boolean;
  phone_verified: boolean;
  country: string | null;
  timezone: string;
  /** Language every notification is rendered in (en | fr | pt | es | ar). Default `en`. */
  preferred_language?: string | null;
  branding: Branding;
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

export interface VendorProfileUpdatePayload {
  displayName?: string;
  businessDescription?: string | null;
  phone?: string;
  country?: string;
  timezone?: string;
  /** Language for rendered notifications (en | fr | pt | es | ar). */
  preferred_language?: string;
  payout_details?: PayoutDetails[];
  branding?: BrandingWritePayload;
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

// ─── Password change (PATCH /vendor/profile/password) ──────────────────────────

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
  region: string;
  city: string;
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
  logoUrl: string | null;
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

/** Shape of individual validation error entries returned by the backend. */
export interface ApiErrorDetail {
  field: string;
  message: string;
}

/**
 * Machine-readable reasons returned per file when a file upload fails the
 * security/policy pipeline (`UPLOAD_POLICY_VIOLATION`). See
 * `api-doc/errors/README.md` §7.
 */
export type UploadViolationCode =
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

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: ApiErrorDetail[];
  readonly requestId?: string;
  /** Populated for `UPLOAD_POLICY_VIOLATION` — per-file upload failure reasons. */
  readonly violations?: UploadViolation[];
  /** Populated for `VENDOR_BUSINESS_ADDRESS_IN_USE` — which addresses blocked the update. */
  readonly blockedAddresses?: BlockedAddress[];

  constructor(
    status: number,
    code: string,
    message: string,
    details?: ApiErrorDetail[],
    requestId?: string,
    violations?: UploadViolation[],
    blockedAddresses?: BlockedAddress[],
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
    this.violations = violations;
    this.blockedAddresses = blockedAddresses;
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

  /** True when a concurrent write was detected (OCC version mismatch). */
  get isConcurrentModification() {
    return this.status === 409 && this.code === 'VENDOR_ONBOARDING_CONCURRENT_MODIFICATION';
  }

  /** True when a `business_addresses` update was rejected because one or more
   *  addresses are still in use as a product's pickup location. */
  get isBusinessAddressInUse() {
    return this.status === 409 && this.code === 'VENDOR_BUSINESS_ADDRESS_IN_USE';
  }
}
