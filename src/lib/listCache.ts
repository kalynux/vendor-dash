// Module-level cache for list-page state so navigating away and back (tab
// switch, or a route round-trip like Products → edit → back) can restore what
// was already loaded instead of refetching. Lives for the lifetime of the SPA
// session; a full page reload clears it (deep-links load fresh, as intended).

const cache = new Map<string, unknown>();

export function getListCache<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined;
}

export function setListCache<T>(key: string, value: T): void {
  cache.set(key, value);
}

export function clearListCache(key: string): void {
  cache.delete(key);
}

/** The media library's saved lists: the phone's infinite list, and the desktop page. */
export const MEDIA_LIST_CACHE_KEY = 'media';
export const MEDIA_DESKTOP_CACHE_KEY = 'media-desktop';

/**
 * Forget the media library's saved lists after files were deleted elsewhere
 * (deleting a product deletes its pictures), so it loads fresh next time —
 * storage usage included, since that figure comes with the file list.
 */
export function forgetMediaLists(): void {
  clearListCache(MEDIA_LIST_CACHE_KEY);
  clearListCache(MEDIA_DESKTOP_CACHE_KEY);
}
