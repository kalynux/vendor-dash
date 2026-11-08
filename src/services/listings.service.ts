import { useEffect, useState } from 'react';

import { api } from './api';
import type {
    LeadReportInput,
    LeadReportResult,
    ListingActionCosts,
    ListingPageMeta,
    ListingSettings,
    ListingStatus,
    ListingWriteInput,
    ProviderMessage,
    VendorLead,
    VendorListingDetail,
    VendorListingSummary,
} from '@/types/listings.types';

/**
 * Service listings, listing settings and leads — the three PROVIDER sections
 * (api-doc/vendor/service-listings.md). Every route here answers
 * `403 AUTH_VENDOR_KIND_FORBIDDEN` to a seller, which is why no seller screen
 * ever calls one.
 */

const LISTINGS = '/vendor/listings';
const SETTINGS = '/vendor/listing-settings';
const LEADS = '/vendor/leads';

interface Envelope<T> {
    success: boolean;
    data: T;
}

interface PageEnvelope<T> extends Envelope<T[]> {
    meta: ListingPageMeta;
}

export interface ListingPage<T> {
    items: T[];
    total: number;
    totalPages: number;
}

function toPage<T>(res: PageEnvelope<T>): ListingPage<T> {
    const meta = res.meta ?? { page: 1, limit: res.data.length, total: res.data.length };
    const pages = meta.pages ?? meta.totalPages ?? Math.max(1, Math.ceil(meta.total / Math.max(1, meta.limit)));
    return { items: res.data ?? [], total: meta.total ?? 0, totalPages: pages };
}

function query(params: Record<string, string | number | undefined>): string {
    const q = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== '') q.set(key, String(value));
    }
    const s = q.toString();
    return s ? `?${s}` : '';
}

// ─── Listings ────────────────────────────────────────────────────────────────

export async function fetchListings(params: {
    status?: ListingStatus;
    /** Title or business name, 1–200 characters. Omitted when empty — `q=""` is a 400. */
    q?: string;
    page: number;
    limit: number;
}): Promise<ListingPage<VendorListingSummary>> {
    const q = params.q?.trim().slice(0, 200) || undefined;
    const res = await api.get<PageEnvelope<VendorListingSummary>>(`${LISTINGS}${query({ ...params, q })}`);
    return toPage(res);
}

export async function fetchListing(id: string): Promise<VendorListingDetail> {
    const res = await api.get<Envelope<VendorListingDetail>>(`${LISTINGS}/${encodeURIComponent(id)}`);
    return res.data;
}

export async function createListing(body: ListingWriteInput): Promise<VendorListingDetail> {
    const res = await api.post<Envelope<VendorListingDetail>>(LISTINGS, body);
    return res.data;
}

export async function updateListing(id: string, body: ListingWriteInput): Promise<VendorListingDetail> {
    const res = await api.patch<Envelope<VendorListingDetail>>(
        `${LISTINGS}/${encodeURIComponent(id)}`,
        body,
    );
    return res.data;
}

/** Takes the indexing fee (`actionCosts.vectorisation`); returned on rejection or withdrawal. */
export async function submitListing(id: string): Promise<VendorListingDetail> {
    const res = await api.post<Envelope<VendorListingDetail>>(`${LISTINGS}/${encodeURIComponent(id)}/submit`);
    return res.data;
}

export async function withdrawListing(id: string): Promise<VendorListingDetail> {
    const res = await api.post<Envelope<VendorListingDetail>>(`${LISTINGS}/${encodeURIComponent(id)}/withdraw`);
    return res.data;
}

/** Drops a live listing's pending change. The approved version stays live. */
export async function discardListingRevision(id: string): Promise<VendorListingDetail> {
    const res = await api.delete<Envelope<VendorListingDetail>>(`${LISTINGS}/${encodeURIComponent(id)}/revision`);
    return res.data;
}

/** Terminal. */
export async function archiveListing(id: string): Promise<VendorListingDetail> {
    const res = await api.post<Envelope<VendorListingDetail>>(`${LISTINGS}/${encodeURIComponent(id)}/archive`);
    return res.data;
}

// ─── Settings ────────────────────────────────────────────────────────────────

export async function fetchListingSettings(): Promise<ListingSettings> {
    const res = await api.get<Envelope<ListingSettings>>(SETTINGS);
    return res.data;
}

/** A PUT: all three fields, every time. */
export async function saveListingSettings(body: ListingSettings): Promise<ListingSettings> {
    const res = await api.put<Envelope<ListingSettings>>(SETTINGS, body);
    return res.data;
}

// ─── Leads ───────────────────────────────────────────────────────────────────
// ⛔ Masked customer data. Nothing below caches a row, and nothing logs one.

export async function fetchLeads(params: {
    listingId?: string;
    page: number;
    limit: number;
}): Promise<ListingPage<VendorLead>> {
    const res = await api.get<PageEnvelope<VendorLead>>(`${LEADS}${query(params)}`);
    return toPage(res);
}

/** "Ask them to call me". Costs `actionCosts.whatsappTemplate`; refunded when it fails. */
export async function sendCallMe(leadId: string): Promise<ProviderMessage> {
    const res = await api.post<Envelope<{ message: ProviderMessage }>>(
        `${LEADS}/${encodeURIComponent(leadId)}/call-me`,
    );
    return res.data.message;
}

/** Free text, relayed by Wi-Mall. No credits. */
export async function sendLeadMessage(leadId: string, body: string): Promise<ProviderMessage> {
    const res = await api.post<Envelope<{ message: ProviderMessage }>>(
        `${LEADS}/${encodeURIComponent(leadId)}/message`,
        { body },
    );
    return res.data.message;
}

export async function reportLead(leadId: string, body: LeadReportInput): Promise<LeadReportResult> {
    const res = await api.post<Envelope<LeadReportResult>>(
        `${LEADS}/${encodeURIComponent(leadId)}/report`,
        body,
    );
    return res.data;
}

// ─── Prices ──────────────────────────────────────────────────────────────────

interface PublicCreditCatalog {
    success: boolean;
    data: { actionCosts?: Partial<Record<keyof ListingActionCosts, unknown>> };
}

const isCost = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

let costsRequest: Promise<ListingActionCosts | null> | null = null;

/**
 * What an unlock, a submission and a call-me cost, read from the public price
 * list once per app session.
 *
 * ⛔ Never hard-coded, and there is deliberately NO fallback number: the server
 * reads these from its environment, and a guessed price shown to a provider is
 * a promise the bill will not keep. When the list cannot be read this resolves
 * `null` and the screens explain the rule without figures.
 */
export function fetchListingActionCosts(): Promise<ListingActionCosts | null> {
    costsRequest ??= api
        .get<PublicCreditCatalog>('/public/credit-packs')
        .then((res) => {
            const c = res.data?.actionCosts ?? {};
            if (
                !isCost(c.listingRevealFirst) ||
                !isCost(c.listingRevealNext) ||
                !isCost(c.vectorisation) ||
                !isCost(c.whatsappTemplate)
            ) {
                return null;
            }
            return {
                listingRevealFirst: c.listingRevealFirst,
                listingRevealNext: c.listingRevealNext,
                vectorisation: c.vectorisation,
                whatsappTemplate: c.whatsappTemplate,
            };
        })
        .catch(() => {
            costsRequest = null; // try again next time a screen asks
            return null;
        });
    return costsRequest;
}

/** The prices, or `null` while loading or when the list could not be read. */
export function useListingActionCosts(): ListingActionCosts | null {
    const [costs, setCosts] = useState<ListingActionCosts | null>(null);
    useEffect(() => {
        let cancelled = false;
        void fetchListingActionCosts().then((c) => {
            if (!cancelled) setCosts(c);
        });
        return () => {
            cancelled = true;
        };
    }, []);
    return costs;
}
