export interface AgencyFilters {
    search: string;
    region: string;
    hq_city: string;
    storage_based: boolean;
    pickup_based: boolean;
    returns_payer: 'vendor' | 'agency' | 'customer' | '';
    min_claim_deadline_days: string;
}

export const INITIAL_AGENCY_FILTERS: AgencyFilters = {
    search: '',
    region: '',
    hq_city: '',
    storage_based: false,
    pickup_based: false,
    returns_payer: '',
    min_claim_deadline_days: '',
};

export function countActiveAgencyFilters(f: AgencyFilters): number {
    return [
        f.region !== '',
        f.hq_city !== '',
        f.storage_based,
        f.pickup_based,
        f.returns_payer !== '',
        f.min_claim_deadline_days !== '',
    ].filter(Boolean).length;
}
