import { useEffect, useState } from 'react';
import { fetchProductById } from '@/services/products.service';

/**
 * Product thumbnails, resolved from the catalog by product id.
 *
 * Order items carry no image: `GET /vendor/orders/:id` returns only the pricing
 * snapshot (title / variantTitle / sku / qty / price), so anything rendering
 * order lines has to look the picture up itself. Results — misses included, so
 * a deleted product isn't refetched on every open — are memoised for the page's
 * lifetime and shared by every caller (the desktop dialog and the mobile sheet
 * render the same order).
 *
 * The product's first image is used rather than the variant's: it is the same
 * thumbnail the Products list shows, and reading the variant's would cost one
 * extra request per line.
 */
const imageCache = new Map<string, string | null>();

function pickCached(ids: string[]): Record<string, string> {
  const found: Record<string, string> = {};
  for (const id of ids) {
    const url = imageCache.get(id);
    if (url) found[id] = url;
  }
  return found;
}

export function useProductImages(productIds: (string | undefined | null)[]): Record<string, string> {
  // Sorted and joined so the effect only re-runs when the *set* of ids changes,
  // not on every render that builds a fresh array.
  const key = Array.from(new Set(productIds.filter((id): id is string => !!id))).sort().join(',');
  const ids = key ? key.split(',') : [];

  // Only a re-render trigger: the urls themselves are read straight from the
  // cache below, so an id already fetched paints on the first render.
  const [, onResolved] = useState(0);

  useEffect(() => {
    const missing = (key ? key.split(',') : []).filter((id) => !imageCache.has(id));
    if (missing.length === 0) return;

    let cancelled = false;
    void Promise.all(
      missing.map(async (id) => {
        try {
          const product = await fetchProductById(id);
          const image = product.files?.find((f) => f.mimeType?.startsWith('image/')) ?? product.files?.[0];
          imageCache.set(id, image?.url ?? null);
        } catch {
          // Deleted product, or one this vendor can no longer read — the line
          // falls back to its placeholder instead of failing the whole view.
          imageCache.set(id, null);
        }
      }),
    ).then(() => {
      if (!cancelled) onResolved((n) => n + 1);
    });

    return () => {
      cancelled = true;
    };
  }, [key]);

  return pickCached(ids);
}
