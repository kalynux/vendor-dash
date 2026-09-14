// ─── Identity verification (KYC) service ──────────────────────────────────────
// Talks to `/api/vendor/kyc` — see api-doc/vendor/identity-verification.md.
//
// ⚠ **Nothing here validates completeness, and that is deliberate.** Every field
// on every endpoint is optional and `POST /submit` accepts an empty record. The
// required/optional rules are a *review policy* that lives in the administration
// dashboard, which uses them to show the reviewer an estimated verdict and a
// pre-filled rejection reason. This client owns the "you still need X" guidance
// (see `kycChecklist` in `@/lib/kyc/checklist`) and must let the vendor submit
// anyway if they insist — they are simply rejected with a reason, and resubmit.

import { api, unwrapEnvelope } from './api';
import type {
  KycRecord,
  KycDetailsPayload,
  KycSlot,
} from '@/types/kyc.types';

const BASE = '/vendor/kyc';

/**
 * The whole record. Safe to call at any time — a vendor who has never touched
 * verification gets a fully-formed empty record, not a 404.
 */
export async function getKycRecord(): Promise<KycRecord> {
  return unwrapEnvelope<KycRecord>(await api.get(BASE));
}

/**
 * The typed half — identity number and home address. Both clearable: send `''`
 * or `null` to remove a value, omit the key to leave it alone.
 *
 * ⚠ `homeAddress` must be the candidate the geocoder returned, **unmodified**.
 * `geocoded: true` on the way back *is* the administrator's badge for "this
 * address is valid" — a hand-assembled object with made-up coordinates passes
 * that check and fails the human one.
 *
 * Returns the whole record, exactly as `getKycRecord` does.
 */
export async function updateKycDetails(payload: KycDetailsPayload): Promise<KycRecord> {
  return unwrapEnvelope<KycRecord>(await api.patch(BASE, payload));
}

/**
 * Upload one or more files into a slot. Multipart, field name **`documents`** —
 * the wrong field name is answered `400 KYC_FILE_REQUIRED`, which is the single
 * most likely mistake on this route.
 *
 * A single-value slot replaces (and the previous file is deleted immediately, so
 * the vendor's storage drops straight away); a multi-value slot appends up to
 * `limits.multiSlotMaxFiles`, checked against what is already there *before*
 * anything uploads.
 */
export async function uploadKycDocuments(slot: KycSlot, files: File[]): Promise<KycRecord> {
  const body = new FormData();
  for (const file of files) body.append('documents', file);
  return unwrapEnvelope<KycRecord>(await api.postFormData(`${BASE}/documents/${slot}`, body));
}

/** Remove one file from a slot. `404 KYC_DOCUMENT_NOT_FOUND` if it is not in that slot. */
export async function deleteKycDocument(slot: KycSlot, fileId: string): Promise<KycRecord> {
  return unwrapEnvelope<KycRecord>(await api.delete(`${BASE}/documents/${slot}/${fileId}`));
}

/**
 * Hand the record to the reviewers: stamps `submittedAt`, clears any previous
 * `rejectionReason`, and **freezes the record**. No body.
 *
 * The verdict stays `rejected` until an administrator moves it — resubmitting
 * does not re-open a decided record, and a vendor cannot approve themselves. It
 * does **not** re-open a verified record either: that answers `409 KYC_LOCKED`.
 */
export async function submitKycRecord(): Promise<KycRecord> {
  return unwrapEnvelope<KycRecord>(await api.post(`${BASE}/submit`));
}

/**
 * The bytes of one of the vendor's **own** documents. **This is the only way to
 * display them.**
 *
 * Every file in this module lives in a private storage tree, so its `FileRef`
 * comes back `{ url: null, access: 'authorized' }`. That is the correct,
 * expected answer — not a broken file. `url` is typed `string | null` precisely
 * so `<img src={doc.url}>` is a compile error rather than a blank rectangle: an
 * identity card at a public URL is fetchable forever by anyone who sees the link.
 *
 * Works while the record is locked — a vendor under review still has to be able
 * to see what they submitted.
 *
 * ⚠ The caller owns the object URL this is turned into, and must
 * `URL.revokeObjectURL` it on unmount. `useKycDocumentUrl` does that.
 */
export async function fetchKycDocumentBlob(fileId: string): Promise<Blob> {
  return api.getBlob(`${BASE}/documents/${fileId}/content`);
}
