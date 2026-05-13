// ─── API User ────────────────────────────────────────────────────────────────

export interface ApiUser {
  _id: string;
  login_phone: string;
  login_email?: string;
  roles: string[];
  status: 'active' | 'suspended' | 'pending_verification';
}

// ─── Vendor Role Entity ───────────────────────────────────────────────────────

export interface Branding {
  logo_url: string | null;
  cover_image_url: string | null;
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

// Step 2 — Delivery Linking (skippable)
export type DeliveryLinkingPayload =
  | { default_delivery_agency_id: string; skip?: false; version?: number }
  | { skip: true };

// Step 3 — Branding (skippable)
export type BrandingPayload =
  | { skip?: false; branding?: Partial<Branding>; business_addresses?: BusinessAddress[]; version?: number }
  | { skip: true };

// Step 4 — Policy Setup (skippable; all three sub-policies are independently optional)
export type PolicySetupPayload =
  | { skip: true }
  | {
      skip?: false;
      return_policy?: ReturnPolicy;
      cancellation_policy?: CancellationPolicy;
      support_policy?: SupportPolicy;
      version?: number;
    };

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

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: ApiErrorDetail[];
  readonly requestId?: string;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: ApiErrorDetail[],
    requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
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
}
