import { useEffect, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { fetchOrders } from '@/services/orders.service';
import { fetchProducts } from '@/services/products.service';
import type { TicketEntityType } from '@/types/tickets.types';

interface EntityOption {
  id: string;
  label: string;
  sublabel?: string;
}

interface EntityPickerProps {
  entityType: TicketEntityType;
  /** Currently selected entity id (controlled). */
  value: string;
  onChange: (entityId: string) => void;
  invalid?: boolean;
}

/** Entity types that support a searchable picker backed by an existing API. */
const SEARCHABLE: Record<string, true> = { order: true, product: true };

export function EntityPicker({ entityType, value, onChange, invalid }: EntityPickerProps) {
  // `booking`, `account`, `other` have no list API — fall back to a free-text id.
  if (!SEARCHABLE[entityType]) {
    return (
      <Input
        placeholder="Enter the related entity ID"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid}
      />
    );
  }

  return <SearchablePicker entityType={entityType} value={value} onChange={onChange} invalid={invalid} />;
}

function SearchablePicker({ entityType, value, onChange, invalid }: EntityPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<EntityOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);

  // Reset selection display when the entity type changes.
  useEffect(() => {
    setSelectedLabel(null);
    setResults([]);
    setQuery('');
  }, [entityType]);

  // Debounced search against the relevant list API.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const options = await searchEntities(entityType, query);
        setResults(options);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open, entityType]);

  function select(option: EntityOption) {
    onChange(option.id);
    setSelectedLabel(option.label);
    setOpen(false);
  }

  const triggerLabel = selectedLabel ?? (value ? value : `Select ${entityType}…`);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid}
          className={cn('w-full justify-between font-normal', !selectedLabel && !value && 'text-muted-foreground')}
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${entityType}s…`}
            className="flex h-10 w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-64 overflow-y-auto py-1">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching…
            </div>
          ) : results.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No {entityType}s found.
            </div>
          ) : (
            results.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => select(option)}
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
              >
                <Check
                  className={cn(
                    'mt-0.5 h-4 w-4 shrink-0',
                    value === option.id ? 'opacity-100' : 'opacity-0',
                  )}
                />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{option.label}</span>
                  {option.sublabel && (
                    <span className="block truncate text-xs text-muted-foreground">{option.sublabel}</span>
                  )}
                </span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

async function searchEntities(entityType: TicketEntityType, query: string): Promise<EntityOption[]> {
  if (entityType === 'order') {
    const { data } = await fetchOrders({ q: query || undefined, limit: 20 });
    return data.map((o) => ({
      id: o.id,
      label: o.orderNumber,
      sublabel: o.customer?.name,
    }));
  }
  if (entityType === 'product') {
    const { data } = await fetchProducts({ q: query || undefined, limit: 20 });
    return data.map((p) => ({ id: p.id, label: p.title, sublabel: p.category }));
  }
  return [];
}
