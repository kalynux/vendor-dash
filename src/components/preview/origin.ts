import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Where a preview page came from, and how it gets back.
 *
 * A preview is a detour, not a destination: the same product page is opened
 * from the products list, from either editor, and (for the store) from
 * Storefront settings. Popping browser history looked like it handled that,
 * but it ping-pongs — the editor links to the preview and the preview links
 * back to the editor, so `navigate(-1)` on either one lands on the other
 * instead of on the list the vendor actually came from.
 *
 * So the opener says where it is, in router state, and the preview goes back
 * there explicitly. Deep links and reloads-into-the-preview carry no state and
 * fall back to the surface that owns the thing being previewed.
 */

export interface PreviewOriginState {
  /** In-app path (with query) of the surface that opened the preview. */
  from?: string;
}

/**
 * Only dashboard paths are honoured. Router state is attacker-writable via
 * `history.pushState`, and a bare `from` is otherwise a redirect primitive.
 */
function isReturnable(from: unknown): from is string {
  return typeof from === 'string' && from.startsWith('/dashboard/');
}

/**
 * Opens a preview route, tagging it with the current page so its back button
 * can return here — filters and scroll position included, since the query
 * string travels with the path.
 */
export function useOpenPreview(): (path: string) => void {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();

  return useCallback(
    (path: string) => {
      const state: PreviewOriginState = { from: `${pathname}${search}` };
      navigate(path, { state });
    },
    [navigate, pathname, search],
  );
}

/**
 * The preview's back button: returns to whoever opened it, or to `fallbackPath`
 * when nobody did.
 *
 * Replaces rather than pushes so the detour leaves no entry behind — pressing
 * browser-back from the page we return to goes where it would have gone had the
 * preview never been opened.
 */
export function usePreviewBack(fallbackPath: string): () => void {
  const navigate = useNavigate();
  const { state } = useLocation();
  const from = (state as PreviewOriginState | null)?.from;

  return useCallback(() => {
    navigate(isReturnable(from) ? from : fallbackPath, { replace: true });
  }, [navigate, from, fallbackPath]);
}
