import { api } from './api';
import { ApiError } from '@/types/api';
import type {
  CategoryConflict,
  CategoryConflictChoice,
  CategoryEntry,
  CategoryListResponse,
  CategorySuggestion,
  CategoryWrite,
  ProductCategory,
} from '@/types/category.types';

/**
 * Product categories — api-doc/vendor/categories.md.
 *
 * ⚠ All matching happens on the server: spelling variants, plurals, typos. This
 * file never compares or de-duplicates names beyond trimming what was typed —
 * a client-side guess would disagree with the server's and hide a category the
 * vendor meant to pick.
 */

/** A product holds 1–5 categories. */
export const MAX_CATEGORIES = 5;

/**
 * `GET /vendor/categories`. With `q`, the autocomplete — each row carries a
 * `match`. Without it, the whole list alphabetically, for browsing.
 */
export async function searchCategories(
  q: string,
  limit = 20,
): Promise<CategorySuggestion[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  const query = q.trim();
  if (query) params.set('q', query.slice(0, 200));
  const res = await api.get<CategoryListResponse>(`/vendor/categories?${params}`);
  return res.data.categories;
}

/**
 * What the vendor typed, as the server will read it: trimmed, inner spaces
 * collapsed. Doing it here keeps a chip's label identical to the `name` the
 * server echoes back in a conflict.
 */
export function cleanCategoryName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

export function isPickedCategory(entry: CategoryEntry): entry is { id: string; name: string } {
  return 'id' in entry;
}

/** The form's chips → the `categories` body of every product write. */
export function toCategoryWire(entries: CategoryEntry[]): CategoryWrite[] {
  return entries.map((entry) => {
    if (isPickedCategory(entry)) return { id: entry.id };
    return entry.confirmNew ? { name: entry.name, confirmNew: true } : { name: entry.name };
  });
}

/** A product's stored categories → picker chips. `[]` (not yet migrated) stays empty. */
export function fromProductCategories(categories: ProductCategory[] | undefined): CategoryEntry[] {
  return (categories ?? []).map(({ id, name }) => ({ id, name }));
}

/**
 * A product's categories as one line of text, main one first. Empty when the
 * product has none — callers show "No category" there, which is not an error.
 */
export function categoryNames(categories: ProductCategory[] | undefined): string {
  return (categories ?? []).map((c) => c.name).join(', ');
}

/** Whether two chip lists would send the same body. Order matters — `[0]` is the primary. */
export function sameCategoryWire(a: CategoryEntry[], b: CategoryEntry[]): boolean {
  return JSON.stringify(toCategoryWire(a)) === JSON.stringify(toCategoryWire(b));
}

/** The "Did you mean …?" list from a `422 CATEGORY_SIMILAR_EXISTS`, or `null` for any other error. */
export function readCategoryConflicts(err: unknown): CategoryConflict[] | null {
  if (!(err instanceof ApiError) || err.code !== 'CATEGORY_SIMILAR_EXISTS') return null;
  const raw = err.detailsObject?.conflicts;
  if (!Array.isArray(raw)) return null;
  const conflicts = raw.flatMap((c): CategoryConflict[] => {
    if (!c || typeof c !== 'object' || typeof (c as CategoryConflict).name !== 'string') return [];
    const suggestions = Array.isArray((c as CategoryConflict).suggestions)
      ? (c as CategoryConflict).suggestions
      : [];
    return [{ name: (c as CategoryConflict).name, suggestions }];
  });
  return conflicts.length > 0 ? conflicts : null;
}

/**
 * Rewrites the chips with the vendor's answers: a picked suggestion becomes
 * `{ id }`, a kept name is resent with `confirmNew: true`.
 *
 * Each conflict is tied back to the chip it came from by the name we sent —
 * that is our own entry, not a guess about which category it means. A
 * suggestion already on the list is dropped rather than shown twice.
 */
export function applyConflictChoices(
  entries: CategoryEntry[],
  conflicts: CategoryConflict[],
  choices: CategoryConflictChoice[],
): CategoryEntry[] {
  const next: CategoryEntry[] = [];
  for (const entry of entries) {
    const index = isPickedCategory(entry) ? -1 : conflicts.findIndex((c) => c.name === entry.name);
    const choice = index >= 0 ? choices[index] : undefined;
    let resolved: CategoryEntry = entry;
    if (choice?.kind === 'suggestion') {
      resolved = { id: choice.category.id, name: choice.category.name };
    } else if (choice?.kind === 'keep') {
      resolved = { name: entry.name, confirmNew: true };
    }
    if (
      isPickedCategory(resolved) &&
      next.some((e) => isPickedCategory(e) && e.id === resolved.id)
    ) {
      continue;
    }
    next.push(resolved);
  }
  return next;
}
