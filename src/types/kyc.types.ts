// ─── Identity verification (KYC) ──────────────────────────────────────────────
// The documents an administrator looks at when deciding whether to verify the
// shop. See api-doc/vendor/identity-verification.md.
//
// Base path `/api/vendor/kyc`. There is **no vendor id in any path** — every
// route is scoped to the calling vendor's own record, by design: the payload is
// a photograph of a person holding their identity card.

import type { FileRef } from './file.types';
import type { GeoAddressCandidate } from './geo.types';

/**
 * The verdict.
 *
 * ⚠ **`pending` does not mean "waiting for review".** It is the schema default,
 * so it also means *"never touched"*. `submittedAt` is what tells the two apart —
 * always derive a status pill from both, never from `status` alone. See
 * {@link kycPhase}.
 */
export type KycStatus = 'pending' | 'verified' | 'rejected';

/** The five slots a vendor may fill. `vehicle_with_agent` is the agent's, not ours. */
export type KycSlot =
  | 'id_card_front'
  | 'id_card_back'
  | 'selfie_with_id'
  | 'home_address_sketch'
  | 'store_address_sketch';

/** The three slots that hold exactly one file — re-uploading replaces. */
export type KycSingleSlot = 'id_card_front' | 'id_card_back' | 'selfie_with_id';

/** The two slots that append, up to `limits.multiSlotMaxFiles`. */
export type KycMultiSlot = 'home_address_sketch' | 'store_address_sketch';

/**
 * An address as the reviewer sees it — the READ shape.
 *
 * ⚠ This is **not** the shape `PATCH` accepts. The read is a flattened,
 * camelCase projection with a bare coordinate pair; the write wants the whole
 * `GET /api/geo/search` candidate back (`formatted_address`, a GeoJSON
 * `coordinates` object, `provider_place_id`, `components`). Use
 * {@link kycAddressToCandidate} to feed this back into `AddressSearch`.
 */
export interface KycAddress {
  /** `null` on a legacy or hand-typed entry — which is the case worth badging. */
  label: string | null;
  /** The provider's one-line address, or the plain text if never geocoded. */
  formattedAddress: string | null;
  /**
   * `[lng, lat]` — **GeoJSON order, not `[lat, lng]`**.
   *
   * Both halves of a swapped pair stay plausible numbers, which is why this is
   * worth a comment: plotting `[lat, lng]` puts every Douala address in the
   * Gulf of Guinea and nothing throws.
   */
  coordinates: [number, number] | null;
  /** Which geocoder resolved it. Informational; nothing branches on it. */
  provider: string | null;
  /** **The badge input.** `true` iff a geocoder resolved this to a coordinate. */
  geocoded: boolean;
}

/**
 * Every document slot, keyed by its DTO name rather than its wire slot name.
 *
 * The two differ (`id_card_front` on the wire, `idCardFront` here) — that is the
 * backend's own `KYC_SLOT_DTO_KEYS` mapping, mirrored by {@link KYC_SLOT_KEYS}.
 */
export interface KycDocuments {
  idCardFront: FileRef | null;
  idCardBack: FileRef | null;
  selfieWithId: FileRef | null;
  /** Agent only — **always `null` for a vendor**. Present so the shape matches the wire. */
  vehicleWithAgent: FileRef | null;
  /** Empty array, never null. */
  homeAddressSketches: FileRef[];
  storeAddressSketches: FileRef[];
}

/** The whole record, as `GET /api/vendor/kyc` returns it. */
export interface KycRecord {
  role: 'vendor';
  status: KycStatus;
  /** `null` until the vendor presses submit. Non-null ⇒ under review ⇒ frozen. */
  submittedAt: string | null;
  /**
   * Whether the record accepts writes right now — the **only** field you need to
   * decide whether to disable the form. Derived server-side from status +
   * `submittedAt`; `rejected` is deliberately *not* locked.
   */
  locked: boolean;
  /** Present on a rejection, so the vendor can act on it. */
  rejectionReason: string | null;
  verifiedAt: string | null;
  idNumber: string | null;
  homeAddress: KycAddress | null;
  documents: KycDocuments;
  /** Echoed so the client need not hardcode it beside the server. */
  limits: { multiSlotMaxFiles: number };
}

/** `PATCH /api/vendor/kyc` — the typed half. Both fields optional and clearable. */
export interface KycDetailsPayload {
  /** 1–64 chars, or `null`/`''` to clear. No format check — a person reads it. */
  idNumber?: string | null;
  /** A selected `GET /api/geo/search` candidate, unmodified, or `null` to clear. */
  homeAddress?: GeoAddressCandidate | null;
}

// ─── Slot vocabulary ──────────────────────────────────────────────────────────

/** Wire slot name → the key it lands on in {@link KycDocuments}. */
export const KYC_SLOT_KEYS = {
  id_card_front: 'idCardFront',
  id_card_back: 'idCardBack',
  selfie_with_id: 'selfieWithId',
  home_address_sketch: 'homeAddressSketches',
  store_address_sketch: 'storeAddressSketches',
} as const satisfies Record<KycSlot, keyof KycDocuments>;

export const KYC_SINGLE_SLOTS = ['id_card_front', 'id_card_back', 'selfie_with_id'] as const;
export const KYC_MULTI_SLOTS = ['home_address_sketch', 'store_address_sketch'] as const;

/**
 * What the upload route accepts, mirrored from the backend's
 * `getKycDocumentUploadConfig()`. Used for the client-side gate that keeps an
 * obviously-doomed 10 MB upload off a mobile connection — the server enforces
 * these regardless, and its answer is the authority.
 *
 * **PDF is accepted everywhere here**: a scan arrives from a phone as a JPEG and
 * from a scanner app as a PDF, and making the vendor convert is the step at
 * which a legible document becomes an illegible one.
 */
export const KYC_ACCEPTED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

/** The `accept` attribute for a file input, from the list above. */
export const KYC_ACCEPT_ATTR = KYC_ACCEPTED_MIME_TYPES.join(',');

/** The same list as filename extensions, for when the MIME type says nothing. */
const KYC_ACCEPTED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'pdf'] as const;

/**
 * MIME values that carry no information. Treat these as *unknown*, never as
 * *wrong*.
 *
 * ⚠ Both arise on the native shell, and neither means the file is unacceptable:
 * a camera capture whose OS metadata had no `format` falls through to
 * `blob.type`, and Capacitor's local file handler answers
 * `application/octet-stream` for any extension its static table does not know
 * (see the warning in `src/platform/media.ts`).
 */
const OPAQUE_MIME_TYPES: ReadonlySet<string> = new Set([
  '',
  'application/octet-stream',
  'binary/octet-stream',
]);

/**
 * Is this file one the KYC upload route will certainly refuse?
 *
 * ⚠ **Answers `false` whenever it cannot tell.** This mirrors the rule
 * `validateMediaSelection` states in `files.service.ts`: the per-MIME ceiling is
 * "only applied when the browser gave us a type — an empty `File.type` is common
 * for some extensions, and **guessing would reject a file the server would have
 * accepted**". The server enforces the real policy and its answer is the
 * authority; this gate exists only to keep an obviously-doomed 10 MB upload off
 * a mobile connection.
 *
 * Getting this backwards is a native-only bug that never shows on the web, where
 * the file dialog populates `File.type` reliably.
 */
export function kycFileTypeIsWrong(file: File): boolean {
  const type = file.type.toLowerCase();
  if (!OPAQUE_MIME_TYPES.has(type)) {
    return !(KYC_ACCEPTED_MIME_TYPES as readonly string[]).includes(type);
  }

  // The type told us nothing, so fall back to the extension — which the native
  // picker guarantees, precisely because it is load-bearing downstream.
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!ext || ext === file.name.toLowerCase()) return false; // no extension: let the server decide
  return !(KYC_ACCEPTED_EXTENSIONS as readonly string[]).includes(ext);
}

/** 10 MB per file. */
export const KYC_MAX_FILE_BYTES = 10 * 1024 * 1024;

/** 10 files per request — and, on a multi slot, 10 in the slot in total. */
export const KYC_MAX_FILES_PER_REQUEST = 10;

/**
 * Fallback for `limits.multiSlotMaxFiles`. The server echoes the real number on
 * every read; this only covers the window before the first read resolves.
 */
export const KYC_MULTI_SLOT_MAX_FILES_FALLBACK = 10;

// ─── Derived state ────────────────────────────────────────────────────────────

/**
 * The four states a vendor's screen actually has, collapsing the
 * `status` + `submittedAt` pair into one value.
 *
 * This exists because `status` alone is ambiguous: `pending` is both "draft,
 * never touched" and "submitted, waiting for a reviewer", and those two want
 * opposite UI (an editable form versus a frozen one).
 */
export type KycPhase = 'draft' | 'under_review' | 'verified' | 'rejected';

export function kycPhase(record: Pick<KycRecord, 'status' | 'submittedAt'>): KycPhase {
  if (record.status === 'verified') return 'verified';
  if (record.status === 'rejected') return 'rejected';
  return record.submittedAt ? 'under_review' : 'draft';
}

/**
 * Turn the read shape back into the candidate shape `AddressSearch` renders and
 * `PATCH` accepts.
 *
 * ⚠ Returns `null` when the stored address never geocoded, because a candidate
 * without coordinates cannot be displayed on the pinned panel and must not be
 * sent back as if it were a geocoder result. The caller shows
 * `formattedAddress` as plain text in that case.
 */
export function kycAddressToCandidate(address: KycAddress | null): GeoAddressCandidate | null {
  if (!address?.coordinates || !address.formattedAddress) return null;
  return {
    formatted_address: address.formattedAddress,
    coordinates: { type: 'Point', coordinates: address.coordinates },
    provider: address.provider,
  };
}
