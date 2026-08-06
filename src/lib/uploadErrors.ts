// ─── File upload error messaging ──────────────────────────────────────────────
// Turns a failed file-upload response into a friendly, per-file message.
//
// `POST /api/files/upload` (and the digital-asset upload's second gate) returns
// `400 UPLOAD_POLICY_VIOLATION` with `error.details.violations[]`, each scoped to
// a file via `fileIndex`. See `api-doc/errors/README.md` §7. We surface the
// machine `code` as a readable line, naming the offending file where possible.

import { ApiError } from '@/types/api';
import { apiErrorMessage, tStatic } from '@/i18n';

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
 * Build a localized message from an upload error.
 *
 * `UPLOAD_POLICY_VIOLATION` carries one `violation` per rejected file, so this
 * names each file and says why. The violation reasons live under
 * `errors.upload.violations` in the catalogs; `files` supplies a name when the
 * backend didn't echo `metadata.originalName` back.
 */
export function getUploadErrorMessage(err: unknown, files?: File[]): string {
  if (err instanceof ApiError && err.violations && err.violations.length > 0) {
    const lines = err.violations.map((v) => {
      const reasonKey = `errors.upload.violations.${v.code}`;
      const reason = tStatic(reasonKey);
      // `tStatic` echoes the key back when it is unmapped — fall back then.
      const text = reason === reasonKey ? tStatic('errors.upload.violations.UNKNOWN') : reason;
      const name = nameForViolation(v, files);
      return name
        ? tStatic('errors.upload.namedFile', { name, reason: text })
        : tStatic('errors.upload.someFile', { reason: text });
    });
    // De-dupe identical lines (common when several files share one reason).
    return Array.from(new Set(lines)).join(' ');
  }

  return apiErrorMessage(err, { fallbackKey: 'media.errors.uploadFailed' });
}
