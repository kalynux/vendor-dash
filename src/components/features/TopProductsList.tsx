import { Package } from 'lucide-react';
import type { TopProduct } from '@/types';
import { cn } from '@/lib/utils';
import { useTranslation, useFormatters } from '@/i18n';

interface TopProductsListProps {
  products: TopProduct[];
  isLoading?: boolean;
  /**
   * Sitting directly on the page rather than in a card: on a phone the rows
   * lose their side inset and are split by hairlines instead.
   */
  flush?: boolean;
}

export function TopProductsList({ products, isLoading, flush }: TopProductsListProps) {
  const { t } = useTranslation();
  const fmt = useFormatters();

  // Top-product revenue carries no per-currency field; platform default (XAF).
  const formatCurrency = (value: number) => fmt.currency(value);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
        <Package className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-sm">{t('overview.topProducts.empty')}</p>
      </div>
    );
  }

  return (
    <div className={flush ? 'max-md:divide-y max-md:divide-border md:space-y-1' : 'space-y-1'}>
      {products.map((product, index) => (
        <div
          key={product.variantId}
          className={cn(
            'flex items-start justify-between gap-3 rounded-lg py-3 transition-colors',
            // Flush rows line up with the page's own gutter on a phone; the
            // hover wash needs its inset back where there is a pointer.
            flush ? 'md:px-3 md:hover:bg-muted' : 'px-3 hover:bg-muted',
          )}
        >
          <div className="flex min-w-0 items-start gap-3">
            <span className="w-4 shrink-0 text-sm font-medium tabular-nums text-muted-foreground">
              {index + 1}
            </span>
            {/* Names wrap to two lines and the details wrap freely — cutting
                them off hid the very thing the list is for. */}
            <div className="min-w-0">
              <p className="line-clamp-2 text-sm font-medium">{product.productTitle}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {[
                  product.sku,
                  t('overview.topProducts.sold', { count: product.quantity }),
                  t('overview.topProducts.orders', { count: product.orderCount }),
                ].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
          <span className="shrink-0 text-sm font-semibold tabular-nums">
            {formatCurrency(product.revenue)}
          </span>
        </div>
      ))}
    </div>
  );
}
