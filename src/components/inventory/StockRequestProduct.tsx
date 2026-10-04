import { Package } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { StockRequestDto } from '@/types/stock-requests.types';
import { useTranslation } from '@/i18n';
import { shortVariantId } from './stockRequest.constants';

/**
 * What a stock request changes: thumbnail, product title, variant name, SKU.
 *
 * Everything comes off the DTO's `product` block — resolved live by the server,
 * so a renamed product shows its current title even on a closed request. Any of
 * it can be `null` (deleted product or variant), so each piece degrades on its
 * own and the row still names the variant by its shortened id.
 */
export function StockRequestProduct({
  request,
  size = 'sm',
  className,
}: {
  request: StockRequestDto;
  size?: 'sm' | 'lg';
  className?: string;
}) {
  const { t } = useTranslation();
  const product = request.product;
  // `url` is null for anything not public — never rebuild it from `key`.
  const imageUrl = product?.image?.url ?? null;
  const title = product?.title ?? t('inventory.requests.unknownSku', { id: shortVariantId(request.variantId) });
  const detail = [product?.variantTitle, product?.sku].filter(Boolean).join(' · ');

  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)}>
      <div
        className={cn(
          'flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted',
          size === 'lg' ? 'h-14 w-14' : 'h-10 w-10',
        )}
      >
        {imageUrl ? (
          <img src={imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <Package className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0">
        <p className={cn('truncate font-medium', size === 'lg' ? 'text-base' : 'text-sm')}>{title}</p>
        {detail && <p className="truncate font-mono text-xs text-muted-foreground">{detail}</p>}
      </div>
    </div>
  );
}
