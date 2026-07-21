import { api } from './api';
import type {
  VendorStore,
  StoreUpdatePayload,
  StoreStatusPayload,
  StoreResponse,
} from '@/types/store.types';

/** Fetch the authenticated vendor's storefront profile (GET /api/vendor/store). */
export async function fetchStore(): Promise<VendorStore> {
  const res = await api.get<StoreResponse>('/vendor/store');
  return res.data;
}

/**
 * Update the storefront profile (PATCH /api/vendor/store). Send only changed
 * fields plus the current `version` (optimistic locking). `slug`/`country` are
 * immutable and rejected by the backend; a stale `version` returns 409 CONFLICT.
 */
export async function updateStore(payload: StoreUpdatePayload): Promise<VendorStore> {
  const res = await api.patch<StoreResponse>('/vendor/store', payload);
  return res.data;
}

/**
 * Toggle vacation mode (PATCH /api/vendor/store/status). `isOpen: false` puts the
 * store on vacation. Requires the current `version` (optimistic locking).
 */
export async function updateStoreStatus(payload: StoreStatusPayload): Promise<VendorStore> {
  const res = await api.patch<StoreResponse>('/vendor/store/status', payload);
  return res.data;
}
