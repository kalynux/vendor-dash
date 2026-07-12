import { useCallback, useEffect, useRef, useState } from 'react';
import { Building2, Loader2, Search, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AgencyCard, AgencyCardSkeleton } from '@/components/delivery/AgencyCard';
import { AgencyDetailSheet } from '@/components/delivery/AgencyDetailSheet';
import { AgencyFiltersPanel } from '@/components/delivery/AgencyFiltersPanel';
import { countActiveAgencyFilters, INITIAL_AGENCY_FILTERS, type AgencyFilters } from '@/components/delivery/agencyFilters';
import { useAgencyConnectionActions } from '@/hooks/useAgencyConnectionActions';
import { browseAgencyConnections, getAgencyConnection } from '@/services/agency-connections.service';
import { ApiError } from '@/types/api';
import type { AgencyBrowseItemDto, AgencyConnectionListMeta, ConnectionDto } from '@/types/agency-connection.types';

// ─── Per-card action slot ───────────────────────────────────────────────────────
// `browse` only annotates { id, status } — pending/paused_reapproval need the full
// ConnectionDto (requesterRole / reapprovalRequiredFrom) to know which action is
// ours to take. That's fetched lazily, only when the vendor interacts with the card.

function ConnectionActionSlot({
    agency,
    actions,
    onConnectionChange,
}: {
    agency: AgencyBrowseItemDto;
    actions: ReturnType<typeof useAgencyConnectionActions>;
    onConnectionChange?: (agencyId: string, dto: ConnectionDto) => void;
}) {
    const [detail, setDetail] = useState<ConnectionDto | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [rejectOpen, setRejectOpen] = useState(false);

    const connection = agency.connection;

    // Reset cached detail if the connection identity/status changed underneath us.
    useEffect(() => {
        setDetail(null);
    }, [connection?.id, connection?.status]);

    const loadDetail = useCallback(async () => {
        if (!connection) return;
        setLoadingDetail(true);
        try {
            const dto = await getAgencyConnection(connection.id);
            setDetail(dto);
        } catch {
            // best-effort — keep showing the generic status badge
        } finally {
            setLoadingDetail(false);
        }
    }, [connection]);

    const handleChange = (dto: ConnectionDto | null) => {
        if (dto) onConnectionChange?.(agency.id, dto);
    };

    if (!connection) {
        const key = `request:${agency.id}`;
        return (
            <Button
                size="sm"
                variant="outline"
                disabled={actions.pendingKey === key}
                onClick={() => actions.request(agency.id).then(handleChange)}
            >
                {actions.pendingKey === key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Request'}
            </Button>
        );
    }

    if (connection.status === 'active') {
        return (
            <Badge variant="secondary" className="text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950 dark:border-emerald-800">
                Connected
            </Badge>
        );
    }

    if (connection.status === 'rejected' || connection.status === 'withdrawn' || connection.status === 'terminated') {
        const key = `request:${agency.id}`;
        return (
            <Button
                size="sm"
                variant="outline"
                disabled={actions.pendingKey === key}
                onClick={() => actions.request(agency.id).then(handleChange)}
            >
                {actions.pendingKey === key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Request Again'}
            </Button>
        );
    }

    // pending / paused_reapproval — need the full detail to know whose turn it is
    if (!detail) {
        return (
            <Button size="sm" variant="ghost" disabled={loadingDetail} onClick={loadDetail}>
                {loadingDetail ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : connection.status === 'pending' ? (
                    'Pending…'
                ) : (
                    'Reapproval needed'
                )}
            </Button>
        );
    }

    if (connection.status === 'pending') {
        if (detail.requesterRole === 'vendor') {
            const key = `withdraw:${connection.id}`;
            return (
                <Button
                    size="sm"
                    variant="outline"
                    disabled={actions.pendingKey === key}
                    onClick={() => actions.withdraw(agency.id, connection.id).then(handleChange)}
                >
                    {actions.pendingKey === key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Withdraw'}
                </Button>
            );
        }
        const approveKey = `approve:${connection.id}`;
        const rejectKey = `reject:${connection.id}`;
        return (
            <div className="flex items-center gap-1.5">
                <Button
                    size="sm"
                    disabled={actions.pendingKey === approveKey}
                    onClick={() => actions.approve(agency.id, connection.id).then(handleChange)}
                >
                    {actions.pendingKey === approveKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Approve'}
                </Button>
                <Popover open={rejectOpen} onOpenChange={setRejectOpen}>
                    <PopoverTrigger asChild>
                        <Button size="sm" variant="outline">Reject</Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 space-y-2" align="end">
                        <p className="text-xs font-medium">Reject this request?</p>
                        <Textarea
                            placeholder="Reason (optional)"
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            className="text-xs min-h-16"
                        />
                        <Button
                            size="sm"
                            variant="destructive"
                            className="w-full"
                            disabled={actions.pendingKey === rejectKey}
                            onClick={() =>
                                actions.reject(agency.id, connection.id, rejectReason || undefined).then((dto) => {
                                    handleChange(dto);
                                    if (dto) setRejectOpen(false);
                                })
                            }
                        >
                            {actions.pendingKey === rejectKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirm Reject'}
                        </Button>
                    </PopoverContent>
                </Popover>
            </div>
        );
    }

    // paused_reapproval
    if (detail.reapprovalRequiredFrom === 'vendor') {
        const key = `approve:${connection.id}`;
        return (
            <Button
                size="sm"
                disabled={actions.pendingKey === key}
                onClick={() => actions.approve(agency.id, connection.id).then(handleChange)}
            >
                {actions.pendingKey === key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Reapprove'}
            </Button>
        );
    }
    return <Badge variant="secondary">Awaiting agency</Badge>;
}

// ─── Browser ────────────────────────────────────────────────────────────────────

export interface AgencyConnectionBrowserProps {
    /** Called after any successful connection mutation (request/approve/reject/withdraw). */
    onConnectionChange?: (agencyId: string, dto: ConnectionDto) => void;
    /** Tailwind height for the scroll list (default 42vh). */
    listHeightClass?: string;
}

/** Search + filter + paginated agency list, each card driven by its connection state. */
export function AgencyConnectionBrowser({ onConnectionChange, listHeightClass = 'h-[42vh] min-h-[160px]' }: AgencyConnectionBrowserProps) {
    const [agencies, setAgencies] = useState<AgencyBrowseItemDto[]>([]);
    const [meta, setMeta] = useState<AgencyConnectionListMeta | null>(null);
    const [loadingAgencies, setLoadingAgencies] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);

    const [detailAgency, setDetailAgency] = useState<AgencyBrowseItemDto | null>(null);

    const [search, setSearch] = useState('');
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [filters, setFilters] = useState<AgencyFilters>(INITIAL_AGENCY_FILTERS);
    const [appliedSearch, setAppliedSearch] = useState('');
    const [appliedFilters, setAppliedFilters] = useState<AgencyFilters>(INITIAL_AGENCY_FILTERS);
    const [page, setPage] = useState(1);

    const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const filterDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const actions = useAgencyConnectionActions({
        onChanged: (agencyId, dto) => {
            setAgencies((prev) =>
                prev.map((a) => (a.id === agencyId ? { ...a, connection: { id: dto.id, status: dto.status } } : a)),
            );
            onConnectionChange?.(agencyId, dto);
        },
    });

    const loadAgencies = useCallback(async (
        currentFilters: AgencyFilters,
        currentSearch: string,
        currentPage: number,
    ) => {
        setLoadingAgencies(true);
        setFetchError(null);
        try {
            const params: Parameters<typeof browseAgencyConnections>[0] = { page: currentPage };
            if (currentSearch) params.search = currentSearch;
            if (currentFilters.region) params.region = currentFilters.region;
            if (currentFilters.hq_city) params.hq_city = currentFilters.hq_city;
            if (currentFilters.storage_based) params.storage_based = true;
            if (currentFilters.pickup_based) params.pickup_based = true;
            if (currentFilters.returns_payer) params.returns_payer = currentFilters.returns_payer;
            if (currentFilters.min_claim_deadline_days)
                params.min_claim_deadline_days = Number(currentFilters.min_claim_deadline_days);

            const res = await browseAgencyConnections(params);
            setAgencies(res.data ?? []);
            setMeta(res.meta ?? null);
        } catch (err) {
            setFetchError(
                err instanceof ApiError ? err.message : 'Failed to load delivery agencies. Please try again.',
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

    const handleFilterChange = (key: keyof AgencyFilters, value: string | boolean) => {
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
        setFilters(INITIAL_AGENCY_FILTERS);
        setAppliedFilters(INITIAL_AGENCY_FILTERS);
        setPage(1);
    };

    const activeFilterCount = countActiveAgencyFilters(appliedFilters);

    return (
        <div className="space-y-3">
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
                        <AgencyFiltersPanel filters={filters} onChange={handleFilterChange} onClear={handleClearFilters} />
                    </div>
                </CollapsibleContent>
            </Collapsible>

            <div className="flex items-center justify-between h-5">
                {!loadingAgencies && meta && (
                    <p className="text-xs text-muted-foreground">
                        {meta.total} {meta.total === 1 ? 'agency' : 'agencies'} found
                    </p>
                )}
                {loadingAgencies && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
            </div>

            {fetchError ? (
                <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground mb-4">{fetchError}</p>
                    <Button variant="outline" onClick={() => loadAgencies(appliedFilters, appliedSearch, page)}>
                        Retry
                    </Button>
                </div>
            ) : loadingAgencies && agencies.length === 0 ? (
                <div className="space-y-3 p-1">
                    {[1, 2, 3].map((i) => <AgencyCardSkeleton key={i} />)}
                </div>
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
                            onClick={() => { handleSearchChange(''); handleClearFilters(); }}
                            className="mt-2 text-xs text-primary hover:underline"
                        >
                            Clear all filters
                        </button>
                    )}
                </div>
            ) : (
                <ScrollArea className={listHeightClass}>
                    <div className="space-y-3 pr-3">
                        {agencies.map((agency) => (
                            <AgencyCard
                                key={agency.id}
                                agency={agency}
                                onInfo={() => setDetailAgency(agency)}
                                rightSlot={
                                    <ConnectionActionSlot agency={agency} actions={actions} onConnectionChange={onConnectionChange} />
                                }
                            />
                        ))}
                    </div>
                </ScrollArea>
            )}

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

            <AgencyDetailSheet
                agency={detailAgency}
                open={detailAgency !== null}
                onOpenChange={(open) => { if (!open) setDetailAgency(null); }}
                footerSlot={
                    detailAgency && (
                        <ConnectionActionSlot agency={detailAgency} actions={actions} onConnectionChange={onConnectionChange} />
                    )
                }
            />
        </div>
    );
}
