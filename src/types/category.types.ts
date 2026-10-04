/**
 * Product categories — one marketplace-wide list, 1–5 per product (2026-10-04).
 * See api-doc/vendor/categories.md and api-doc/FRONTEND-CHANGELOG-product-categories.md.
 */

/** A category as every product payload carries it. Store and link by `id`, never by name. */
export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
}

/**
 * How an autocomplete row matched what was typed — decided by the server.
 * `similar` is a probable typo and is shown as "Did you mean …?".
 */
export type CategoryMatch = 'exact' | 'prefix' | 'contains' | 'similar';

export interface CategorySuggestion extends ProductCategory {
  /** Present only when the request carried `q`. */
  match?: CategoryMatch;
}

export interface CategoryListResponse {
  success: boolean;
  data: {
    categories: CategorySuggestion[];
    /** Only on the browse call (no `q`). */
    total?: number;
  };
}

/** One entry of `categories` on a product write. */
export type CategoryWrite = { id: string } | { name: string; confirmNew?: boolean };

/**
 * One chip in the editor's picker.
 *
 * A picked category keeps its `name` for display only — `toCategoryWire` drops
 * it, because the server takes `{ id }` alone. A typed one is a name the server
 * has not resolved yet; it decides whether that name is an existing category, a
 * typo ("Did you mean …?") or a new one.
 */
export type CategoryEntry =
  | { id: string; name: string }
  | { name: string; confirmNew?: boolean };

/** One problem name in a `422 CATEGORY_SIMILAR_EXISTS`. */
export interface CategoryConflict {
  name: string;
  suggestions: ProductCategory[];
}

/** What the vendor decided for one conflict: a suggestion, or their own name. */
export type CategoryConflictChoice = { kind: 'suggestion'; category: ProductCategory } | { kind: 'keep' };
