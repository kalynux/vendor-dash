import { useRef } from 'react';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { LicenseTierRow } from '@/types/product.types';

interface PricingVariantListProps {
  tiers: LicenseTierRow[];
  onTierChange: (tempId: string, field: keyof LicenseTierRow, value: unknown) => void;
  onAddTier: () => void;
  onRemoveTier: (tempId: string) => void;
  /** Keyed by `${tempId}.${field}` */
  errors?: Record<string, string>;
  isSaving?: boolean;
}

export function PricingVariantList({
  tiers,
  onTierChange,
  onAddTier,
  onRemoveTier,
  errors = {},
  isSaving = false,
}: PricingVariantListProps) {
  return (
    <div className="space-y-3">
      <div className="relative">
        {isSaving && (
          <div className="absolute inset-0 bg-background/60 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-lg">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving tiers…
            </div>
          </div>
        )}

        {tiers.length > 0 ? (
          <div className="rounded-lg border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">
                    Tier Name *
                  </th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">
                    SKU *
                  </th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">
                    Price *
                  </th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">
                    Compare At
                  </th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {tiers.map((tier, idx) => (
                  <TierRow
                    key={tier.tempId}
                    tier={tier}
                    isEven={idx % 2 === 0}
                    errors={errors}
                    onTierChange={onTierChange}
                    onRemoveTier={onRemoveTier}
                    canRemove={tiers.length > 1}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-2">
            No pricing tiers added. Add at least one tier (e.g. "Personal License") before publishing.
          </p>
        )}
      </div>

      <Button type="button" variant="outline" size="sm" onClick={onAddTier} className="gap-2">
        <Plus className="w-3.5 h-3.5" />
        Add Tier
      </Button>

      {tiers.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {tiers.length} tier{tiers.length !== 1 ? 's' : ''} · All prices must be &gt; 0 before publishing
        </p>
      )}
    </div>
  );
}

// ─── Individual row — uncontrolled inputs to avoid per-keystroke rerenders ────

interface TierRowProps {
  tier: LicenseTierRow;
  isEven: boolean;
  errors: Record<string, string>;
  onTierChange: (tempId: string, field: keyof LicenseTierRow, value: unknown) => void;
  onRemoveTier: (tempId: string) => void;
  canRemove: boolean;
}

function TierRow({ tier, isEven, errors, onTierChange, onRemoveTier, canRemove }: TierRowProps) {
  const nameRef = useRef<HTMLInputElement>(null);
  const skuRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);
  const compareAtRef = useRef<HTMLInputElement>(null);

  function onBlurNumber(
    ref: React.RefObject<HTMLInputElement | null>,
    field: keyof LicenseTierRow,
  ) {
    const raw = ref.current?.value ?? '';
    const num = parseFloat(raw);
    onTierChange(tier.tempId, field, isNaN(num) ? undefined : num);
  }

  const nameError = errors[`${tier.tempId}.name`];
  const skuError = errors[`${tier.tempId}.sku`];
  const priceError = errors[`${tier.tempId}.price`];

  return (
    <tr className={cn('border-b border-border last:border-0', isEven ? 'bg-background' : 'bg-muted/20')}>
      {/* Tier Name */}
      <td className="px-3 py-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Input
              ref={nameRef}
              defaultValue={tier.name}
              placeholder="e.g. Personal License"
              className={cn('h-8 w-40', nameError && 'border-destructive')}
              onBlur={() => onTierChange(tier.tempId, 'name', nameRef.current?.value ?? '')}
            />
            {tier.serverId && (
              <Badge variant="outline" className="text-xs text-green-600 border-green-200 shrink-0">
                Saved
              </Badge>
            )}
          </div>
          {nameError && <p className="text-xs text-destructive">{nameError}</p>}
        </div>
      </td>

      {/* SKU */}
      <td className="px-3 py-2">
        <div className="space-y-1">
          <Input
            ref={skuRef}
            defaultValue={tier.sku}
            placeholder="SKU-LIC-001"
            className={cn('h-8 w-28', skuError && 'border-destructive')}
            onBlur={() => onTierChange(tier.tempId, 'sku', skuRef.current?.value ?? '')}
          />
          {skuError && <p className="text-xs text-destructive">{skuError}</p>}
        </div>
      </td>

      {/* Price */}
      <td className="px-3 py-2">
        <div className="space-y-1">
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
            <Input
              ref={priceRef}
              type="number"
              min={0}
              step={0.01}
              defaultValue={tier.price || ''}
              placeholder="0.00"
              className={cn('h-8 w-24 pl-5', priceError && 'border-destructive')}
              onBlur={() => onBlurNumber(priceRef, 'price')}
            />
          </div>
          {priceError && <p className="text-xs text-destructive">{priceError}</p>}
        </div>
      </td>

      {/* Compare At Price */}
      <td className="px-3 py-2">
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
          <Input
            ref={compareAtRef}
            type="number"
            min={0}
            step={0.01}
            defaultValue={tier.compareAtPrice ?? ''}
            placeholder="—"
            className="h-8 w-24 pl-5"
            onBlur={() => onBlurNumber(compareAtRef, 'compareAtPrice')}
          />
        </div>
      </td>

      {/* Remove */}
      <td className="px-3 py-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onRemoveTier(tier.tempId)}
          disabled={!canRemove}
          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </td>
    </tr>
  );
}
