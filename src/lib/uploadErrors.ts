// ─── File upload error messaging ──────────────────────────────────────────────
// Turns a failed file-upload response into a friendly, per-file message.
//
// `UPLOAD_POLICY_VIOLATION` is the ONLY top-level code either upload route
// produces for a refusal — the cheap pre-pipeline gates (no files, too many
// files, too large, unsupported type) stopped answering with their own
// `error.code` and now report through `error.details.violations[]` like every
// other rule, each scoped to a file via `fileIndex`. Its status varies with the
// violation (413 for FILE_TOO_LARGE, 400 otherwise), so branch on the violation
// and never on the status. See `api-doc/errors/README.md` §7.
//
// One exception carries a different code: when multer aborts the stream
// mid-parse there is no violation list at all, only a bare
// `413 CATALOG_FILE_TOO_LARGE`.

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
  // The multer variant: the stream was aborted mid-parse, so the server never
  // reached the pipeline and there is no `details` to read. Named here because
  // it is the one refusal that looks nothing like the others.
  if (err instanceof ApiError && err.code === 'CATALOG_FILE_TOO_LARGE' && !err.violations?.length) {
    return tStatic('errors.upload.someFile', {
      reason: tStatic('errors.upload.violations.FILE_TOO_LARGE'),
    });
  }

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
