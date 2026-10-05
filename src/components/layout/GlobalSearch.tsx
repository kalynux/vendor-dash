import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Loader2, Package, Search, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { CustomerAvatar } from '@/components/customers/CustomerAvatar';
import { QUICK_ACTIONS, type QuickAction } from '@/config/quickActions';
import { fetchOrders } from '@/services/orders.service';
import { fetchProducts } from '@/services/products.service';
import { fetchCustomers } from '@/services/customers.service';
import { useFormatters, useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import type { Order } from '@/types';
import type { ProductListItem } from '@/types/product.types';
import type { CustomerListItem } from '@/types/customers.types';

/**
 * The top bar's search (desktop — phones search inside each list instead).
 *
 * It was a mock-up until 2026-10-05: whatever was typed, it showed the same two
 * made-up rows, and ⌘K / Esc / the arrow keys it advertised did nothing. Now it
 * asks the three list endpoints the pages themselves use, five rows each:
 *
 * - orders by **order number** (the only thing `q` matches there),
 * - products by name,
 * - customers by name or e-mail.
 *
 * One failing source does not blank the others — each is settled separately.
 */

const MIN_QUERY = 2;
const PER_GROUP = 5;
const DEBOUNCE_MS = 250;
const RECENT_KEY = 'wi-vendor.global-search.recent';
const RECENT_MAX = 5;

interface Results {
  orders: Order[];
  products: ProductListItem[];
  customers: CustomerListItem[];
}

const EMPTY: Results = { orders: [], products: [], customers: [] };

/** One row the keyboard can land on. */
interface Entry {
  key: string;
  run: () => void;
  render: (active: boolean) => ReactNode;
}

function readRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function rememberQuery(query: string) {
  try {
    const next = [query, ...readRecent().filter((q) => q.toLowerCase() !== query.toLowerCase())];
    localStorage.setItem(RECENT_KEY, JSON.stringify(next.slice(0, RECENT_MAX)));
  } catch {
    // Private window or blocked storage — recent searches are a convenience.
  }
}

/** Where a product's Edit action goes, mirroring the Products page. */
function productPath(product: ProductListItem): string {
  return product.mode === 'simple'
    ? `/dashboard/product-edit/${product.id}/simple`
    : `/dashboard/product-edit/${product.id}`;
}

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Results>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const requestId = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);

  const trimmed = query.trim();
  const searching = trimmed.length >= MIN_QUERY;

  // Fresh each time it opens.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setResults(EMPTY);
    setFailed(false);
    setActive(0);
    setRecent(readRecent());
  }, [open]);

  useEffect(() => {
    if (!searching) {
      setResults(EMPTY);
      setLoading(false);
      setFailed(false);
      return;
    }
    setLoading(true);
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      const [orders, products, customers] = await Promise.allSettled([
        fetchOrders({ q: trimmed, limit: PER_GROUP }),
        fetchProducts({ q: trimmed, limit: PER_GROUP }),
        fetchCustomers({ search: trimmed, limit: PER_GROUP }),
      ]);
      // A slower, older request must not overwrite a newer one.
      if (id !== requestId.current) return;
      setResults({
        orders: orders.status === 'fulfilled' ? orders.value.data : [],
        products: products.status === 'fulfilled' ? products.value.data : [],
        customers: customers.status === 'fulfilled' ? customers.value.data : [],
      });
      setFailed([orders, products, customers].every((r) => r.status === 'rejected'));
      setActive(0);
      setLoading(false);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [trimmed, searching]);

  const go = (path: string) => {
    if (searching) rememberQuery(trimmed);
    onOpenChange(false);
    navigate(path);
  };

  const runQuickAction = (action: QuickAction) => {
    onOpenChange(false);
    navigate(`/dashboard/${action.route}`, action.intent ? { state: { create: true } } : undefined);
  };

  // ── The rows, in display order, as one list the arrow keys walk ──────────
  const groups = useMemo(() => {
    const rowClass = (isActive: boolean) =>
      cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
        isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60',
      );

    if (!searching) {
      const recentEntries: Entry[] = recent.map((q) => ({
        key: `recent-${q}`,
        run: () => setQuery(q),
        render: (isActive) => (
          <span className={rowClass(isActive)}>
            <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{q}</span>
          </span>
        ),
      }));
      const actionEntries: Entry[] = QUICK_ACTIONS.map((action) => ({
        key: `action-${action.id}`,
        run: () => runQuickAction(action),
        render: (isActive) => (
          <span className={rowClass(isActive)}>
            <action.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{t(action.labelKey)}</span>
          </span>
        ),
      }));
      return [
        { key: 'recent', title: t('nav.header.recentSearches'), entries: recentEntries },
        { key: 'actions', title: t('nav.quickActions.title'), entries: actionEntries },
      ];
    }

    const orderEntries: Entry[] = results.orders.map((order) => ({
      key: `order-${order.id}`,
      run: () => go(`/dashboard/orders?view=${encodeURIComponent(order.id)}`),
      render: (isActive) => (
        <span className={rowClass(isActive)}>
          <ShoppingCart className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{order.orderNumber}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {order.customer.name} · {fmt.currency(order.total, order.currency)}
            </span>
          </span>
          <OrderStatusBadge status={order.status} />
        </span>
      ),
    }));
    const productEntries: Entry[] = results.products.map((product) => ({
      key: `product-${product.id}`,
      run: () => {
        if (product.vectorisationStatus === 'pending') {
          toast.error(t('products.ai.indexingToast'));
          return;
        }
        go(productPath(product));
      },
      render: (isActive) => (
        <span className={rowClass(isActive)}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
            {product.firstFileUrl ? (
              <img src={product.firstFileUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <Package className="h-4 w-4 text-muted-foreground" />
            )}
          </span>
          <span className="min-w-0 flex-1 truncate font-medium">{product.title}</span>
        </span>
      ),
    }));
    const customerEntries: Entry[] = results.customers.map((customer) => ({
      key: `customer-${customer.customerId}`,
      run: () => go(`/dashboard/customers?view=${encodeURIComponent(customer.customerId)}`),
      render: (isActive) => (
        <span className={rowClass(isActive)}>
          <CustomerAvatar name={customer.displayName} avatar={customer.avatar ?? undefined} className="h-8 w-8 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{customer.displayName}</span>
            {customer.email && (
              <span className="block truncate text-xs text-muted-foreground">{customer.email}</span>
            )}
          </span>
        </span>
      ),
    }));

    return [
      { key: 'orders', title: t('nav.items.orders'), entries: orderEntries },
      { key: 'products', title: t('nav.items.products'), entries: productEntries },
      { key: 'customers', title: t('nav.items.customers'), entries: customerEntries },
    ];
    // `go` / `runQuickAction` close over navigate + the query, both covered here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searching, results, recent, trimmed, t, fmt]);

  const flat = groups.flatMap((g) => g.entries);
  const hasResults = flat.length > 0;

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!hasResults) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % flat.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i - 1 + flat.length) % flat.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      flat[Math.min(active, flat.length - 1)]?.run();
    }
  };

  let index = -1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-[12vh] flex max-h-[76vh] translate-y-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
        onKeyDown={onKeyDown}
      >
        <DialogTitle className="sr-only">{t('nav.header.search')}</DialogTitle>
        <DialogDescription className="sr-only">{t('nav.header.searchPlaceholder')}</DialogDescription>

        <div className="flex items-center gap-3 border-b px-4">
          {loading ? (
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          )}
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('nav.header.searchPlaceholder')}
            aria-label={t('nav.header.search')}
            className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none focus-visible:outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden h-6 select-none items-center rounded border bg-muted px-1.5 font-mono text-[11px] font-medium text-muted-foreground sm:inline-flex">
            Esc
          </kbd>
        </div>

        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-2">
          {searching && !loading && !hasResults && (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              {failed
                ? t('nav.header.searchFailed')
                : t('nav.header.noResults', { query: trimmed })}
            </p>
          )}

          {groups.map((group) =>
            group.entries.length === 0 ? null : (
              <div key={group.key} className="py-1">
                <p className="px-3 pb-1 pt-2 text-xs font-medium text-muted-foreground">{group.title}</p>
                {group.entries.map((entry) => {
                  index += 1;
                  const rowIndex = index;
                  const isActive = rowIndex === active;
                  return (
                    <button
                      key={entry.key}
                      type="button"
                      data-active={isActive}
                      onMouseMove={() => setActive(rowIndex)}
                      onClick={entry.run}
                      className="block w-full rounded-lg focus-visible:outline-none"
                    >
                      {entry.render(isActive)}
                    </button>
                  );
                })}
              </div>
            ),
          )}
        </div>

        <div className="flex items-center gap-3 border-t bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="rounded border bg-background px-1.5 py-0.5">↑↓</kbd>
            {t('nav.header.toNavigate')}
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border bg-background px-1.5 py-0.5">↵</kbd>
            {t('nav.header.toSelect')}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
