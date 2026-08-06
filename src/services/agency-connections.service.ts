import { api } from './api';
import { apiErrorMessage } from '@/i18n';
import type {
  AgencyBrowseItemDto,
  AgencyBrowseQueryParams,
  AgencyConnectionListMeta,
  AgencyConnectionResponse,
  ConnectionDto,
  GetAgencyBrowseResponse,
  ListAgencyConnectionsResponse,
  ListConnectionsParams,
} from '@/types/agency-connection.types';

// ─── Error Handling ────────────────────────────────────────────────────────────

/**
 * Friendly, user-facing labels for known agency-connection error codes.
 * Falls back to the backend `err.message` for any unmapped code. Mirrors the
 * ORDER_ERROR_LABELS pattern in orders.service.ts.
 */
export const AGENCY_CONNECTION_ERROR_LABELS: Record<string, string> = {
  CONNECTION_NOT_ACTIVE:
    'You need an active, approved connection with this agency before you can assign it. Send or check your connection request first.',
  CONNECTION_ALREADY_EXISTS: 'You already have a connection request with this agency.',
  CONNECTION_NOT_APPROVER: "You can't approve or reject a request you sent yourself.",
  CONNECTION_NOT_REQUESTER: "You can't withdraw a request you didn't send.",
  CONNECTION_NOT_PENDING: 'This request is no longer pending.',
  CONNECTION_INVALID_STATUS_TRANSITION: "This connection can't be changed from its current status.",
  CONNECTION_WRONG_REAPPROVAL_PARTY: "It's the agency's turn to reapprove this connection, not yours.",
  CONNECTION_VENDOR_NOT_FOUND: 'Your vendor profile could not be resolved. Please refresh and try again.',
  DELIVERY_AGENCY_NOT_FOUND: 'This delivery agency could no longer be found.',
};

/** Resolve a localized, user-safe message for a connection API failure. */
export function getAgencyConnectionErrorMessage(err: unknown): string {
  return apiErrorMessage(err, {
    context: 'agencyConnection',
    fallbackKey: 'agency.errors.updateFailed',
  });
}

// ─── Query helpers ──────────────────────────────────────────────────────────────

function buildQueryString(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== '',
  );
  if (entries.length === 0) return '';
  return (
    '?' +
    entries
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&')
  );
}

// ─── Endpoints ────────────────────────────────────────────────────────────────

/** Search delivery agencies to request a connection with; each result carries your current connection state (if any). */
export async function browseAgencyConnections(
  params: AgencyBrowseQueryParams = {},
): Promise<{ data: AgencyBrowseItemDto[]; meta: AgencyConnectionListMeta }> {
  const qs = buildQueryString(params as Record<string, unknown>);
  const res = await api.get<GetAgencyBrowseResponse>(`/vendor/agency-connections/browse${qs}`);
  return { data: res.data, meta: res.meta };
}

/** Send a connection request to an agency (or re-request after rejected/withdrawn/terminated). */
export async function requestAgencyConnection(counterpartyId: string): Promise<ConnectionDto> {
  const res = await api.post<AgencyConnectionResponse>('/vendor/agency-connections', {
    counterpartyId,
  });
  return res.data;
}

/** List your own connections, any status, newest-updated first. */
export async function listAgencyConnections(
  params: ListConnectionsParams = {},
): Promise<{ data: ConnectionDto[]; meta: AgencyConnectionListMeta }> {
  const qs = buildQueryString(params as Record<string, unknown>);
  const res = await api.get<ListAgencyConnectionsResponse>(`/vendor/agency-connections${qs}`);
  return { data: res.data, meta: res.meta };
}

/** Full detail for one of your own connections. */
export async function getAgencyConnection(id: string): Promise<ConnectionDto> {
  const res = await api.get<AgencyConnectionResponse>(`/vendor/agency-connections/${id}`);
  return res.data;
}

/** Approve a pending request the agency sent you, or reapprove from paused_reapproval. */
export async function approveAgencyConnection(id: string): Promise<ConnectionDto> {
  const res = await api.post<AgencyConnectionResponse>(`/vendor/agency-connections/${id}/approve`);
  return res.data;
}

/** Reject a pending request the agency sent you. */
export async function rejectAgencyConnection(id: string, reason?: string): Promise<ConnectionDto> {
  const res = await api.post<AgencyConnectionResponse>(
    `/vendor/agency-connections/${id}/reject`,
    reason ? { reason } : undefined,
  );
  return res.data;
}

/** Withdraw a pending request you sent. */
export async function withdrawAgencyConnection(id: string): Promise<ConnectionDto> {
  const res = await api.post<AgencyConnectionResponse>(`/vendor/agency-connections/${id}/withdraw`);
  return res.data;
}

/** End an active or paused_reapproval connection outright. */
export async function terminateAgencyConnection(id: string, note?: string): Promise<ConnectionDto> {
  const res = await api.post<AgencyConnectionResponse>(
    `/vendor/agency-connections/${id}/terminate`,
    note ? { note } : undefined,
  );
  return res.data;
}

// ─── Cross-reference helpers ────────────────────────────────────────────────────
// `ConnectionDto` only carries `agencyId` — never a display name/logo — and there is
// no "fetch agencies by id" endpoint. To show a connected agency's details, we cross
// reference the authoritative connection list against the paginated browse listing.

const DEFAULT_MAX_BROWSE_PAGES = 6; // ~300 agencies scanned at the browse endpoint's max page size (50)
const BROWSE_PAGE_LIMIT = 50;
const CONNECTIONS_PAGE_LIMIT = 100;

/**
 * Resolve display details (name, logo, policies, …) for an arbitrary set of
 * connections by scanning the browse listing for matching agency ids.
 *
 * Known limitation: if the platform has enough agencies that a target agency
 * falls outside the bounded scan (`maxBrowsePages`), it is reported in
 * `unresolvedAgencyIds` and callers should fall back to an id-only display —
 * there is no backend "fetch agencies by ids" endpoint to close this gap.
 */
export async function resolveAgencyDisplayForConnections(
  connections: ConnectionDto[],
  opts: { maxBrowsePages?: number } = {},
): Promise<{ resolved: Map<string, AgencyBrowseItemDto>; unresolvedAgencyIds: string[] }> {
  const targetIds = new Set(connections.map((c) => c.agencyId));
  const resolved = new Map<string, AgencyBrowseItemDto>();

  if (targetIds.size === 0) {
    return { resolved, unresolvedAgencyIds: [] };
  }

  const maxBrowsePages = opts.maxBrowsePages ?? DEFAULT_MAX_BROWSE_PAGES;
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && page <= maxBrowsePages && resolved.size < targetIds.size) {
    const { data, meta } = await browseAgencyConnections({ page, limit: BROWSE_PAGE_LIMIT });
    totalPages = meta.totalPages;
    for (const agency of data) {
      if (targetIds.has(agency.id) && !resolved.has(agency.id)) {
        resolved.set(agency.id, agency);
      }
    }
    page += 1;
  }

  const unresolvedAgencyIds = [...targetIds].filter((id) => !resolved.has(id));
  return { resolved, unresolvedAgencyIds };
}

/**
 * The vendor's agencies with an `active` connection, resolved to full display
 * details. This is the source list for "pick an agency to assign" pickers
 * (product delivery override, default-agency switcher).
 */
export async function getActiveConnectedAgencies(
  opts: { maxBrowsePages?: number } = {},
): Promise<{
  agencies: (AgencyBrowseItemDto & { connectionId: string })[];
  unresolvedAgencyIds: string[];
}> {
  const activeConnections: ConnectionDto[] = [];
  let page = 1;
  let totalPages = 1;
  const maxConnectionPages = 5; // vendors realistically have far fewer than 500 active connections

  while (page <= totalPages && page <= maxConnectionPages) {
    const { data, meta } = await listAgencyConnections({
      status: 'active',
      page,
      limit: CONNECTIONS_PAGE_LIMIT,
    });
    activeConnections.push(...data);
    totalPages = meta.totalPages;
    page += 1;
  }

  if (activeConnections.length === 0) {
    return { agencies: [], unresolvedAgencyIds: [] };
  }

  const { resolved, unresolvedAgencyIds } = await resolveAgencyDisplayForConnections(
    activeConnections,
    opts,
  );

  const connectionIdByAgencyId = new Map(activeConnections.map((c) => [c.agencyId, c.id]));
  const agencies = [...resolved.values()].map((agency) => ({
    ...agency,
    connectionId: connectionIdByAgencyId.get(agency.id) as string,
  }));

  return { agencies, unresolvedAgencyIds };
}
