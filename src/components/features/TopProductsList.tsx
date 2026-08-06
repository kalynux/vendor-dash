import { Package } from 'lucide-react';
import type { TopProduct } from '@/types';
import { useTranslation, useFormatters } from '@/i18n';

interface TopProductsListProps {
  products: TopProduct[];
  isLoading?: boolean;
}

export function TopProductsList({ products, isLoading }: TopProductsListProps) {
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
    <div className="space-y-1">
      {products.map((product, index) => (
        <div
          key={product.variantId}
          className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-6 h-6 flex-shrink-0 rounded-full bg-primary/10 text-primary text-sm font-medium flex items-center justify-center">
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{product.productTitle}</p>
              <p className="text-xs text-muted-foreground truncate">
                {product.variantTitle} · {t('overview.topProducts.sold', { count: product.quantity })}
              </p>
            </div>
          </div>
          <span className="font-semibold text-sm flex-shrink-0 ml-3">
            {formatCurrency(product.revenue)}
          </span>
        </div>
      ))}
    </div>
  );
}
