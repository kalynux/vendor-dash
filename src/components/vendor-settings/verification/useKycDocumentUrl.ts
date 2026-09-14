import { useEffect, useState } from 'react';

import { fetchKycDocumentBlob } from '@/services/kyc.service';
import { apiErrorMessage } from '@/i18n';
import type { FileRef } from '@/types/file.types';

interface KycDocumentUrlState {
  /** An object URL for the document, or `null` while loading or on failure. */
  url: string | null;
  loading: boolean;
  /** A localized reason, or `null`. */
  error: string | null;
  /** `true` when the file is withheld for storage-quota reasons, not privacy. */
  quotaBlocked: boolean;
}

/** What one completed fetch produced, tagged with the file it was for. */
interface Resolved {
  fileId: string;
  url: string | null;
  error: string | null;
}

/**
 * Resolve a KYC document to something renderable.
 *
 * ⚠ **`doc.url` is always `null` here and that is correct, not broken.** Every
 * file in this module lives in a private storage tree; the `id` is the handle
 * and the bytes come from the authorized content route. So this fetches the
 * blob and hands back an object URL.
 *
 * The one case that is *not* a privacy null is `access: 'quota_blocked'` — the
 * vendor is over their plan's storage cap. The content route will not help
 * there, so this does not call it, and the caller renders "over your storage
 * limit" rather than a missing file.
 *
 * ── Why the result is tagged with its file id ────────────────────────────────
 * Everything except the completed fetch is derived during render, so the effect
 * never calls `setState` synchronously (which would cascade a second render on
 * every mount). `loading` is "there is a file to fetch and no result for *this*
 * file yet", which also makes a file-id change correct for free: the previous
 * document stops rendering on the same tick the new one starts loading, rather
 * than lingering until the new fetch resolves.
 *
 * Owns the object URL's lifetime: revoked when the file id changes and on
 * unmount. Leaking these keeps the decoded image in memory for the life of the
 * document, which on a page showing several ID scans is not a rounding error.
 */
export function useKycDocumentUrl(doc: FileRef | null): KycDocumentUrlState {
  const fileId = doc?.id ?? null;
  const quotaBlocked = doc?.access === 'quota_blocked';

  const [resolved, setResolved] = useState<Resolved | null>(null);

  useEffect(() => {
    if (!fileId || quotaBlocked) return;

    // Guards the state writes below. `cancelled` rather than an AbortController
    // because the blob is the thing to clean up, and a late-arriving response
    // whose object URL is never revoked is the actual leak.
    let cancelled = false;
    let objectUrl: string | null = null;

    fetchKycDocumentBlob(fileId)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setResolved({ fileId, url: objectUrl, error: null });
      })
      .catch((err) => {
        if (cancelled) return;
        setResolved({ fileId, url: null, error: apiErrorMessage(err) });
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId, quotaBlocked]);

  // A result for a *different* file is not this file's result. Discarding it
  // here rather than clearing it in the effect is what keeps a revoked object
  // URL from ever reaching an `<img src>`.
  const current = resolved?.fileId === fileId ? resolved : null;

  return {
    url: current?.url ?? null,
    loading: Boolean(fileId) && !quotaBlocked && current === null,
    error: current?.error ?? null,
    quotaBlocked,
  };
}
