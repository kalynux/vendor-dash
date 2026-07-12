import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import {
    approveAgencyConnection,
    getAgencyConnectionErrorMessage,
    rejectAgencyConnection,
    requestAgencyConnection,
    terminateAgencyConnection,
    withdrawAgencyConnection,
} from '@/services/agency-connections.service';
import type { ConnectionDto } from '@/types/agency-connection.types';

export interface UseAgencyConnectionActionsOptions {
    /** Called after any successful mutation, so the caller can refetch/react (e.g. auto-default refresh). */
    onChanged?: (agencyId: string, dto: ConnectionDto) => void;
}

/**
 * Shared request/approve/reject/withdraw/terminate mutation logic — toast +
 * error mapping + a per-action loading key — used by both the discovery
 * browser and the Settings connections list so the flow isn't duplicated.
 */
export function useAgencyConnectionActions({ onChanged }: UseAgencyConnectionActionsOptions = {}) {
    const [pendingKey, setPendingKey] = useState<string | null>(null);

    const run = useCallback(
        async (
            key: string,
            agencyId: string,
            action: () => Promise<ConnectionDto>,
            successMessage: string,
        ): Promise<ConnectionDto | null> => {
            setPendingKey(key);
            try {
                const dto = await action();
                toast.success(successMessage);
                onChanged?.(agencyId, dto);
                return dto;
            } catch (err) {
                toast.error(getAgencyConnectionErrorMessage(err));
                return null;
            } finally {
                setPendingKey(null);
            }
        },
        [onChanged],
    );

    const request = useCallback(
        (agencyId: string) =>
            run(`request:${agencyId}`, agencyId, () => requestAgencyConnection(agencyId), 'Connection request sent.'),
        [run],
    );

    const approve = useCallback(
        (agencyId: string, connectionId: string) =>
            run(`approve:${connectionId}`, agencyId, () => approveAgencyConnection(connectionId), 'Connection approved.'),
        [run],
    );

    const reject = useCallback(
        (agencyId: string, connectionId: string, reason?: string) =>
            run(`reject:${connectionId}`, agencyId, () => rejectAgencyConnection(connectionId, reason), 'Request rejected.'),
        [run],
    );

    const withdraw = useCallback(
        (agencyId: string, connectionId: string) =>
            run(`withdraw:${connectionId}`, agencyId, () => withdrawAgencyConnection(connectionId), 'Request withdrawn.'),
        [run],
    );

    const terminate = useCallback(
        (agencyId: string, connectionId: string, note?: string) =>
            run(`terminate:${connectionId}`, agencyId, () => terminateAgencyConnection(connectionId, note), 'Connection terminated.'),
        [run],
    );

    return { pendingKey, request, approve, reject, withdraw, terminate };
}
