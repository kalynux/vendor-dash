/**
 * Service listings — the provider's API (api-doc/vendor/service-listings.md).
 *
 * Mirrors `VendorListingSummary` / `VendorListingDetail` in jovi-mall
 * `modules/listings/dto/vendor-listing.dto.ts`, read from source rather than
 * the doc where the two differ in detail.
 *
 * ⛔ The word is `listing`, never `service`: `service` is already the bookable
 * product type a SELLER has.
 */

import type { FileRef } from './file.types';
import type { GeoAddress } from './geo.types';
import type { ProductCategory, CategoryWrite } from './category.types';
import type { RichDoc } from '@/lib/richtext';

// ─── Vocabulary ──────────────────────────────────────────────────────────────

export type ListingStatus =
    | 'draft'
    | 'pending_review'
    | 'rejected'
    | 'live'
    | 'suspended'
    | 'archived';

export const LISTING_STATUSES: readonly ListingStatus[] = [
    'draft',
    'pending_review',
    'rejected',
    'live',
    'suspended',
    'archived',
];

/** Why a listing is suspended. Each one is lifted only by its own path. */
export type ListingSuspensionReason =
    | 'insufficient_credits'
    | 'platform_oversight'
    | 'plan_quota_exceeded';

/** State of the working copy — a first submission, or a change to a live listing. */
export type ListingReviewState = 'editing' | 'pending_review' | 'rejected';

/** The hidden contact fields, in the order the customer's buttons are drawn. */
export type ListingContactField =
    | 'whatsapp'
    | 'phone'
    | 'email'
    | 'website'
    | 'socials'
    | 'location'
    | 'video';

export const LISTING_CONTACT_FIELDS: readonly ListingContactField[] = [
    'whatsapp',
    'phone',
    'email',
    'website',
    'socials',
    'location',
    'video',
];

export type ListingSocialNetwork =
    | 'facebook'
    | 'instagram'
    | 'tiktok'
    | 'x'
    | 'linkedin'
    | 'youtube'
    | 'other';

export const LISTING_SOCIAL_NETWORKS: readonly ListingSocialNetwork[] = [
    'facebook',
    'instagram',
    'tiktok',
    'x',
    'linkedin',
    'youtube',
    'other',
];

export type OpeningDay =
    | 'monday'
    | 'tuesday'
    | 'wednesday'
    | 'thursday'
    | 'friday'
    | 'saturday'
    | 'sunday';

export const OPENING_DAYS: readonly OpeningDay[] = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
];

/** The limits the server enforces (jovi-mall `listing.types.ts`). */
export const LISTING_LIMITS = {
    titleMax: 120,
    companyMax: 120,
    cityMax: 80,
    areaMax: 80,
    descriptionMin: 20,
    descriptionMax: 5000,
    photosMax: 10,
    categoriesMax: 5,
    socialsMax: 5,
    reportReasonMin: 10,
    reportReasonMax: 700,
    messageMax: 1000,
} as const;

// ─── Reads ───────────────────────────────────────────────────────────────────

export interface ListingOpeningHours {
    day: OpeningDay;
    /** "HH:MM", 24-hour. */
    openTime: string;
    closeTime: string;
    isClosed: boolean;
}

export interface ListingReview {
    state: ListingReviewState;
    submittedAt: string | null;
    decidedAt: string | null;
    /** The reviewer's reasons when `state` is `rejected`. Plain text from a person. */
    reasons: string[];
}

export interface ListingSuspension {
    reason: ListingSuspensionReason;
    previousStatus: ListingStatus;
    at: string | null;
    /** Only for `platform_oversight` — the administrator's note. */
    note: string | null;
}

export interface VendorListingSummary {
    id: string;
    slug: string;
    status: ListingStatus;
    title: string;
    companyName: string;
    /** A live listing carries an edited copy (submitted or not). */
    hasRevision: boolean;
    review: ListingReview | null;
    suspension: ListingSuspension | null;
    /** Which contact buttons the PUBLIC card draws — names only, never values. */
    availableFields: ListingContactField[];
    vectorisationStatus: string;
    publishedAt: string | null;
    createdAt: string | null;
    updatedAt: string | null;
}

export interface ListingContent {
    title: string;
    companyName: string;
    categories: ProductCategory[];
    /** ISO-3166-1 alpha-2. */
    country: string;
    city: string;
    /** The neighbourhood — public, and searchable. */
    area: string;
    description: string;
    descriptionRich: RichDoc | null;
    photoFileIds: string[];
    photos: FileRef[];
    openingHours: ListingOpeningHours[] | null;
}

export interface ListingSocialLink {
    network: ListingSocialNetwork;
    url: string;
}

export interface ListingVideo {
    url: string;
    host: 'youtube' | 'google_drive' | string;
    checkedAt: string | null;
}

/** The HIDDEN contacts — the provider's own, only ever in their own editor. */
export interface ListingContacts {
    whatsapp: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    socials: ListingSocialLink[];
    location: GeoAddress | null;
    video: ListingVideo | null;
}

export interface VendorListingDetail extends VendorListingSummary {
    /** The approved version customers see. `null` until the first approval. */
    published: ListingContent | null;
    /** The working copy. `null` on a live listing nobody is editing. */
    pending: ListingContent | null;
    contacts: { published: ListingContacts | null; pending: ListingContacts | null };
    lastDecision: { decision: string; at: string | null; reasons: string[] } | null;
    archivedAt: string | null;
}

export interface ListingPageMeta {
    page: number;
    limit: number;
    total: number;
    pages?: number;
    totalPages?: number;
}

// ─── Writes ──────────────────────────────────────────────────────────────────

/** Every field optional: a half-written draft saves. Completeness is judged at submit. */
export interface ListingContentInput {
    title?: string;
    companyName?: string;
    categories?: CategoryWrite[];
    country?: string;
    city?: string;
    area?: string;
    description?: string;
    /** Absent = leave alone, object = replace, `null` = clear. */
    descriptionRich?: RichDoc | null;
    photoFileIds?: string[];
    openingHours?: ListingOpeningHours[] | null;
}

/** `null` clears a contact; absent leaves it alone. */
export interface ListingContactsInput {
    whatsapp?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    socials?: ListingSocialLink[];
    location?: Omit<GeoAddress, 'resolved_at'> | null;
    video?: { url: string } | null;
}

export interface ListingWriteInput {
    content?: ListingContentInput;
    contacts?: ListingContactsInput;
}

/** `details.missing[]` of `422 LISTING_INCOMPLETE`. */
export type ListingMissingField =
    | 'title'
    | 'companyName'
    | 'categories'
    | 'country'
    | 'city'
    | 'area'
    | 'description'
    | 'contact';

// ─── Settings ────────────────────────────────────────────────────────────────

export type ListingOnEmpty = 'continue_engaged' | 'stop';

export interface ListingSettings {
    onEmpty: ListingOnEmpty;
    /** ≤ 0. `null` = no limit on how far negative the balance may go. */
    debtFloor: number | null;
    /** ≥ the first-unlock cost. `null` = no daily limit per customer. */
    maxCreditsPerCustomerPerDay: number | null;
}

// ─── Leads ───────────────────────────────────────────────────────────────────

export type LeadConsent = 'granted' | 'not_granted' | 'revoked';
export type LeadChannel = 'web' | 'whatsapp' | 'telegram';

export interface LeadField {
    field: ListingContactField;
    revealId: string;
    at: string;
    cost: number;
    refunded: boolean;
}

/**
 * One customer on one listing, in one 30-day window.
 *
 * ⛔ The customer is MASKED on purpose (first name, last initial, country code
 * and two digits). Never store, cache or log a row — no list cache, no
 * localStorage, no console.
 */
export interface VendorLead {
    id: string;
    listingId: string;
    listingTitle: string;
    customer: { displayName: string | null; maskedPhone: string | null };
    fields: LeadField[];
    windowStart: string;
    windowEnd: string;
    consent: LeadConsent;
    channel: LeadChannel;
    callMeAvailable: boolean;
    freeTextAvailable: boolean;
    messagesLeft: number;
    reportOpen: boolean;
}

export interface ProviderMessage {
    id: string;
    kind: 'call_me' | 'free_text';
    channel: 'whatsapp' | 'telegram';
    status: 'sent' | 'failed';
    credits: number;
    at: string;
}

export type LeadReportWant = 'refund' | 'check_customer';

export interface LeadReportInput {
    wants: LeadReportWant[];
    revealIds: string[];
    reason: string;
}

export interface LeadReportResult {
    ticketId: string;
    /** The short `#A1B2C3` reference. */
    ticketNumber: string;
}

// ─── Credit prices (GET /public/credit-packs → actionCosts) ──────────────────

/** Never hard-coded: the server reads them from its environment. */
export interface ListingActionCosts {
    listingRevealFirst: number;
    listingRevealNext: number;
    vectorisation: number;
    whatsappTemplate: number;
}
