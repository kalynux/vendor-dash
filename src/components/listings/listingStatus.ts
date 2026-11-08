/**
 * A listing's state, in words — for the list rows and the editor's status block.
 *
 * Labels are `TranslationKey`s resolved at the call site (this module has no
 * React context). The rules for what a provider may do mirror the backend's
 * `canPerform` (jovi-mall `listing-rules.ts`), so a button is never offered for
 * a move the server would refuse with `409 LISTING_STATUS_CONFLICT`.
 */

import type { TranslationKey } from '@/i18n';
import type {
    VendorLead,
    ListingStatus,
    ListingSuspensionReason,
    VendorListingDetail,
    VendorListingSummary,
} from '@/types/listings.types';

export type StatusTone = 'neutral' | 'waiting' | 'good' | 'warning' | 'bad';

export const STATUS_KEYS: Record<ListingStatus, TranslationKey> = {
    draft: 'listings.status.draft',
    pending_review: 'listings.status.pending_review',
    rejected: 'listings.status.rejected',
    live: 'listings.status.live',
    suspended: 'listings.status.suspended',
    archived: 'listings.status.archived',
};

export const SUSPENSION_KEYS: Record<ListingSuspensionReason, { short: TranslationKey; long: TranslationKey }> = {
    insufficient_credits: {
        short: 'listings.suspension.insufficient_credits',
        long: 'listings.suspension.insufficient_creditsLong',
    },
    platform_oversight: {
        short: 'listings.suspension.platform_oversight',
        long: 'listings.suspension.platform_oversightLong',
    },
    plan_quota_exceeded: {
        short: 'listings.suspension.plan_quota_exceeded',
        long: 'listings.suspension.plan_quotaLong',
    },
};

/** Dot colour per tone — a dot and words, never a pill restating the words. */
export const TONE_DOT: Record<StatusTone, string> = {
    neutral: 'bg-muted-foreground/50',
    waiting: 'bg-amber-500',
    good: 'bg-emerald-500',
    warning: 'bg-amber-500',
    bad: 'bg-red-500',
};

/**
 * The one line a list row shows under its title: the status, sharpened by the
 * suspension reason or a pending change when there is one.
 */
export function listingStatusLine(l: VendorListingSummary): { key: TranslationKey; tone: StatusTone } {
    if (l.status === 'suspended' && l.suspension) {
        return { key: SUSPENSION_KEYS[l.suspension.reason]?.short ?? STATUS_KEYS.suspended, tone: 'bad' };
    }
    if (l.status === 'live' && l.hasRevision) {
        if (l.review?.state === 'pending_review') return { key: 'listings.statusLine.changesWaiting', tone: 'waiting' };
        if (l.review?.state === 'rejected') return { key: 'listings.statusLine.changesRejected', tone: 'warning' };
    }
    switch (l.status) {
        case 'live':
            return { key: STATUS_KEYS.live, tone: 'good' };
        case 'pending_review':
            return { key: STATUS_KEYS.pending_review, tone: 'waiting' };
        case 'rejected':
            return { key: STATUS_KEYS.rejected, tone: 'bad' };
        case 'archived':
            return { key: STATUS_KEYS.archived, tone: 'neutral' };
        default:
            return { key: STATUS_KEYS.draft, tone: 'neutral' };
    }
}

/** What the provider may do now — the backend's `canPerform`, read from the detail. */
export interface ListingAbilities {
    edit: boolean;
    submit: boolean;
    withdraw: boolean;
    discardRevision: boolean;
    archive: boolean;
}

export function listingAbilities(l: VendorListingDetail | null): ListingAbilities {
    // A listing that does not exist yet can only be written.
    if (!l) return { edit: true, submit: true, withdraw: false, discardRevision: false, archive: false };
    if (l.status === 'archived') {
        return { edit: false, submit: false, withdraw: false, discardRevision: false, archive: false };
    }
    const hasPending = !!l.pending;
    const hasPublished = !!l.published;
    const state = l.review?.state ?? null;
    return {
        edit: state !== 'pending_review' && (hasPending || hasPublished),
        // A live listing with no working copy has nothing to submit until an edit
        // opens one — the editor saves first, so the button still works then.
        submit: state !== 'pending_review',
        withdraw: state === 'pending_review',
        discardRevision: hasPublished && hasPending,
        archive: true,
    };
}

// ─── Leads ───────────────────────────────────────────────────────────────────

/** What a customer unlocked, in words. */
export const LEAD_FIELD_KEYS: Record<string, TranslationKey> = {
  whatsapp: 'listings.leads.field.whatsapp',
  phone: 'listings.leads.field.phone',
  email: 'listings.leads.field.email',
  website: 'listings.leads.field.website',
  socials: 'listings.leads.field.socials',
  location: 'listings.leads.field.location',
  video: 'listings.leads.field.video',
};

/** The masked name the server gave, or "A customer" when it has none. */
export function leadName(lead: VendorLead, fallback: string): string {
  return lead.customer.displayName || fallback;
}

