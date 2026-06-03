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
): Promise<{ files: ApiFile[]; pagination: FilePagination }> {
  const qs = buildQueryString(params as Record<string, unknown>);
  const res = await api.get<FileListResponse>(`/files${qs}`);
  return { files: res.data.files, pagination: res.data.pagination };
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
// Cookie auth is preserved with `withCredentials`. Field name is `files` (1–10).

function errorFromXhr(xhr: XMLHttpRequest): ApiError {
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
  return new ApiError(xhr.status, code, message, details, undefined, violations);
}

export function uploadFilesWithProgress(
  files: File[],
  onProgress?: (percent: number) => void,
): Promise<ApiFile[]> {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    files.forEach((f) => fd.append('files', f));

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE_URL}/files/upload`);
    xhr.withCredentials = true;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
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
        reject(errorFromXhr(xhr));
      }
    };

    xhr.onerror = () =>
      reject(new ApiError(0, 'NETWORK_ERROR', 'Network error during upload. Please try again.'));
    xhr.onabort = () => reject(new ApiError(0, 'ABORTED', 'Upload cancelled.'));

    xhr.send(fd);
  });
}
