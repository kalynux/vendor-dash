// ─── File Management service ───────────────────────────────────────────────────
// Talks to the backend File Management Service (api-doc/vendor/file-management.md).
// Flat file model (no folders). Attachment status comes from the `usage` object
// on GET /files/:id — never from `usageCount`.

import { api, BASE_URL } from './api';
import { ApiError, type ApiErrorDetail, type UploadViolation } from '@/types/api';
import type {
  ApiFile,
  ApiFileDetail,
  FileKind,
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

// Public origin for files that arrive without a populated `url`. Local storage
// serves at `<origin>/uploads/<key>`; override via VITE_FILE_BASE_URL when the
// storage host differs from the API host.
const FILE_PUBLIC_BASE: string =
  (import.meta.env.VITE_FILE_BASE_URL as string | undefined) ??
  `${BASE_URL.replace(/\/$/, '')}/files`;

/** Resolve a displayable URL for a file, preferring the backend-populated `url`. */
export function resolveFileUrl(file: Pick<ApiFile, 'url' | 'key'>): string {
  if (file.url) return file.url;
  const base = FILE_PUBLIC_BASE.replace(/\/$/, '');
  const key = file.key.replace(/^\//, '');
  return `${base}/${key}`;
}

/**
 * Normalize a file-reference field into a displayable URL, or `null` when unset.
 *
 * Read endpoints now return a populated file object `{ id, key, url, … }` for every
 * single-file slot (avatars, logos, banners, covers — the same shape product images
 * use). This accepts that object, a bare URL string (legacy / not-yet-migrated
 * fields), or `null`/`undefined`, and always yields a URL string or `null`.
 */
export function fileRefUrl(
  ref: string | Pick<ApiFile, 'url' | 'key'> | null | undefined,
): string | null {
  if (!ref) return null;
  if (typeof ref === 'string') return ref;
  return resolveFileUrl(ref);
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

/**
 * The ONLY attachment signal: a file is attached if it has live references.
 * Reads `usage`, never `usageCount`.
 */
export function isAttached(detail: ApiFileDetail): boolean {
  return detail.usage.totalReferences > 0;
}

// ─── Reads ────────────────────────────────────────────────────────────────────

export async function listFiles(
  params: FileListParams = {},
): Promise<{ files: ApiFile[]; pagination: FilePagination; storage: StorageUsage | null }> {
  const qs = buildQueryString(params as Record<string, unknown>);
  const res = await api.get<FileListResponse>(`/files${qs}`);
  return {
    files: res.data.files,
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

/** Soft delete. Rejects with `409 FILE_IN_USE` when the file is still referenced. */
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
    return `You can upload at most ${MAX_FILES_PER_UPLOAD} files at once.`;
  }
  if (videos.length > MAX_VIDEOS_PER_UPLOAD) {
    return `You can upload at most ${MAX_VIDEOS_PER_UPLOAD} videos at once.`;
  }

  const tooBig = others.find((f) => f.size > VENDOR_MAX_BYTES);
  if (tooBig) return `"${tooBig.name}" exceeds the 500 MB limit.`;

  const bigVideo = videos.find((f) => f.size > VIDEO_MAX_BYTES);
  if (bigVideo) return `"${bigVideo.name}" exceeds the 70 MB video limit.`;

  const badFormat = videos.find(
    (f) => f.type && !(VIDEO_MIME_TYPES as readonly string[]).includes(f.type),
  );
  if (badFormat) return `"${badFormat.name}" is not a supported video (use MP4, MOV or WebM).`;

  return null;
}

function errorFromXhr(xhr: XMLHttpRequest, files: File[]): ApiError {
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(xhr.responseText);
  } catch {
    // response may not be JSON
  }
  const error = (body.error ?? body) as Record<string, unknown>;
  const message =
    (error.message as string) ??
    (body.message as string) ??
    `Upload failed with status ${xhr.status}`;
  const code = (error.code as string) ?? String(xhr.status || 0);
  const rawDetails = error.details;
  const details = Array.isArray(rawDetails) ? (rawDetails as ApiErrorDetail[]) : undefined;
  const violations =
    rawDetails &&
    typeof rawDetails === 'object' &&
    Array.isArray((rawDetails as Record<string, unknown>).violations)
      ? ((rawDetails as Record<string, unknown>).violations as UploadViolation[])
      : undefined;
  // `fileIndex` is scoped to this request's own file list. Because a mixed
  // selection is split across two requests, backfill each violation's filename
  // from THIS request so per-file messaging stays correct after the split.
  violations?.forEach((v) => {
    if (!v.metadata?.originalName && typeof v.fileIndex === 'number' && files[v.fileIndex]) {
      v.metadata = { ...v.metadata, originalName: files[v.fileIndex].name };
    }
  });
  return new ApiError(xhr.status, code, message, details, undefined, violations);
}

/** Low-level XHR upload to a single route. Reports bytes loaded for aggregation. */
function xhrUpload(
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
    xhr.withCredentials = true;

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

    xhr.send(fd);
  });
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
