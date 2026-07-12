import { useCallback, useEffect, useState } from 'react';
import { Building2, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useAgencyConnectionActions } from '@/hooks/useAgencyConnectionActions';
import { listAgencyConnections, resolveAgencyDisplayForConnections } from '@/services/agency-connections.service';
import { ApiError } from '@/types/api';
import type { AgencyBrowseItemDto, ConnectionDto, ConnectionStatus } from '@/types/agency-connection.types';

type StatusChip = 'all' | 'pending' | 'active' | 'paused_reapproval' | 'history';

const HISTORY_STATUSES: ConnectionStatus[] = ['rejected', 'withdrawn', 'terminated'];

const CHIPS: { key: StatusChip; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'active', label: 'Active' },
    { key: 'paused_reapproval', label: 'Paused' },
    { key: 'history', label: 'History' },
];

function matchesChip(status: ConnectionStatus, chip: StatusChip): boolean {
    if (chip === 'all') return true;
    if (chip === 'history') return HISTORY_STATUSES.includes(status);
    return status === chip;
}

const STATUS_BADGE_CLASS: Record<ConnectionStatus, string> = {
    pending: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-800',
    active: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950 dark:border-emerald-800',
    paused_reapproval: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-800',
    rejected: 'text-destructive bg-destructive/10 border-destructive/20',
    withdrawn: 'text-muted-foreground bg-muted border-border',
    terminated: 'text-muted-foreground bg-muted border-border',
};

const STATUS_LABEL: Record<ConnectionStatus, string> = {
    pending: 'Pending',
    active: 'Active',
    paused_reapproval: 'Reapproval needed',
    rejected: 'Rejected',
    withdrawn: 'Withdrawn',
    terminated: 'Terminated',
};

function ReasonPopover({
    triggerLabel,
    confirmLabel,
    placeholder,
    variant,
    disabled,
    onConfirm,
}: {
    triggerLabel: string;
    confirmLabel: string;
    placeholder: string;
    variant?: 'outline' | 'destructive';
    disabled: boolean;
    onConfirm: (reason: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState('');

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button size="sm" variant={variant ?? 'outline'}>{triggerLabel}</Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 space-y-2" align="end">
                <Textarea
                    placeholder={placeholder}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="text-xs min-h-16"
                />
                <Button
                    size="sm"
                    variant={variant ?? 'default'}
                    className="w-full"
                    disabled={disabled}
                    onClick={() => { onConfirm(reason); setOpen(false); setReason(''); }}
                >
                    {disabled ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : confirmLabel}
                </Button>
            </PopoverContent>
        </Popover>
    );
}

function ConnectionRowActions({
    connection,
    actions,
    isDefault,
    settingDefault,
    onSetDefault,
}: {
    connection: ConnectionDto;
    actions: ReturnType<typeof useAgencyConnectionActions>;
    isDefault: boolean;
    settingDefault: boolean;
    onSetDefault: (agencyId: string) => void;
}) {
    const agencyId = connection.agencyId;

    if (connection.status === 'active') {
        const terminateKey = `terminate:${connection.id}`;
        return (
            <div className="flex items-center gap-1.5">
                {isDefault ? (
                    <Badge variant="secondary" className="text-primary bg-primary/10 border-primary/20">
                        Default
                    </Badge>
                ) : (
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={settingDefault}
                        onClick={() => onSetDefault(agencyId)}
                    >
                        {settingDefault ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Set as default'}
                    </Button>
                )}
                <ReasonPopover
                    triggerLabel="Terminate"
                    confirmLabel="Confirm Terminate"
                    placeholder="Note (optional)"
                    variant="destructive"
                    disabled={actions.pendingKey === terminateKey}
                    onConfirm={(note) => actions.terminate(agencyId, connection.id, note || undefined)}
                />
            </div>
        );
    }

    if (connection.status === 'pending') {
        if (connection.requesterRole === 'vendor') {
            const key = `withdraw:${connection.id}`;
            return (
                <Button
                    size="sm"
                    variant="outline"
                    disabled={actions.pendingKey === key}
                    onClick={() => actions.withdraw(agencyId, connection.id)}
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
                    onClick={() => actions.approve(agencyId, connection.id)}
                >
                    {actions.pendingKey === approveKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Approve'}
                </Button>
                <ReasonPopover
                    triggerLabel="Reject"
                    confirmLabel="Confirm Reject"
                    placeholder="Reason (optional)"
                    variant="destructive"
                    disabled={actions.pendingKey === rejectKey}
                    onConfirm={(reason) => actions.reject(agencyId, connection.id, reason || undefined)}
                />
            </div>
        );
    }

    if (connection.status === 'paused_reapproval') {
        if (connection.reapprovalRequiredFrom === 'vendor') {
            const key = `approve:${connection.id}`;
            return (
                <Button
                    size="sm"
                    disabled={actions.pendingKey === key}
                    onClick={() => actions.approve(agencyId, connection.id)}
                >
                    {actions.pendingKey === key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Reapprove'}
                </Button>
            );
        }
        return <Badge variant="secondary">Awaiting agency</Badge>;
    }

    // rejected / withdrawn / terminated
    const key = `request:${agencyId}`;
    return (
        <Button
            size="sm"
            variant="outline"
            disabled={actions.pendingKey === key}
            onClick={() => actions.request(agencyId)}
        >
            {actions.pendingKey === key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Request Again'}
        </Button>
    );
}

export interface ConnectionsListProps {
    /** Called after any successful mutation, so the parent can refetch the "current default" summary. */
    onConnectionChange?: () => void;
    /** The vendor's current `default_delivery_agency_id`, or null if unset. */
    defaultAgencyId: string | null;
    /** Set a different active connection's agency as the default. */
    onSetDefault: (agencyId: string) => void | Promise<void>;
    /** Agency id currently being set as default (disables its button while in flight). */
    settingDefaultAgencyId?: string | null;
}

/** Settings → Delivery → Connections tab body: status-filtered history of all the vendor's connections. */
export function ConnectionsList({
    onConnectionChange,
    defaultAgencyId,
    onSetDefault,
    settingDefaultAgencyId = null,
}: ConnectionsListProps) {
    const [connections, setConnections] = useState<ConnectionDto[]>([]);
    const [agencyDisplay, setAgencyDisplay] = useState<Map<string, AgencyBrowseItemDto>>(new Map());
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [chip, setChip] = useState<StatusChip>('all');

    const actions = useAgencyConnectionActions({
        onChanged: (_agencyId, dto) => {
            setConnections((prev) => {
                const idx = prev.findIndex((c) => c.id === dto.id);
                if (idx === -1) return [dto, ...prev];
                const next = [...prev];
                next[idx] = dto;
                return next;
            });
            onConnectionChange?.();
        },
    });

    const load = useCallback(async () => {
        setIsLoading(true);
        setLoadError(null);
        try {
            const all: ConnectionDto[] = [];
            let page = 1;
            let totalPages = 1;
            const maxPages = 10; // 10 * 100 = 1000 connections, a generous ceiling
            while (page <= totalPages && page <= maxPages) {
                const { data, meta } = await listAgencyConnections({ page, limit: 100 });
                all.push(...data);
                totalPages = meta.totalPages;
                page += 1;
            }
            setConnections(all);
            const { resolved } = await resolveAgencyDisplayForConnections(all);
            setAgencyDisplay(resolved);
        } catch (err) {
            setLoadError(err instanceof ApiError ? err.message : 'Could not load your connections.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const filtered = connections.filter((c) => matchesChip(c.status, chip));

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
                {CHIPS.map((c) => (
                    <button
                        key={c.key}
                        type="button"
                        onClick={() => setChip(c.key)}
                        className={cn(
                            'text-xs px-3 py-1.5 rounded-full border transition-colors',
                            chip === c.key
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-card border-border text-muted-foreground hover:text-foreground',
                        )}
                    >
                        {c.label}
                    </button>
                ))}
            </div>

            {isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading connections…
                </div>
            ) : loadError ? (
                <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground mb-4">{loadError}</p>
                    <Button variant="outline" onClick={load}>Retry</Button>
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-10 border border-dashed rounded-xl">
                    <Building2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No connections in this category yet.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map((connection) => {
                        const agency = agencyDisplay.get(connection.agencyId);
                        return (
                            <div
                                key={connection.id}
                                className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                                        {agency?.logoUrl ? (
                                            <img src={agency.logoUrl} alt={agency.agencyName} className="w-full h-full object-cover" />
                                        ) : (
                                            <Building2 className="w-4 h-4 text-muted-foreground" />
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium truncate">
                                            {agency?.agencyName ?? `Agency ${connection.agencyId.slice(-6)}`}
                                        </p>
                                        <Badge variant="secondary" className={cn('text-[10px] mt-0.5', STATUS_BADGE_CLASS[connection.status])}>
                                            {STATUS_LABEL[connection.status]}
                                        </Badge>
                                    </div>
                                </div>
                                <div className="flex-shrink-0">
                                    <ConnectionRowActions
                                        connection={connection}
                                        actions={actions}
                                        isDefault={connection.agencyId === defaultAgencyId}
                                        settingDefault={settingDefaultAgencyId === connection.agencyId}
                                        onSetDefault={onSetDefault}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
