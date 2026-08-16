/**
 * The customer storefront's URL shape, mirrored.
 *
 * Source of truth: `frontend/landing/src/lib/shop/shop.routes.ts`. Keep the two in
 * step — a path that drifts here produces a link that 404s, and nothing in this
 * repo can catch that at build time.
 *
 * ── Why not `store.publicUrl` ────────────────────────────────────────────────
 *
 * The vendor API does return a `publicUrl`, but it is unusable for this purpose:
 * it is an absolute URL baked from the backend's own `STORE_PUBLIC_URL_BASE`, so
 * it points at the production storefront even when a developer is running the
 * landing app on localhost. Products fare worse — there is no product-level
 * `publicUrl` at all, only a bare `slug`. Building both from a slug plus this
 * app's own base is the only form that is correct in every environment.
 *
 * ── Why products nest under their store ──────────────────────────────────────
 *
 * `Product.slug` is unique per vendor, not globally, so two sellers may both own
 * `blue-shirt` and `/shop/products/:slug` cannot resolve. `productIdPath` is the
 * escape hatch for the places that hold an id and no store slug.
 */

/**
 * Where the storefront is served. Defaults to the landing app's dev server so a
 * fresh checkout works without configuration.
 */
const BASE = (
  (import.meta.env.VITE_STOREFRONT_BASE_URL as string | undefined) ?? 'http://localhost:3000'
).replace(/\/+$/, '');

export const SHOP_ROOT = '/shop';

export function storePath(storeSlug: string): string {
  return `${SHOP_ROOT}/stores/${encodeURIComponent(storeSlug)}`;
}

/** The canonical product URL. */
export function productPath(storeSlug: string, productSlug: string): string {
  return `${storePath(storeSlug)}/products/${encodeURIComponent(productSlug)}`;
}

/**
 * The deep-link form, by ObjectId — a redirect stub on the storefront that
 * resolves the product and forwards to `productPath`. For the callers that know
 * an id but not a slug.
 */
export function productIdPath(productId: string): string {
  return `${SHOP_ROOT}/p/${encodeURIComponent(productId)}`;
}

/** Absolute URL for a storefront path. */
export function storefrontUrl(path: string): string {
  return `${BASE}${path}`;
}

/**
 * Prefix a storefront path with a locale.
 *
 * The storefront runs next-intl with `localePrefix: "as-needed"`, so English is
 * served unprefixed and prefixing it would produce a 404. Anything else — and
 * only the languages the storefront actually ships — takes a `/xx` prefix.
 */
const STOREFRONT_LOCALES = ['en', 'fr', 'es', 'pt', 'ar'] as const;
const STOREFRONT_DEFAULT_LOCALE = 'en';

export function localeStorefrontPath(path: string, locale?: string | null): string {
  const base = (locale ?? '').split('-')[0].toLowerCase();
  if (!base || base === STOREFRONT_DEFAULT_LOCALE) return path;
  if (!(STOREFRONT_LOCALES as readonly string[]).includes(base)) return path;
  return `/${base}${path}`;
}

/**
 * Ask the storefront to skip its catalog cache for this render.
 *
 * The storefront caches catalog reads for five minutes, which is right for
 * shoppers and wrong for a vendor checking an edit they just saved. The flag
 * grants no access — an unpublished product still 404s, because the public API
 * refuses it — it only changes read freshness. Never put it on a link handed to
 * a customer.
 */
export const PREVIEW_PARAM = 'preview';

export function withPreviewParam(url: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}${PREVIEW_PARAM}=1`;
}
