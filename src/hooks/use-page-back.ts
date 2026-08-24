import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

interface PageBackOptions {
  /** Where to go when there's no in-app history to pop back to. */
  fallbackPath: string;
  /**
   * Always go to `fallbackPath` instead of popping history.
   *
   * For pages that link *out* to a page which links back here — the editors and
   * the storefront preview do exactly that — popping is a trap: it returns the
   * vendor to the preview they just came from instead of to the list, and the
   * two bounce off each other. Where the parent is unambiguous (and the label
   * already names it), going there directly is both correct and predictable.
   */
  alwaysFallback?: boolean;
}

/**
 * "Back" for a detail or editor page: pop the in-app history when there is any,
 * otherwise go to the page's parent.
 *
 * Extracted from `PageBackButton` because the same behaviour is now reached two
 * ways — a text link above the title on a wide screen, an arrow beside it on a
 * handset (`EditorPageShell`) — and the two must not be allowed to disagree
 * about where back goes.
 */
export function usePageBack({ fallbackPath, alwaysFallback = false }: PageBackOptions): () => void {
  const navigate = useNavigate();

  return useCallback(() => {
    if (!alwaysFallback && window.history.length > 1) navigate(-1);
    else navigate(fallbackPath);
  }, [alwaysFallback, fallbackPath, navigate]);
}
