import { Handshake } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ResponsiveModal } from '@/components/services/ResponsiveModal';
import { VariantThumb } from '@/components/products/VariantThumb';
import { minCeilingFor, variantLabel } from '@/components/products/bargain';
import { useFormatters, useTranslation, type TranslationKey } from '@/i18n';
import { cn } from '@/lib/utils';
import type { ApiFileDetail, ApiVariant } from '@/types/product.types';

interface BargainCeilingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Active, non-service variants — the only ones that can carry a window. */
  variants: ApiVariant[];
  /** Ceiling inputs, keyed by variant id. Strings; `''` means "no window". */
  ceilings: Record<string, string>;
  onCeilingChange: (variantId: string, raw: string) => void;
  /** Per-row validation, keyed by variant id. */
  errors: Record<string, TranslationKey>;
  disabled?: boolean;
  /** Product-level images, to stand in for a variant with no picture. */
  productImages?: ApiFileDetail[];
}

/**
 * Setting a negotiation ceiling per variant.
 *
 * ── Why this became a sheet ──────────────────────────────────────────────────
 *
 * It used to be a panel that unfolded inline the moment the vectorisation switch
 * went on, below the switch, at the bottom of an already long review step. On a
 * phone that meant a forty-row price matrix pushing Publish off the screen — and
 * worse, it was easy to miss entirely: the switch is near the top, the rows
 * appeared below the fold, and nothing said they were there.
 *
 * A sheet inverts both problems. Flipping the switch *presents* the thing the
 * switch just made relevant, right where the thumb already is, and closing it
 * returns the review step to its normal length. Pricing stays optional — the
 * sheet is dismissed like any other, and nothing is lost by dismissing it.
 *
 * ⚠ **Nothing is saved from here.** The inputs are owned by the review step and
 * written by the same handler that persists the vectorisation flip, because the
 * ordering between the two is load-bearing (a bargain PATCH while vectorisation
 * is `pending` is a 409). So "Done" only closes the sheet; there is deliberately
 * no Save, and no way for this component to leave a half-written product behind.
 */
export function BargainCeilingsSheet({
  open,
  onOpenChange,
  variants,
  ceilings,
  onCeilingChange,
  errors,
  disabled,
  productImages,
}: BargainCeilingsSheetProps) {
  const { t } = useTranslation();
  const fmt = useFormatters();

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={t('products.bargain.title')}
      description={t('products.bargain.description')}
      desktopClassName="sm:max-w-xl"
      footer={
        <Button type="button" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
          {t('common.actions.done')}
        </Button>
      }
    >
      <div className="space-y-3">
        {variants.map((v) => {
          const rowError = errors[v.id];
          const minCeiling = minCeilingFor(v.price);
          return (
            <div
              key={v.id}
              className="grid grid-cols-1 gap-2 border-t border-border pt-3 first:border-t-0 first:pt-0 sm:grid-cols-[1fr_auto] sm:items-start"
            >
              {/* The variant's own first image, so a vendor pricing a forty-row
                  matrix recognises the row instead of decoding "Rouge / XL"
                  against a SKU. */}
              <div className="flex min-w-0 items-start gap-3">
                <VariantThumb files={v.files} fallback={productImages} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{variantLabel(v)}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{v.sku}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {fmt.currency(v.price)}
                    </span>
                    {/* A stored window shows regardless; `bargainable` only
                        decides whether it reads as live or dimmed. Never struck
                        through — this is a ceiling, not a "was" price. */}
                    {v.bargain && (
                      <Badge
                        variant="outline"
                        className={cn('text-[10px] font-normal', !v.bargainable && 'opacity-60')}
                      >
                        {t('products.bargain.badge', { max: fmt.currency(v.bargain.maxPrice) })}
                      </Badge>
                    )}
                    {v.bargain && !v.bargainable && (
                      <span className="text-[10px] text-muted-foreground">
                        {t('products.bargain.inertHint')}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="sm:w-[180px]">
                <Label htmlFor={`bargain-${v.id}`} className="sr-only">
                  {t('products.bargain.ceilingLabel')}
                </Label>
                <Input
                  id={`bargain-${v.id}`}
                  type="number"
                  min={minCeiling}
                  step="any"
                  inputMode="decimal"
                  value={ceilings[v.id] ?? ''}
                  placeholder={t('products.bargain.ceilingPlaceholder')}
                  disabled={disabled}
                  onChange={(e) => onCeilingChange(v.id, e.target.value)}
                  aria-invalid={!!rowError}
                  aria-describedby={`bargain-${v.id}-hint`}
                  className={cn('h-11 text-base sm:h-9 sm:text-sm', rowError && 'border-destructive')}
                />
                {/* The floor is spelled out per row rather than only in the
                    error, because the number depends on this variant's price and
                    guessing it is the whole difficulty. */}
                <p
                  id={`bargain-${v.id}-hint`}
                  className={cn(
                    'mt-1 text-xs',
                    rowError ? 'text-destructive' : 'text-muted-foreground',
                  )}
                >
                  {rowError
                    ? t(rowError)
                    : t('products.bargain.ceilingMin', { min: fmt.currency(minCeiling) })}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
        <Handshake className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        {t('products.bargain.clearHint')}
      </p>
    </ResponsiveModal>
  );
}
