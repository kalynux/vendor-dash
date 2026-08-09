import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createStockRequest } from '@/services/stockRequests.service';
import { fetchProductById, fetchProducts, fetchVariants } from '@/services/products.service';
import { ApiError } from '@/types/api';
import type { ApiVariant, ProductListItem } from '@/types/product.types';
import type { StockRequestDto } from '@/types/stock-requests.types';
import { useApiError, useTranslation } from '@/i18n';

/** Pre-filled context from wherever the vendor started the request. */
export interface RaiseStockRequestSeed {
  productId: string;
  variantId: string;
  sku?: string;
  currentQuantity?: number;
}

export interface RaiseStockRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seed?: RaiseStockRequestSeed | null;
  onRaised: (dto: StockRequestDto) => void;
  /** Open an already-pending request, for the 409 recovery path. */
  onOpenExisting?: (requestId: string) => void;
}

const MAX_NOTE = 500;

/**
 * Propose a new quantity on an agency-warehoused SKU.
 *
 * This exists alongside the intercepted stock writes (which also create
 * requests) for two reasons the interception cannot cover: the Alerts tab only
 * lists SKUs at or below their threshold, so a healthy warehoused SKU has no
 * adjust affordance at all; and only `POST /stock-requests` can attach a
 * **note**, which is what the agency actually reads when deciding.
 */
export function RaiseStockRequestDialog({
  open,
  onOpenChange,
  seed,
  onRaised,
  onOpenExisting,
}: RaiseStockRequestDialogProps) {
  const { t } = useTranslation();
  const apiError = useApiError();

  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productId, setProductId] = useState(seed?.productId ?? '');
  const [variants, setVariants] = useState<ApiVariant[]>([]);
  const [variantsLoading, setVariantsLoading] = useState(false);
  const [variantId, setVariantId] = useState(seed?.variantId ?? '');
  const [warehoused, setWarehoused] = useState<boolean | null>(seed ? true : null);
  const [quantity, setQuantity] = useState(
    seed?.currentQuantity !== undefined ? String(seed.currentQuantity) : '',
  );
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [existingRequestId, setExistingRequestId] = useState<string | null>(null);

  const isSeeded = !!seed;

  const reset = useCallback(() => {
    setProductId(seed?.productId ?? '');
    setVariantId(seed?.variantId ?? '');
    setVariants([]);
    setWarehoused(seed ? true : null);
    setQuantity(seed?.currentQuantity !== undefined ? String(seed.currentQuantity) : '');
    setNote('');
    setExistingRequestId(null);
  }, [seed]);

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  // Unseeded only: the vendor has to pick a product first. Physical products
  // only — nothing else can be warehoused.
  useEffect(() => {
    if (!open || isSeeded) return;
    let cancelled = false;
    setProductsLoading(true);
    fetchProducts({ type: 'physical', limit: 100 })
      .then((res) => {
        if (!cancelled) setProducts(res.data);
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      })
      .finally(() => {
        if (!cancelled) setProductsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, isSeeded]);

  // On product selection: load its variants AND confirm it is actually
  // warehoused, so the picker tells the truth instead of letting the vendor
  // discover it via a 404 after filling the whole form in.
  useEffect(() => {
    if (!open || isSeeded || !productId) return;
    let cancelled = false;
    setVariantsLoading(true);
    setVariantId('');
    setWarehoused(null);
    Promise.all([fetchProductById(productId), fetchVariants(productId)])
      .then(([product, list]) => {
        if (cancelled) return;
        setWarehoused(product.delivery?.pickupLocation?.source === 'agency_storage');
        setVariants(list.filter((v) => v.status === 'active'));
      })
      .catch(() => {
        if (!cancelled) {
          setVariants([]);
          setWarehoused(null);
        }
      })
      .finally(() => {
        if (!cancelled) setVariantsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, isSeeded, productId]);

  const parsedQuantity = Number(quantity);
  const quantityValid =
    quantity.trim() !== '' && Number.isInteger(parsedQuantity) && parsedQuantity >= 0;
  const canSubmit =
    !!productId && !!variantId && quantityValid && warehoused !== false && !saving;

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    setExistingRequestId(null);
    try {
      const dto = await createStockRequest({
        productId,
        variantId,
        quantity: parsedQuantity,
        note: note.trim() || undefined,
      });
      toast.success(t('inventory.requests.toast.raised'));
      onRaised(dto);
      onOpenChange(false);
    } catch (err) {
      // 409: one open request per SKU. `details.requestId` names it, so offer to
      // open it rather than leaving the vendor to hunt. Never render
      // `details.hint` — that string is backend English.
      if (err instanceof ApiError && err.code === 'STOCK_REQUEST_ALREADY_PENDING') {
        const id = err.detailsObject?.requestId;
        if (typeof id === 'string') setExistingRequestId(id);
      }
      apiError.toast(err, {
        context: 'stockRequest',
        fallbackKey: 'inventory.requests.errors.raiseFailed',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('inventory.requests.raise.title')}</DialogTitle>
          <DialogDescription>{t('inventory.requests.raise.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isSeeded ? (
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">{t('inventory.requests.columns.sku')}</p>
              <p className="font-mono text-sm">{seed?.sku ?? seed?.variantId}</p>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="raise-product">{t('inventory.requests.raise.product')}</Label>
                <Select value={productId} onValueChange={setProductId} disabled={productsLoading}>
                  <SelectTrigger id="raise-product" className="w-full">
                    <SelectValue placeholder={t('inventory.requests.raise.productPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {warehoused === false && (
                <p className="flex items-start gap-1.5 text-xs text-destructive">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  {t('errors.codes.INVENTORY_PRODUCT_NOT_STORED_HERE')}
                </p>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="raise-variant">{t('inventory.requests.raise.variant')}</Label>
                <Select
                  value={variantId}
                  onValueChange={setVariantId}
                  disabled={!productId || variantsLoading || warehoused === false}
                >
                  <SelectTrigger id="raise-variant" className="w-full">
                    <SelectValue placeholder={t('inventory.requests.raise.variantPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {variants.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.sku}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="raise-quantity">{t('inventory.requests.raise.quantity')}</Label>
            <Input
              id="raise-quantity"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              disabled={saving}
            />
            <p className="text-xs text-muted-foreground">
              {t('inventory.requests.raise.quantityHint')}
            </p>
            {quantity.trim() !== '' && !quantityValid && (
              <p className="text-xs text-destructive">{t('inventory.requests.raise.wholeNumber')}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="raise-note">{t('inventory.requests.raise.note')}</Label>
            <Textarea
              id="raise-note"
              value={note}
              maxLength={MAX_NOTE}
              placeholder={t('inventory.requests.raise.notePlaceholder')}
              onChange={(e) => setNote(e.target.value)}
              disabled={saving}
              className="min-h-20"
            />
            <p className="text-xs text-muted-foreground">{t('inventory.requests.raise.noteHint')}</p>
          </div>
        </div>

        <DialogFooter>
          {existingRequestId && onOpenExisting ? (
            <Button
              onClick={() => {
                onOpenChange(false);
                onOpenExisting(existingRequestId);
              }}
            >
              {t('inventory.requests.raise.openExisting')}
            </Button>
          ) : (
            <Button disabled={!canSubmit} onClick={submit}>
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                t('inventory.requests.raise.submit')
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default RaiseStockRequestDialog;
