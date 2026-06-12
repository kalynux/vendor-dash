import { api } from './api';
import type {
  ApiTicketListItem,
  ApiTicketDetail,
  ApiTicketMutation,
  ApiTicketNote,
  ApiTicketAttachment,
  TicketListMeta,
  TicketListResponse,
  TicketDetailResponse,
  TicketMutationResponse,
  CreateTicketResponse,
  NotesListResponse,
  NoteMutationResponse,
  AttachmentsListResponse,
  AttachmentMutationResponse,
  CreateTicketPayload,
  UpdateTicketPayload,
  CreateNotePayload,
  CreateAttachmentPayload,
  TicketsQueryParams,
  TicketStatus,
  UpdatablePriority,
} from '@/types/tickets.types';

const BASE = '/vendor/tickets';

// Reuses the products.service query-string convention: drop empty values.
function buildQueryString(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== '',
  );
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
}

// Docs document `_id`, but the live API may return `id`. Normalize so the rest
// of the app can rely on `_id` being present.
function normalizeId<T extends { _id?: string; id?: string }>(item: T): T {
  return { ...item, _id: item._id ?? item.id ?? '' };
}

// ─── Tickets CRUD ─────────────────────────────────────────────────────────────

export async function fetchTickets(
  params: TicketsQueryParams = {},
): Promise<{ data: ApiTicketListItem[]; meta: TicketListMeta }> {
  const qs = buildQueryString(params as Record<string, unknown>);
  const res = await api.get<TicketListResponse>(`${BASE}${qs}`);
  return { data: res.data.map(normalizeId), meta: res.pagination };
}

export async function fetchTicketById(id: string): Promise<ApiTicketDetail> {
  const res = await api.get<TicketDetailResponse>(`${BASE}/${id}`);
  return normalizeId(res.data);
}

export async function createTicket(payload: CreateTicketPayload): Promise<ApiTicketDetail> {
  const res = await api.post<CreateTicketResponse>(BASE, payload);
  return normalizeId(res.data);
}

export async function updateTicket(
  id: string,
  payload: UpdateTicketPayload,
): Promise<ApiTicketMutation> {
  const res = await api.patch<TicketMutationResponse>(`${BASE}/${id}`, payload);
  return res.data;
}

export async function updateTicketStatus(
  id: string,
  status: TicketStatus,
): Promise<ApiTicketMutation> {
  const res = await api.patch<TicketMutationResponse>(`${BASE}/${id}/status`, { status });
  return res.data;
}

export async function updateTicketPriority(
  id: string,
  priority: UpdatablePriority,
): Promise<ApiTicketMutation> {
  const res = await api.patch<TicketMutationResponse>(`${BASE}/${id}/priority`, { priority });
  return res.data;
}

export async function closeTicket(id: string): Promise<ApiTicketMutation> {
  const res = await api.post<TicketMutationResponse>(`${BASE}/${id}/close`);
  return res.data;
}

// ─── Notes ────────────────────────────────────────────────────────────────────

export async function fetchNotes(ticketId: string): Promise<ApiTicketNote[]> {
  const res = await api.get<NotesListResponse>(`${BASE}/${ticketId}/notes`);
  return res.data;
}

export async function createNote(
  ticketId: string,
  payload: CreateNotePayload,
): Promise<ApiTicketNote> {
  const res = await api.post<NoteMutationResponse>(`${BASE}/${ticketId}/notes`, payload);
  return res.data;
}

// ─── Attachments ──────────────────────────────────────────────────────────────

export async function fetchAttachments(ticketId: string): Promise<ApiTicketAttachment[]> {
  const res = await api.get<AttachmentsListResponse>(`${BASE}/${ticketId}/attachments`);
  return res.data;
}

/**
 * Links an already-uploaded file (by id, e.g. from the MediaPicker) to a ticket.
 * The file itself is uploaded separately via the global file-upload endpoint;
 * this route only references it — mirroring how product images are attached.
 */
export async function attachFile(
  ticketId: string,
  payload: CreateAttachmentPayload,
): Promise<ApiTicketAttachment> {
  const res = await api.post<AttachmentMutationResponse>(
    `${BASE}/${ticketId}/attachments`,
    payload,
  );
  return res.data;
}
