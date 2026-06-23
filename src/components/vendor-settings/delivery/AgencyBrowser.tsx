import { useState, useEffect, useCallback, useRef } from 'react';
import {
    Loader2, ChevronRight, Check, Building2, MapPin,
    Search, SlidersHorizontal, Info, ShieldCheck, Shield, X,
    Warehouse, Truck, RotateCcw, AlertCircle,
} from 'lucide-react';

import { onboardingService } from '@/services/onboarding.service';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ApiError, type DeliveryAgency, type AgencyListMeta } from '@/types/api';
import { cn } from '@/lib/utils';

// ─── Filters ──────────────────────────────────────────────────────────────────

interface Filters {
    search: string;
    region: string;
    hq_city: string;
    storage_based: boolean;
    pickup_based: boolean;
    returns_payer: 'vendor' | 'agency' | 'customer' | '';
    min_claim_deadline_days: string;
}

const INITIAL_FILTERS: Filters = {
    search: '',
    region: '',
    hq_city: '',
    storage_based: false,
    pickup_based: false,
    returns_payer: '',
    min_claim_deadline_days: '',
};

function countActiveFilters(f: Filters): number {
    return [
        f.region !== '',
        f.hq_city !== '',
        f.storage_based,
        f.pickup_based,
        f.returns_payer !== '',
        f.min_claim_deadline_days !== '',
    ].filter(Boolean).length;
}

// ─── Agency Detail Sheet ──────────────────────────────────────────────────────

function PolicyRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-start justify-between gap-3 py-2">
            <span className="text-xs text-muted-foreground shrink-0">{label}</span>
            <span className="text-xs font-medium text-right">{value}</span>
        </div>
    );
}

function AgencyDetailSheet({
    agency,
    open,
    onOpenChange,
    selected,
    onSelect,
}: {
    agency: DeliveryAgency | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selected: boolean;
    onSelect: () => void;
}) {
    if (!agency) return null;

    const hq = agency.headquartersAddress;
    const p = agency.policies;

    const returnsPayer: Record<string, string> = {
        vendor: 'Vendor bears cost',
        agency: 'Agency bears cost',
        customer: 'Customer bears cost',
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="bottom"
                className="max-h-[85vh] flex flex-col rounded-t-2xl px-0 pb-0"
            >
                {/* Drag handle */}
                <div className="mx-auto w-10 h-1 bg-muted rounded-full mt-2 mb-1 flex-shrink-0" />

                <SheetHeader className="px-5 pb-2 flex-shrink-0">
                    <div className="flex items-start gap-3">
                        <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden border border-border">
                            {agency.logoUrl ? (
                                <img
                                    src={agency.logoUrl}
                                    alt={agency.agencyName}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <Building2 className="w-7 h-7 text-muted-foreground" />
                            )}
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                            <SheetTitle className="text-base leading-tight">{agency.agencyName}</SheetTitle>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {agency.kycVerified ? (
                                    <Badge variant="secondary" className="gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950 dark:border-emerald-800">
                                        <ShieldCheck className="w-3 h-3" />
                                        KYC Verified
                                    </Badge>
                                ) : (
                                    <Badge variant="secondary" className="gap-1 text-xs font-medium text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-800">
                                        <Shield className="w-3 h-3" />
                                        Unverified
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>
                </SheetHeader>

                <Separator className="flex-shrink-0" />

                {/* Scrollable content */}
                <ScrollArea className="flex-1 overflow-hidden">
                    <div className="px-5 py-4 space-y-5">

                        {/* Headquarters */}
                        {hq && (
                            <section>
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                                    Headquarters
                                </h3>
                                <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                                    <p className="text-sm font-medium">{hq.city}, {hq.region}</p>
                                    <p className="text-xs text-muted-foreground">{hq.address_description}</p>
                                </div>
                            </section>
                        )}

                        {/* Coverage Areas */}
                        {agency.coverageAreas.length > 0 && (
                            <section>
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                                    Coverage Areas
                                </h3>
                                <div className="flex flex-wrap gap-1.5">
                                    {agency.coverageAreas.map((area) => (
                                        <Badge key={area} variant="secondary" className="text-xs capitalize">
                                            {area}
                                        </Badge>
                                    ))}
                                </div>
                            </section>
                        )}

                        {p && (
                            <>
                                {/* Pricing Policy */}
                                <section>
                                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                                        Pricing
                                    </h3>
                                    <div className="rounded-lg border divide-y">
                                        <PolicyRow
                                            label="Storage-based"
                                            value={
                                                <span className={cn('flex items-center gap-1', p.pricing.storage_based_enabled ? 'text-emerald-600' : 'text-muted-foreground')}>
                                                    <Warehouse className="w-3 h-3" />
                                                    {p.pricing.storage_based_enabled ? 'Available' : 'Not available'}
                                                </span>
                                            }
                                        />
                                        <PolicyRow
                                            label="Pickup-based"
                                            value={
                                                <span className={cn('flex items-center gap-1', p.pricing.pickup_based_enabled ? 'text-emerald-600' : 'text-muted-foreground')}>
                                                    <Truck className="w-3 h-3" />
                                                    {p.pricing.pickup_based_enabled ? 'Available' : 'Not available'}
                                                </span>
                                            }
                                        />
                                        {p.pricing.notes && (
                                            <div className="px-3 py-2">
                                                <p className="text-xs text-muted-foreground">{p.pricing.notes}</p>
                                            </div>
                                        )}
                                    </div>
                                </section>

                                {/* Returns Policy */}
                                <section>
                                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                                        Returns
                                    </h3>
                                    <div className="rounded-lg border divide-y">
                                        <PolicyRow
                                            label="Cost paid by"
                                            value={
                                                <span className="flex items-center gap-1">
                                                    <RotateCcw className="w-3 h-3" />
                                                    {returnsPayer[p.returns.payer] ?? p.returns.payer}
                                                </span>
                                            }
                                        />
                                        <PolicyRow
                                            label="Return window"
                                            value={
                                                p.returns.return_window_days === 0
                                                    ? 'No returns accepted'
                                                    : `${p.returns.return_window_days} days after delivery`
                                            }
                                        />
                                        {p.returns.notes && (
                                            <div className="px-3 py-2">
                                                <p className="text-xs text-muted-foreground">{p.returns.notes}</p>
                                            </div>
                                        )}
                                    </div>
                                </section>

                                {/* Damage Policy */}
                                <section>
                                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                                        Damage Claims
                                    </h3>
                                    <div className="rounded-lg border divide-y">
                                        <PolicyRow
                                            label="Claim deadline"
                                            value={
                                                <span className="flex items-center gap-1">
                                                    <AlertCircle className="w-3 h-3" />
                                                    {p.damage.claim_deadline_days} days after delivery
                                                </span>
                                            }
                                        />
                                        <PolicyRow
                                            label="Max refund per item"
                                            value={`${p.damage.max_refund_per_item.toLocaleString()} XAF`}
                                        />
                                        {p.damage.notes && (
                                            <div className="px-3 py-2">
                                                <p className="text-xs text-muted-foreground">{p.damage.notes}</p>
                                            </div>
                                        )}
                                    </div>
                                </section>
                            </>
                        )}
                    </div>
                </ScrollArea>

                {/* Select button */}
                <div className="px-5 py-4 border-t flex-shrink-0">
                    <Button
                        type="button"
                        onClick={() => { onSelect(); onOpenChange(false); }}
                        className={cn('w-full h-12 text-base font-semibold gap-2', selected && 'bg-emerald-600 hover:bg-emerald-700')}
                    >
                        {selected ? (
                            <>
                                <Check className="w-4 h-4" />
                                Selected
                            </>
                        ) : (
                            <>
                                Select this agency
                                <ChevronRight className="w-4 h-4" />
                            </>
                        )}
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
}

// ─── Agency Card ──────────────────────────────────────────────────────────────

function AgencyCard({
    agency,
    selected,
    onSelect,
    onInfo,
}: {
    agency: DeliveryAgency;
    selected: boolean;
    onSelect: () => void;
    onInfo: () => void;
}) {
    const hq = agency.headquartersAddress;
    const p = agency.policies;

    return (
        <div
            className={cn(
                'rounded-xl border-2 overflow-hidden transition-all duration-200',
                selected ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-card',
            )}
        >
            <div className="flex items-stretch">
                {/* Selectable main area */}
                <button
                    type="button"
                    onClick={onSelect}
                    aria-pressed={selected}
                    className="flex-1 p-4 text-left min-w-0 hover:bg-accent/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                    <div className="flex items-start gap-3">
                        <div
                            className={cn(
                                'w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden',
                                selected ? 'bg-primary/10' : 'bg-muted',
                            )}
                        >
                            {agency.logoUrl ? (
                                <img
                                    src={agency.logoUrl}
                                    alt={agency.agencyName}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <Building2
                                    className={cn('w-5 h-5', selected ? 'text-primary' : 'text-muted-foreground')}
                                />
                            )}
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="font-semibold text-sm truncate">{agency.agencyName}</p>
                                {agency.kycVerified && (
                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" aria-label="KYC Verified" />
                                )}
                                {selected && (
                                    <div className="w-4 h-4 bg-primary rounded-full flex items-center justify-center flex-shrink-0 ml-auto">
                                        <Check className="w-2.5 h-2.5 text-primary-foreground" />
                                    </div>
                                )}
                            </div>

                            {hq && (
                                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                    <MapPin className="w-3 h-3 flex-shrink-0" />
                                    <span className="truncate">{hq.city}, {hq.region}</span>
                                </p>
                            )}

                            {p && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                    {p.pricing.storage_based_enabled && (
                                        <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                            <Warehouse className="w-2.5 h-2.5" />
                                            Storage
                                        </span>
                                    )}
                                    {p.pricing.pickup_based_enabled && (
                                        <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                            <Truck className="w-2.5 h-2.5" />
                                            Pickup
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </button>

                {/* Info button */}
                <button
                    type="button"
                    onClick={onInfo}
                    aria-label={`View details for ${agency.agencyName}`}
                    className="flex items-center justify-center w-12 flex-shrink-0 border-l border-border/60 text-muted-foreground hover:text-foreground hover:bg-accent/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                    <Info className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}

// ─── Skeleton list ────────────────────────────────────────────────────────────

function AgencySkeleton() {
    return (
        <div className="space-y-3 p-1">
            {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl border p-4 flex items-center gap-3">
                    <Skeleton className="w-11 h-11 rounded-lg flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-3 w-1/3" />
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── Filters Panel ────────────────────────────────────────────────────────────

function FiltersPanel({
    filters,
    onChange,
    onClear,
}: {
    filters: Filters;
    onChange: (key: keyof Filters, value: string | boolean) => void;
    onClear: () => void;
}) {
    return (
        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <Label htmlFor="filter-region" className="text-xs">Region</Label>
                    <Input
                        id="filter-region"
                        placeholder="e.g. Littoral"
                        value={filters.region}
                        onChange={e => onChange('region', e.target.value)}
                        className="h-8 text-sm"
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="filter-city" className="text-xs">City</Label>
                    <Input
                        id="filter-city"
                        placeholder="e.g. Douala"
                        value={filters.hq_city}
                        onChange={e => onChange('hq_city', e.target.value)}
                        className="h-8 text-sm"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <Label className="text-xs">Returns payer</Label>
                    <Select
                        value={filters.returns_payer}
                        onValueChange={v => onChange('returns_payer', v === '_all' ? '' : v)}
                    >
                        <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Any" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="_all">Any</SelectItem>
                            <SelectItem value="vendor">Vendor</SelectItem>
                            <SelectItem value="agency">Agency</SelectItem>
                            <SelectItem value="customer">Customer</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="filter-claim" className="text-xs">Min. claim window (days)</Label>
                    <Input
                        id="filter-claim"
                        type="number"
                        min={0}
                        placeholder="e.g. 7"
                        value={filters.min_claim_deadline_days}
                        onChange={e => onChange('min_claim_deadline_days', e.target.value)}
                        className="h-8 text-sm"
                    />
                </div>
            </div>

            <div className="flex items-center gap-5">
                <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                        id="filter-storage"
                        checked={filters.storage_based}
                        onCheckedChange={v => onChange('storage_based', !!v)}
                    />
                    <span className="text-xs flex items-center gap-1">
                        <Warehouse className="w-3 h-3" /> Storage-based
                    </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                        id="filter-pickup"
                        checked={filters.pickup_based}
                        onCheckedChange={v => onChange('pickup_based', !!v)}
                    />
                    <span className="text-xs flex items-center gap-1">
                        <Truck className="w-3 h-3" /> Pickup-based
                    </span>
                </label>
            </div>

            <button
                type="button"
                onClick={onClear}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
                <X className="w-3 h-3" />
                Clear filters
            </button>
        </div>
    );
}

// ─── AgencyBrowser ────────────────────────────────────────────────────────────
// Search + filter + paginated list + detail sheet. Selection is controlled by
// the parent via `selectedId` / `onSelect`. Used by onboarding Step 2 and the
// Settings → Delivery tab.

export interface AgencyBrowserProps {
    selectedId: string | null;
    onSelect: (id: string) => void;
    /** Tailwind height for the scroll list (default 42vh). */
    listHeightClass?: string;
}

export function AgencyBrowser({ selectedId, onSelect, listHeightClass = 'h-[42vh] min-h-[160px]' }: AgencyBrowserProps) {
    const [agencies, setAgencies] = useState<DeliveryAgency[]>([]);
    const [meta, setMeta] = useState<AgencyListMeta | null>(null);
    const [loadingAgencies, setLoadingAgencies] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);

    const [detailAgency, setDetailAgency] = useState<DeliveryAgency | null>(null);

    const [search, setSearch] = useState('');
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
    const [appliedSearch, setAppliedSearch] = useState('');
    const [appliedFilters, setAppliedFilters] = useState<Filters>(INITIAL_FILTERS);
    const [page, setPage] = useState(1);

    const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const filterDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const loadAgencies = useCallback(async (
        currentFilters: Filters,
        currentSearch: string,
        currentPage: number,
    ) => {
        setLoadingAgencies(true);
        setFetchError(null);
        try {
            const params: Parameters<typeof onboardingService.listAgencies>[0] = {
                page: currentPage,
            };
            if (currentSearch) params.search = currentSearch;
            if (currentFilters.region) params.region = currentFilters.region;
            if (currentFilters.hq_city) params.hq_city = currentFilters.hq_city;
            if (currentFilters.storage_based) params.storage_based = true;
            if (currentFilters.pickup_based) params.pickup_based = true;
            if (currentFilters.returns_payer) params.returns_payer = currentFilters.returns_payer;
            if (currentFilters.min_claim_deadline_days)
                params.min_claim_deadline_days = Number(currentFilters.min_claim_deadline_days);

            const res = await onboardingService.listAgencies(params);
            setAgencies(res.data ?? []);
            setMeta(res.meta ?? null);
        } catch (err) {
            setFetchError(
                err instanceof ApiError
                    ? err.message
                    : 'Failed to load delivery agencies. Please try again.',
            );
        } finally {
            setLoadingAgencies(false);
        }
    }, []);

    useEffect(() => {
        loadAgencies(appliedFilters, appliedSearch, page);
    }, [appliedFilters, appliedSearch, page, loadAgencies]);

    const handleSearchChange = (value: string) => {
        setSearch(value);
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = setTimeout(() => {
            setAppliedSearch(value);
            setPage(1);
        }, 400);
    };

    const handleFilterChange = (key: keyof Filters, value: string | boolean) => {
        const next = { ...filters, [key]: value };
        setFilters(next);

        const isTextField = ['region', 'hq_city', 'min_claim_deadline_days'].includes(key);
        if (isTextField) {
            if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
            filterDebounceRef.current = setTimeout(() => {
                setAppliedFilters(next);
                setPage(1);
            }, 400);
        } else {
            setAppliedFilters(next);
            setPage(1);
        }
    };

    const handleClearFilters = () => {
        setFilters(INITIAL_FILTERS);
        setAppliedFilters(INITIAL_FILTERS);
        setPage(1);
    };

    const activeFilterCount = countActiveFilters(appliedFilters);

    return (
        <div className="space-y-3">
            {/* Search bar + filter toggle */}
            <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        <Input
                            placeholder="Search agencies…"
                            value={search}
                            onChange={e => handleSearchChange(e.target.value)}
                            className="pl-9 h-10"
                        />
                        {search && (
                            <button
                                type="button"
                                onClick={() => handleSearchChange('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                aria-label="Clear search"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                    <CollapsibleTrigger asChild>
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-10 w-10 flex-shrink-0 relative"
                            aria-label="Toggle filters"
                        >
                            <SlidersHorizontal className="w-4 h-4" />
                            {activeFilterCount > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                                    {activeFilterCount}
                                </span>
                            )}
                        </Button>
                    </CollapsibleTrigger>
                </div>

                <CollapsibleContent>
                    <div className="mt-3">
                        <FiltersPanel
                            filters={filters}
                            onChange={handleFilterChange}
                            onClear={handleClearFilters}
                        />
                    </div>
                </CollapsibleContent>
            </Collapsible>

            {/* Result count + loading indicator */}
            <div className="flex items-center justify-between h-5">
                {!loadingAgencies && meta && (
                    <p className="text-xs text-muted-foreground">
                        {meta.total} {meta.total === 1 ? 'agency' : 'agencies'} found
                    </p>
                )}
                {loadingAgencies && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                )}
            </div>

            {/* Agency list */}
            {fetchError ? (
                <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground mb-4">{fetchError}</p>
                    <Button
                        variant="outline"
                        onClick={() => loadAgencies(appliedFilters, appliedSearch, page)}
                    >
                        Retry
                    </Button>
                </div>
            ) : loadingAgencies && agencies.length === 0 ? (
                <AgencySkeleton />
            ) : agencies.length === 0 ? (
                <div className="text-center py-10">
                    <Building2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                        {activeFilterCount > 0 || appliedSearch
                            ? 'No agencies match your search or filters.'
                            : 'No delivery agencies are available in your area yet.'}
                    </p>
                    {(activeFilterCount > 0 || appliedSearch) && (
                        <button
                            type="button"
                            onClick={() => {
                                handleSearchChange('');
                                handleClearFilters();
                            }}
                            className="mt-2 text-xs text-primary hover:underline"
                        >
                            Clear all filters
                        </button>
                    )}
                </div>
            ) : (
                <ScrollArea className={listHeightClass}>
                    <div
                        className="space-y-3 pr-3"
                        role="radiogroup"
                        aria-label="Select delivery agency"
                    >
                        {agencies.map((agency) => (
                            <AgencyCard
                                key={agency.id}
                                agency={agency}
                                selected={selectedId === agency.id}
                                onSelect={() => onSelect(agency.id)}
                                onInfo={() => setDetailAgency(agency)}
                            />
                        ))}
                    </div>
                </ScrollArea>
            )}

            {/* Pagination */}
            {meta && meta.totalPages > 1 && (
                <div className="flex items-center justify-between pt-1">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={page <= 1 || loadingAgencies}
                        onClick={() => setPage(p => p - 1)}
                    >
                        Previous
                    </Button>
                    <span className="text-xs text-muted-foreground">
                        Page {page} of {meta.totalPages}
                    </span>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={page >= meta.totalPages || loadingAgencies}
                        onClick={() => setPage(p => p + 1)}
                    >
                        Next
                    </Button>
                </div>
            )}

            {/* Agency detail sheet */}
            <AgencyDetailSheet
                agency={detailAgency}
                open={detailAgency !== null}
                onOpenChange={(open) => { if (!open) setDetailAgency(null); }}
                selected={detailAgency?.id === selectedId}
                onSelect={() => {
                    if (detailAgency) onSelect(detailAgency.id);
                }}
            />
        </div>
    );
}
