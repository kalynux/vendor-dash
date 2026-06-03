// ─── File upload error messaging ──────────────────────────────────────────────
// Turns a failed file-upload response into a friendly, per-file message.
//
// `POST /api/files/upload` (and the digital-asset upload's second gate) returns
// `400 UPLOAD_POLICY_VIOLATION` with `error.details.violations[]`, each scoped to
// a file via `fileIndex`. See `api-doc/errors/README.md` §7. We surface the
// machine `code` as a readable line, naming the offending file where possible.

import { ApiError, type UploadViolationCode } from '@/types/api';

export const UPLOAD_VIOLATION_MESSAGES: Record<UploadViolationCode, string> = {
  FILE_TOO_LARGE: 'is too large',
  MIME_NOT_ALLOWED: 'has an unsupported file type',
  TOO_MANY_FILES: 'exceeds the maximum number of files',
  QUOTA_EXCEEDED: 'would exceed your storage quota',
  VIRUS_DETECTED: 'failed the security scan',
  PERMISSION_DENIED: 'cannot be uploaded (permission denied)',
  TOTAL_SIZE_EXCEEDED: 'pushes the upload over the total size limit',
  DUPLICATE_FILE: 'has already been uploaded',
  MIME_TYPE_MISMATCH: 'has contents that don’t match its extension',
  POLYGLOT_DETECTED: 'looks like a disguised file and was rejected',
  UNDETECTABLE_TYPE: 'has an unrecognised file type',
};

function nameForViolation(
  violation: { fileIndex?: number; metadata?: { originalName?: string } },
  files?: File[],
): string | null {
  if (violation.metadata?.originalName) return violation.metadata.originalName;
  if (
    typeof violation.fileIndex === 'number' &&
    files &&
    files[violation.fileIndex]
  ) {
    return files[violation.fileIndex].name;
  }
  return null;
}

/**
 * Build a human-readable message from an upload error.
 * - For `UPLOAD_POLICY_VIOLATION`, maps each `violation` to a per-file line.
 * - Falls back to the error message for any other failure.
 */
export function getUploadErrorMessage(err: unknown, files?: File[]): string {
  if (err instanceof ApiError && err.violations && err.violations.length > 0) {
    const lines = err.violations.map((v) => {
      const reason = UPLOAD_VIOLATION_MESSAGES[v.code as UploadViolationCode] ?? v.message;
      const name = nameForViolation(v, files);
      return name ? `${name} ${reason}.` : `A file ${reason}.`;
    });
    // De-dupe identical lines (common when several files share one reason).
    return Array.from(new Set(lines)).join(' ');
  }

  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Upload failed. Please try again.';
}
