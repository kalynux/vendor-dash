import { useCallback, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n';
import { DEFAULT_AGENCY_SETTING_PATH } from '@/lib/agencyBlocker';
import { fetchDefaultDeliveryAgency } from '@/services/agencies.service';
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
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
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

    // Since 2026-10-18 the first approval becomes the default only when the agency
    // is `active`. Approving one that isn't leaves the vendor with no default —
    // every physical product then stays a draft — so say so and point at the
    // setting. Only asked when the agency isn't active: the usual first approval
    // still fills the default by itself.
    const promptForDefaultIfMissing = useCallback(
        async (dto: ConnectionDto) => {
            if (dto.status !== 'active') return;
            if (!dto.counterpartyStatus || dto.counterpartyStatus === 'active') return;
            try {
                if (await fetchDefaultDeliveryAgency()) return;
            } catch {
                return; // best-effort — the publish checklist says it too
            }
            const onConnectionsTab = location.pathname === DEFAULT_AGENCY_SETTING_PATH;
            toast.info(t('agency.counterparty.noDefaultAfterApprove'), {
                duration: 10000,
                // Already on the tab that holds "Set as default": the sentence is enough.
                ...(onConnectionsTab
                    ? {}
                    : {
                          action: {
                              label: t('agency.counterparty.chooseDefault'),
                              onClick: () => navigate(DEFAULT_AGENCY_SETTING_PATH),
                          },
                      }),
            });
        },
        [location.pathname, navigate, t],
    );

    const approve = useCallback(
        async (agencyId: string, connectionId: string) => {
            const dto = await run(
                `approve:${connectionId}`,
                agencyId,
                () => approveAgencyConnection(connectionId),
                'Connection approved.',
            );
            if (dto) void promptForDefaultIfMissing(dto);
            return dto;
        },
        [run, promptForDefaultIfMissing],
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
