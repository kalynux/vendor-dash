import { useCallback, useRef, useState } from 'react';
import {
  applyConflictChoices,
  readCategoryConflicts,
  sameCategoryWire,
} from '@/services/categories.service';
import type {
  CategoryConflict,
  CategoryConflictChoice,
  CategoryEntry,
} from '@/types/category.types';
import { CategoryConflictDialog } from './CategoryConflictDialog';

export type CategorySaveResult<T> =
  | { ok: true; value: T; categories: CategoryEntry[] }
  /** The vendor closed the "Did you mean" dialog. Nothing was saved; the form is untouched. */
  | { ok: false };

/**
 * Wraps a product write so a `422 CATEGORY_SIMILAR_EXISTS` becomes a question
 * instead of an error.
 *
 * `run(categories, attempt)` calls `attempt` with the chips. If the server
 * answers "Did you mean …?", the dialog asks about every conflict at once, the
 * chips are rewritten with the answers (`{ id }` or `{ name, confirmNew }`) and
 * `attempt` runs again — that 422 means nothing was saved, so the same save is
 * simply re-submitted. `onResolved` hands the rewritten chips back so the form
 * shows what was actually sent.
 *
 * Any other error is re-thrown for the page's usual handling. Render `dialog`
 * once, anywhere in the page.
 */
export function useCategoryConflicts() {
  const [conflicts, setConflicts] = useState<CategoryConflict[] | null>(null);
  const settleRef = useRef<((choices: CategoryConflictChoice[] | null) => void) | null>(null);

  const ask = useCallback(
    (next: CategoryConflict[]) =>
      new Promise<CategoryConflictChoice[] | null>((resolve) => {
        settleRef.current = resolve;
        setConflicts(next);
      }),
    [],
  );

  const settle = useCallback((choices: CategoryConflictChoice[] | null) => {
    settleRef.current?.(choices);
    settleRef.current = null;
    setConflicts(null);
  }, []);

  const run = useCallback(
    async <T,>(
      categories: CategoryEntry[],
      attempt: (categories: CategoryEntry[]) => Promise<T>,
      onResolved?: (categories: CategoryEntry[]) => void,
    ): Promise<CategorySaveResult<T>> => {
      let current = categories;
      for (;;) {
        try {
          return { ok: true, value: await attempt(current), categories: current };
        } catch (err) {
          const found = readCategoryConflicts(err);
          if (!found) throw err;
          const choices = await ask(found);
          if (!choices) return { ok: false };
          const next = applyConflictChoices(current, found, choices);
          // A conflict we could not tie to any chip would ask the same
          // question forever — surface the error instead.
          if (sameCategoryWire(next, current)) throw err;
          current = next;
          onResolved?.(current);
        }
      }
    },
    [ask],
  );

  const dialog = (
    <CategoryConflictDialog
      conflicts={conflicts}
      onConfirm={settle}
      onCancel={() => settle(null)}
    />
  );

  return { run, dialog };
}
