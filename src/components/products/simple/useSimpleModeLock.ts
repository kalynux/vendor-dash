import { useCallback, useMemo, useState } from 'react';
import { ApiError } from '@/types/api';

interface SimpleModeLock {
  productId: string | null;
  endpoint: string | null;
}

/**
 * `POST /api/vendor/products/<id>/convert-to-advanced` → `<id>`.
 * Recovery only — prefer the product id you already have in hand.
 */
export function productIdFromConvertEndpoint(endpoint: string | null): string | null {
  if (!endpoint) return null;
  return /\/products\/([^/\s]+)\/convert-to-advanced/.exec(endpoint)?.[1] ?? null;
}

/**
 * Turns a 409 CATALOG_PRODUCT_SIMPLE_MODE_LOCKED into state for
 * ConvertToAdvancedDialog, so an advanced operation blocked by simple mode
 * offers the escape hatch the backend hands us instead of a dead-end message.
 */
export function useSimpleModeLock() {
  const [lock, setLock] = useState<SimpleModeLock | null>(null);

  /** Returns true when the error was a lock and the dialog opened — callers should
   *  then return rather than also surfacing a toast or step error. */
  const handleError = useCallback((err: unknown, fallbackProductId?: string | null) => {
    if (err instanceof ApiError && err.isSimpleModeLocked) {
      setLock({
        productId: fallbackProductId ?? productIdFromConvertEndpoint(err.convertEndpoint),
        endpoint: err.convertEndpoint,
      });
      return true;
    }
    return false;
  }, []);

  const dismiss = useCallback(() => setLock(null), []);

  // Memoised so callers can list the whole object as a hook dependency without
  // it changing identity every render.
  return useMemo(() => ({ lock, handleError, dismiss }), [lock, handleError, dismiss]);
}
