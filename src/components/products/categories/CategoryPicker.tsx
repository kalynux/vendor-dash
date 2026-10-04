import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/i18n';
import {
  MAX_CATEGORIES,
  cleanCategoryName,
  isPickedCategory,
  searchCategories,
} from '@/services/categories.service';
import type { CategoryEntry, CategorySuggestion } from '@/types/category.types';

interface CategoryPickerProps {
  id?: string;
  value: CategoryEntry[];
  onChange: (next: CategoryEntry[]) => void;
  disabled?: boolean;
  invalid?: boolean;
  /** Id of the element describing the field (its error line), for screen readers. */
  describedBy?: string;
}

type Option =
  | { kind: 'pick'; category: CategorySuggestion }
  | { kind: 'similar'; category: CategorySuggestion }
  | { kind: 'new'; name: string };

const SEARCH_DELAY_MS = 250;

/**
 * Picks the product's 1–5 categories, shown as chips. The first chip is the
 * main category; tapping another moves it to the front.
 *
 * Suggestions come from `GET /vendor/categories?q=`. Which rows are the "same"
 * category, which are typos and which are new is entirely the server's call —
 * this component only shows what it was told, and lets the vendor type a name
 * the list does not have yet.
 */
export function CategoryPicker({
  id,
  value,
  onChange,
  disabled,
  invalid,
  describedBy,
}: CategoryPickerProps) {
  const { t } = useTranslation();
  const listId = useId();
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<CategorySuggestion[]>([]);
  // The query `rows` answers. While it differs from what is typed, a search is
  // on its way — `loading` is derived from that rather than tracked separately.
  const [answered, setAnswered] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(-1);
  // Replies can land out of order; only the newest one is shown.
  const requestSeq = useRef(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const query = cleanCategoryName(text);
  const full = value.length >= MAX_CATEGORIES;
  const loading = answered !== query;

  useEffect(() => {
    if (!open || full) return;
    const seq = ++requestSeq.current;
    const timer = setTimeout(
      () => {
        // Empty box: browse the whole list, alphabetically.
        searchCategories(query, query ? 20 : 50)
          .then((result) => {
            if (seq !== requestSeq.current) return;
            setRows(result);
            setFailed(false);
            setAnswered(query);
          })
          .catch(() => {
            if (seq !== requestSeq.current) return;
            setRows([]);
            setFailed(true);
            setAnswered(query);
          });
      },
      query ? SEARCH_DELAY_MS : 0,
    );
    return () => clearTimeout(timer);
  }, [query, open, full]);

  const options = useMemo<Option[]>(() => {
    const pickedIds = new Set(value.filter(isPickedCategory).map((e) => e.id));
    const fresh = rows.filter((r) => !pickedIds.has(r.id));
    const list: Option[] = [
      ...fresh.filter((r) => r.match !== 'similar').map((category) => ({ kind: 'pick' as const, category })),
      ...fresh.filter((r) => r.match === 'similar').map((category) => ({ kind: 'similar' as const, category })),
    ];
    // An `exact` row means the server already reads the typed text as that
    // category, so offering it as "new" would only end up as the same one.
    if (query && !rows.some((r) => r.match === 'exact')) list.push({ kind: 'new', name: query });
    return list;
  }, [rows, value, query]);

  // Typing resets the highlight; this only guards a list that shrank under it.
  const highlighted = active < options.length ? active : -1;

  function add(entry: CategoryEntry) {
    if (full) return;
    const duplicate = value.some((e) =>
      isPickedCategory(entry)
        ? isPickedCategory(e) && e.id === entry.id
        : !isPickedCategory(e) && e.name === entry.name,
    );
    if (!duplicate) onChange([...value, entry]);
    setText('');
    setActive(-1);
  }

  function choose(option: Option) {
    if (option.kind === 'new') add({ name: option.name });
    else add({ id: option.category.id, name: option.category.name });
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function makeMain(index: number) {
    if (index === 0) return;
    const next = [...value];
    const [moved] = next.splice(index, 1);
    onChange([moved, ...next]);
  }

  /**
   * On a touch screen the keyboard takes the bottom half, which is exactly
   * where the suggestions open. Bring the box up to the top so they show.
   */
  function onFocus() {
    setOpen(true);
    if (window.matchMedia('(pointer: coarse)').matches) {
      setTimeout(() => boxRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 300);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' && options.length > 0) {
      e.preventDefault();
      setOpen(true);
      setActive((highlighted + 1) % options.length);
    } else if (e.key === 'ArrowUp' && options.length > 0) {
      e.preventDefault();
      setActive(highlighted <= 0 ? options.length - 1 : highlighted - 1);
    } else if (e.key === 'Enter') {
      // Always swallowed: Enter here must never submit the whole product form.
      e.preventDefault();
      if (highlighted >= 0 && options[highlighted]) {
        choose(options[highlighted]);
      } else if (query) {
        // Rows from an older query say nothing about this one; the typed name
        // is then sent as is, and the server still folds spelling variants.
        const exact = loading ? undefined : rows.find((r) => r.match === 'exact');
        if (exact) add({ id: exact.id, name: exact.name });
        else add({ name: query });
      }
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      setOpen(false);
    }
  }

  const showList = open && !full && !disabled;
  const firstSimilar = options.findIndex((o) => o.kind === 'similar');

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {value.map((entry, i) => (
            <li
              key={isPickedCategory(entry) ? `id:${entry.id}` : `name:${entry.name}`}
              className={cn(
                'inline-flex max-w-full items-center gap-1 rounded-full border py-1 pl-3 pr-1.5 text-sm',
                i === 0 ? 'border-foreground/30 bg-secondary' : 'border-border bg-background',
              )}
            >
              {i === 0 ? (
                <span className="min-w-0 truncate">
                  {entry.name}
                  <span className="ml-1.5 text-xs text-muted-foreground">{t('products.categories.main')}</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => makeMain(i)}
                  disabled={disabled}
                  aria-label={t('products.categories.makeMain', { name: entry.name })}
                  className="tap-target min-w-0 truncate text-left"
                >
                  {entry.name}
                </button>
              )}
              <button
                type="button"
                onClick={() => remove(i)}
                disabled={disabled}
                aria-label={t('products.categories.remove', { name: entry.name })}
                className="tap-target shrink-0 rounded-sm text-muted-foreground transition-colors hover:text-destructive"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {full ? (
        <p className="text-sm text-muted-foreground">{t('products.categories.limitReached')}</p>
      ) : (
        <div ref={boxRef} className="relative scroll-mt-20">
          <Input
            id={id}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setActive(-1);
              setOpen(true);
            }}
            onFocus={onFocus}
            onBlur={() => setOpen(false)}
            onKeyDown={onKeyDown}
            placeholder={t('products.categories.placeholder')}
            disabled={disabled}
            autoComplete="off"
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={highlighted >= 0 ? `${listId}-${highlighted}` : undefined}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
          />

          {showList && (
            <div className="absolute inset-x-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
              <ul id={listId} role="listbox" aria-label={t('products.categories.label')}>
                {options.map((option, i) => (
                  <li
                    key={option.kind === 'new' ? 'new' : `${option.kind}:${option.category.id}`}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === highlighted}
                    // mousedown, not click: the input's blur would close the
                    // list before a click could land.
                    onMouseDown={(e) => {
                      e.preventDefault();
                      choose(option);
                    }}
                    onMouseEnter={() => setActive(i)}
                    className={cn(
                      'flex min-h-10 cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm',
                      i === highlighted && 'bg-accent text-accent-foreground',
                      i === firstSimilar && i > 0 && 'mt-1 border-t pt-2',
                    )}
                  >
                    {option.kind === 'pick' && <span className="truncate">{option.category.name}</span>}
                    {option.kind === 'similar' && (
                      <span className="truncate text-muted-foreground">
                        {t('products.categories.didYouMean', { name: option.category.name })}
                      </span>
                    )}
                    {option.kind === 'new' && (
                      <>
                        <Plus className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{t('products.categories.addNew', { name: option.name })}</span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
              {options.length === 0 && (
                <p className="px-2 py-1.5 text-sm text-muted-foreground">
                  {loading
                    ? t('products.categories.searching')
                    : failed
                      ? t('products.categories.loadFailed')
                      : t('products.categories.noMatch')}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {value.length > 1 && <p className="text-sm text-muted-foreground">{t('products.categories.hint')}</p>}
    </div>
  );
}
