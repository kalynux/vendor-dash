// ─── File Management service ───────────────────────────────────────────────────
// Talks to the backend File Management Service (api-doc/vendor/file-management.md).
// Flat file model (no folders). Attachment status comes from the `usage` object
// on GET /files/:id — never from `usageCount`.

import { api, authorizeXhr, BASE_URL, errorFromBody, refreshForXhr } from './api';
import { ApiError } from '@/types/api';
import { tStatic } from '@/i18n';
import type {
  ApiFile,
  ApiFileDetail,
  FileKind,
  FileRef,
  FileUrlSource,
  MediaCategory,
  FileListParams,
  FileListResponse,
  FileDetailResponse,
  FileUpdateResponse,
  FileUploadResponse,
  FilePagination,
  StorageUsage,
  StorageResponse,
} from '@/types/file.types';

// ─── Helpers ────────────────────────────────────────────────────────────────

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

/**
 * Resolve a displayable URL for a file, or `null` when there is none to show.
 *
 * ✅ **The server answers this now, and this function only reads it.** Every file
 * payload — including the raw records from `GET /api/files`, which gained `url` and
 * `access` on 2026-09-08 — carries a URL computed by the backend's single
 * `toFileDetail` resolver.
 *
 * ⚠ **Do NOT reintroduce a key-based fallback.** This function used to rebuild a URL
 * from `key` against a `VITE_FILE_BASE_URL` origin, with a hardcoded copy of the
 * backend's private-tree list. That copy was wrong three ways and each was silent:
 *
 *   1. it could not produce `quota_blocked` at all, so a file held back for exceeding
 *      the owner's storage plan rendered as ordinary public media;
 *   2. it failed OPEN on an unrecognised storage tree where the backend fails CLOSED,
 *      so a private tree added later would have been rendered as a public URL;
 *   3. it did not normalise backslashes, so a key written on Windows
 *      (`shipments\\2026\\…`) classified as public.
 *
 * A `null` return is a normal, renderable state — show a placeholder. Branch on
 * `access` to say WHY: `authorized` (fetch through the owning entity's own route)
 * versus `quota_blocked` (the owner is over their plan; offer an upgrade, never
 * "file missing").
 */
export function resolveFileUrl(file: FileUrlSource): string | null {
  return file.url ?? null;
}

/**
 * Normalize a file-reference field into a displayable URL, or `null` when there is
 * nothing renderable — the slot is unset, or the file is authorized-access.
 *
 * Accepts the populated `FileRef` object every read endpoint returns for a single
 * file slot (avatars, logos, banners, covers, product media), a bare URL string
 * (legacy / not-yet-migrated fields), or `null`/`undefined`.
 *
 * A `null` return is a normal, renderable state — show a placeholder or the file's
 * metadata, not an error. `access` says which of the two null cases it is.
 */
export function fileRefUrl(
  ref: string | FileUrlSource | null | undefined,
): string | null {
  if (!ref) return null;
  if (typeof ref === 'string') return ref;
  return resolveFileUrl(ref);
}

/**
 * Build the `FileRef` an entity write expects from a file picked out of the media
 * library.
 *
 * Since 2026-09-08 this is a projection rather than a derivation: `GET /api/files`
 * carries `url` and `access`, so both are copied straight through. `fileAccessForKey`
 * — which guessed `access` from the key prefix, and could only ever return two of the
 * three values — was deleted with the rest of that workaround.
 *
 * The `?? 'authorized'` is the fail-closed default for a payload from an older
 * backend that sends no `access`. It matches `isPrivateStorageKey`'s own posture:
 * treat the unknown as private, because the opposite guess is the one that leaks.
 */
export function fileRefFromApiFile(file: ApiFile): FileRef {
  return {
    id: file.id,
    key: file.key,
    url: file.url ?? null,
    access: file.access ?? 'authorized',
    mimeType: file.mimeType,
    size: file.size,
    originalName: file.originalName,
  };
}

/**
 * The four states a file slot can be in on screen, collapsed from `url` + `access`
 * so no consumer has to re-derive the precedence.
 *
 * 🔴 **`quota_blocked` OUTRANKS `authorized` and is tested first.** A blocked file
 * inside a private tree reports `quota_blocked`, and a check written the other way
 * round sends the vendor to a permissions conversation about a billing problem
 * (api-doc/vendor/storage.md § 3.1).
 *
 *  - `renderable` — there is a URL; paint it.
 *  - `blocked`    — the OWNER is over their plan's storage cap. The bytes and the
 *                   database row are both intact and an upgrade restores them, so
 *                   the words are *locked* / *hidden* and the fix is *upgrade or
 *                   delete something older*. **Never "missing" or "deleted"** — the
 *                   second starts the wrong support conversation.
 *  - `restricted` — a private tree. There is no URL to render and no vendor route
 *                   that serves the bytes; show metadata instead.
 *  - `empty`      — the slot is genuinely unset.
 */
export type FileDisplayState = 'renderable' | 'blocked' | 'restricted' | 'empty';

export function fileDisplayState(
  ref: string | FileUrlSource | null | undefined,
): FileDisplayState {
  if (!ref) return 'empty';
  if (typeof ref === 'string') return 'renderable';
  // Quota first — see the precedence note above.
  if (ref.access === 'quota_blocked') return 'blocked';
  if (ref.url) return 'renderable';
  return ref.access === 'authorized' ? 'restricted' : 'empty';
}

/** Coarse UI category from a MIME type. */
export function kindFromMime(mimeType: string): FileKind {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'document';
}

/** Map a coarse UI kind to the backend `category` filter value. */
export function categoryFromKind(kind: FileKind): MediaCategory {
  return kind; // FileKind is a subset of MediaCategory
}

// ─── Reads ────────────────────────────────────────────────────────────────────

export async function listFiles(
  params: FileListParams = {},
): Promise<{ files: ApiFile[]; pagination: FilePagination; storage: StorageUsage | null }> {
  const qs = buildQueryString(params as Record<string, unknown>);
  const res = await api.get<FileListResponse>(`/files${qs}`);
  return {
    // F-26: this endpoint leaks soft-deleted rows — it is the only list route on
    // the platform that does not exclude them. Filter here or a file the vendor
    // deleted comes straight back into the media browser.
    files: res.data.files.filter((f) => f.deletedAt == null),
    pagination: res.data.pagination,
    // Embedded usage summary (api-doc/vendor/storage.md §2); `null` for admins.
    storage: res.data.storage ?? null,
  };
}

/**
 * Account-wide media storage usage + plan limit (api-doc/vendor/storage.md §2).
 * The primary source for a storage widget — includes the per-category breakdown.
 */
export async function fetchStorageUsage(): Promise<StorageUsage> {
  const res = await api.get<StorageResponse>('/files/storage');
  return res.data;
}

export async function getFile(id: string): Promise<ApiFileDetail> {
  const res = await api.get<FileDetailResponse>(`/files/${id}`);
  return res.data;
}

/**
 * Resolve usage/detail for a page of files (bounded by page size). Used to derive
 * reference-based attachment status without relying on `usageCount`. Failures per
 * file are swallowed (null) so one bad id never blanks the whole page.
 */
export async function getFilesUsage(
  ids: string[],
): Promise<Record<string, ApiFileDetail>> {
  const results = await Promise.all(
    ids.map((id) => getFile(id).then((d) => d).catch(() => null)),
  );
  const map: Record<string, ApiFileDetail> = {};
  results.forEach((d) => {
    if (d) map[d.id] = d;
  });
  return map;
}

// ─── Writes ─────────────────────────────────────────────────────────────────

export async function updateFileName(
  id: string,
  originalName: string,
): Promise<ApiFile> {
  const res = await api.patch<FileUpdateResponse>(`/files/${id}`, { originalName });
  return res.data;
}

/**
 * Soft delete. Rejects with `409 CATALOG_FILE_STILL_REFERENCED` when the file is
 * still attached to something; `details.usage` names the holders.
 */
export async function deleteFile(id: string): Promise<void> {
  await api.delete<{ success: boolean; message: string }>(`/files/${id}`);
}

// ─── Upload with progress (XHR) ───────────────────────────────────────────────
// The fetch-based client can't report upload progress, so uploads go through XHR.
// Cookie auth is preserved with `withCredentials`.
//
// Two upload routes (see api-doc/vendor/file-management.md):
//   • images/docs/audio/archives → POST /files/upload        (field `files`, ≤10, 500 MB each)
//   • videos                     → POST /files/upload/video  (field `videos`, ≤3, 70 MB each)
// The general endpoint REJECTS videos, so a mixed selection is split and routed
// per file. `uploadMediaWithProgress` is the single entry point callers should use.

// Role-based limits for the general (non-video) upload route.
export const MAX_FILES_PER_UPLOAD = 10;
export const VENDOR_MAX_BYTES = 500 * 1024 * 1024; // 500 MB

/** Total bytes one request may carry, across all its files. */
export const MAX_REQUEST_TOTAL_BYTES = 100 * 1024 * 1024; // 100 MB

/**
 * The policy engine's per-MIME ceilings — the limit a vendor actually hits.
 *
 * 🔴 **These bind long before the 500 MB role ceiling.** That ceiling is a coarse
 * per-request gate in the controller; the policy engine then applies these, and a
 * 12 MB photo is refused despite being 1/40th of the role allowance. Validating
 * only against `VENDOR_MAX_BYTES` means every real refusal arrives from the
 * server after a full upload.
 *
 * 🔴 **An unlisted MIME type is refused**, not defaulted — the validator raises
 * `MIME_NOT_ALLOWED` when the type has no entry at all. So absence from this map
 * means "rejected", which is why the check below treats it that way rather than
 * waving the file through.
 *
 * Mirrors `getDefaultUploadConfig()` in the backend's
 * `core/uploads/upload-config.ts`, read from source on 2026-08-24. It is the
 * *default* config, so a deployment could in principle override it — the server
 * stays the source of truth and its `violations[]` are still surfaced verbatim.
 * This exists to catch the common case before spending the upload.
 */
export const PER_MIME_MAX_BYTES: Readonly<Record<string, number>> = {
  'image/jpeg': 10 * 1024 * 1024,
  'image/png': 10 * 1024 * 1024,
  'image/webp': 10 * 1024 * 1024,
  'image/gif': 5 * 1024 * 1024,
  'application/pdf': 25 * 1024 * 1024,
  'application/zip': 50 * 1024 * 1024,
  'audio/mpeg': 10 * 1024 * 1024,
  'audio/wav': 25 * 1024 * 1024,
};

// Dedicated video route constraints. Only these formats are accepted; the server
// re-validates by sniffing the bytes, so this is a UX guard, not the source of truth.
export const VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'] as const;
export const VIDEO_EXTENSIONS = ['mp4', 'mov', 'webm'] as const;
export const VIDEO_MAX_BYTES = 70 * 1024 * 1024; // 70 MB per video
export const MAX_VIDEOS_PER_UPLOAD = 3; // non-customer actors; customers get 1

/**
 * Does this selection belong on the video route? Any `video/*` file does — the
 * general endpoint accepts no video at all. Falls back to the extension when the
 * browser doesn't populate `File.type` (common for `.mov`).
 */
export function isVideoUpload(file: File): boolean {
  if (file.type) return file.type.startsWith('video/');
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return (VIDEO_EXTENSIONS as readonly string[]).includes(ext);
}

/**
 * Validate a mixed selection client-side before uploading. Returns a friendly
 * error message, or `null` when the selection is acceptable. Videos and other
 * files are checked against their own route's count/size/format limits.
 */
export function validateMediaSelection(files: File[]): string | null {
  const videos = files.filter(isVideoUpload);
  const others = files.filter((f) => !isVideoUpload(f));

  if (others.length > MAX_FILES_PER_UPLOAD) {
    return tStatic('media.upload.validation.tooManyFiles', { max: MAX_FILES_PER_UPLOAD });
  }
  if (videos.length > MAX_VIDEOS_PER_UPLOAD) {
    return tStatic('media.upload.validation.tooManyVideos', { max: MAX_VIDEOS_PER_UPLOAD });
  }

  const tooBig = others.find((f) => f.size > VENDOR_MAX_BYTES);
  if (tooBig) return tStatic('media.upload.validation.fileTooLarge', { name: tooBig.name });

  // The per-MIME ceiling, which binds far earlier than the role one above and is
  // what a vendor actually runs into. Only applied when the browser gave us a
  // type: an empty `File.type` is common for some extensions, and guessing would
  // reject a file the server would have accepted.
  for (const f of others) {
    if (!f.type) continue;
    const cap = PER_MIME_MAX_BYTES[f.type];
    if (cap === undefined) {
      // Absence means "no policy entry", which the server treats as
      // MIME_NOT_ALLOWED rather than as unlimited.
      return tStatic('media.upload.validation.typeNotAllowed', { name: f.name });
    }
    if (f.size > cap) {
      return tStatic('media.upload.validation.overTypeLimit', {
        name: f.name,
        max: Math.round(cap / (1024 * 1024)),
      });
    }
  }

  // One request carries at most 100 MB in total, independently of any per-file
  // rule — ten 15 MB PDFs each pass their own cap and the batch still fails.
  const totalBytes = others.reduce((sum, f) => sum + f.size, 0);
  if (totalBytes > MAX_REQUEST_TOTAL_BYTES) {
    return tStatic('media.upload.validation.batchTooLarge', {
      max: Math.round(MAX_REQUEST_TOTAL_BYTES / (1024 * 1024)),
    });
  }

  const bigVideo = videos.find((f) => f.size > VIDEO_MAX_BYTES);
  if (bigVideo) return tStatic('media.upload.validation.videoTooLarge', { name: bigVideo.name });

  const badFormat = videos.find(
    (f) => f.type && !(VIDEO_MIME_TYPES as readonly string[]).includes(f.type),
  );
  if (badFormat) {
    return tStatic('media.upload.validation.videoFormat', { name: badFormat.name });
  }

  return null;
}

function errorFromXhr(xhr: XMLHttpRequest, files: File[]): ApiError {
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(xhr.responseText);
  } catch {
    // response may not be JSON
  }
  // Same envelope as `fetch`, so it goes through the same parser — `category`,
  // `requestId` and the normalized field errors come along for free.
  const err = errorFromBody(
    xhr.status,
    body,
    xhr.getResponseHeader('Retry-After'),
    // Set on every response and the one header exposed cross-origin, so an
    // upload that fails with a non-JSON 5xx still yields an id to quote.
    xhr.getResponseHeader('X-Request-Id'),
  );
  // `fileIndex` is scoped to this request's own file list. Because a mixed
  // selection is split across two requests, backfill each violation's filename
  // from THIS request so per-file messaging stays correct after the split.
  err.violations?.forEach((v) => {
    if (!v.metadata?.originalName && typeof v.fileIndex === 'number' && files[v.fileIndex]) {
      v.metadata = { ...v.metadata, originalName: files[v.fileIndex].name };
    }
  });
  return err;
}

/**
 * One XHR attempt at a single route. Reports bytes loaded for aggregation.
 *
 * XHR rather than `fetch` because `upload.onprogress` is the only way to get
 * real byte progress, and the media UI reports it. That puts this outside
 * `api.ts`'s request path, so the active transport's credentials have to be
 * applied by hand — `authorizeXhr` is the sanctioned seam for that, and it must
 * run after `open()` or `setRequestHeader` throws.
 */
function xhrAttempt(
  url: string,
  fieldName: string,
  files: File[],
  onBytes?: (loaded: number) => void,
): Promise<ApiFile[]> {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    files.forEach((f) => fd.append(fieldName, f));

    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onBytes) onBytes(event.loaded);
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const body = JSON.parse(xhr.responseText) as FileUploadResponse;
          resolve(body.data);
        } catch {
          reject(new ApiError(xhr.status, 'PARSE_ERROR', 'Could not parse upload response'));
        }
      } else {
        reject(errorFromXhr(xhr, files));
      }
    };

    xhr.onerror = () =>
      reject(new ApiError(0, 'NETWORK_ERROR', 'Network error during upload. Please try again.'));
    xhr.onabort = () => reject(new ApiError(0, 'ABORTED', 'Upload cancelled.'));

    // `authorizeXhr` is async (the bearer store may have to be read), so the
    // send is chained off it rather than sitting after it.
    authorizeXhr(xhr).then(
      () => xhr.send(fd),
      (err) => reject(err),
    );
  });
}

/**
 * Low-level XHR upload, with one refresh-and-retry on a 401.
 *
 * A large upload over a slow connection can outlive a 15-minute access token, so
 * this is a real case and not a theoretical one — and it is newly reachable on
 * the bearer transport, which has no silent server-side refresh to fall back on.
 * `refreshForXhr` shares `api.ts`'s single-flight lock, so an upload and a page
 * load racing the same dead token perform one refresh between them.
 */
async function xhrUpload(
  url: string,
  fieldName: string,
  files: File[],
  onBytes?: (loaded: number) => void,
): Promise<ApiFile[]> {
  try {
    return await xhrAttempt(url, fieldName, files, onBytes);
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401) throw err;
    // `refreshForXhr` returns false once the session is genuinely over, having
    // already dispatched the logout — rethrowing the original 401 is then the
    // honest answer, and the app is on its way to the login screen anyway.
    if (!(await refreshForXhr())) throw err;
    // Progress restarts from zero for the retry. The aggregator reads the latest
    // value per request rather than accumulating, so the bar rewinds rather than
    // overcounting — the correct direction of the two.
    return xhrAttempt(url, fieldName, files, onBytes);
  }
}

/**
 * Upload a mixed selection, routing videos to the dedicated video endpoint and
 * everything else to the general one. Progress is aggregated across both requests
 * by byte count. Returns the combined `ApiFile[]` for all uploaded files.
 */
export function uploadMediaWithProgress(
  files: File[],
  onProgress?: (percent: number) => void,
): Promise<ApiFile[]> {
  const videos = files.filter(isVideoUpload);
  const others = files.filter((f) => !isVideoUpload(f));

  const totalBytes = files.reduce((sum, f) => sum + f.size, 0) || 1;
  const loaded = { files: 0, videos: 0 };
  const report = () =>
    onProgress?.(Math.round(((loaded.files + loaded.videos) / totalBytes) * 100));

  const tasks: Promise<ApiFile[]>[] = [];
  if (others.length > 0) {
    tasks.push(
      xhrUpload(`${BASE_URL}/files/upload`, 'files', others, (b) => {
        loaded.files = b;
        report();
      }),
    );
  }
  if (videos.length > 0) {
    tasks.push(
      xhrUpload(`${BASE_URL}/files/upload/video`, 'videos', videos, (b) => {
        loaded.videos = b;
        report();
      }),
    );
  }

  return Promise.all(tasks).then((groups) => groups.flat());
}

/**
 * Back-compat alias — uploads through the smart router. Prefer
 * `uploadMediaWithProgress` directly in new code.
 */
export const uploadFilesWithProgress = uploadMediaWithProgress;
