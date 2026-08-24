import { useEffect, useState } from 'react';
import { Ruler } from 'lucide-react';

import { ShippingConfigSheet } from '@/components/products/ShippingConfigSheet';
import { fetchShippingConfig } from '@/services/shipping.service';
import type { ShippingConfig } from '@/types/shipping.types';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

interface ShippingConfigRowProps {
  /** `null`/`undefined` before a product exists — the row renders nothing. */
  productId?: string | null;
  /** Physical products only; the endpoint 400s on anything else. */
  isPhysical: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * The collapsed "Shipping configuration" summary, and the sheet behind it.
 *
 * 🔴 This is **not** the four dimension inputs the forms already have. Three
 * separate records carry parcel meaning and they share no endpoint:
 *
 *   - `shipping_config` (this one) — weight, dimensions, origin postcode and
 *     handling days, at PRODUCT level. `POST /products/:id/shipping`.
 *   - `product.delivery` — agency, free-delivery flag, pickup location.
 *   - the variant's own weight/l/w/h — the per-SKU parcel, which is what the
 *     quick-add form's dimension fields write.
 *
 * An agency warehousing a SKU reads the variant's dimensions first and falls
 * back to this record, so the two are complementary rather than duplicates.
 *
 * ⚠ It does **not** gate activation. A vendor asking "why is my product still
 * blocked from publishing after setting up shipping?" filled this in; the
 * activation gate wants `product.delivery`.
 *
 * Collapsed to one row on purpose: seven fields unfolded inline push the save
 * action off a phone screen. The sheet saves for itself — there is no ordering
 * constraint to respect, so making the caller own the inputs would buy nothing
 * and would let a vendor leave the page with a half-entered parcel.
 */
export function ShippingConfigRow({
  productId,
  isPhysical,
  disabled = false,
  className,
}: ShippingConfigRowProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  /**
   * Tagged with the product it belongs to rather than held bare, so switching
   * products is derived at render instead of cleared in an effect — no frame
   * where one product's summary sits under another product's title.
   */
  const [loaded, setLoaded] = useState<{
    productId: string;
    config: ShippingConfig | null;
  } | null>(null);

  useEffect(() => {
    if (!isPhysical || !productId) return;
    let cancelled = false;
    // A failure leaves the summary reading "not set", which is the same thing the
    // vendor sees when it genuinely is not — the row opens the sheet either way,
    // and the sheet surfaces its own load error.
    fetchShippingConfig(productId)
      .then((config) => {
        if (!cancelled) setLoaded({ productId, config });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ productId, config: null });
      });
    return () => {
      cancelled = true;
    };
  }, [isPhysical, productId]);

  if (!isPhysical || !productId) return null;

  const shipping = loaded?.productId === productId ? loaded.config : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className={cn(
          'flex w-full items-center gap-3 rounded-xl border border-border p-4 text-left',
          'transition-colors hover:bg-accent/40 disabled:pointer-events-none disabled:opacity-60',
          className,
        )}
      >
        <Ruler className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{t('products.shipping.title')}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {shipping
              ? t('products.shipping.summarySet', {
                  weight: shipping.weight,
                  length: shipping.length,
                  width: shipping.width,
                  height: shipping.height,
                })
              : t('products.shipping.summaryNone')}
          </p>
        </div>
        <span className="shrink-0 text-xs font-semibold text-primary">
          {shipping ? t('common.actions.edit') : t('products.shipping.summaryAction')}
        </span>
      </button>

      <ShippingConfigSheet
        open={open}
        onOpenChange={setOpen}
        productId={productId}
        disabled={disabled}
        onSaved={(config) => setLoaded({ productId, config })}
      />
    </>
  );
}
