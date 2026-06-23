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
