import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Wand2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { convertToAdvanced, getSimpleProductErrorMessage } from '@/services/products.service';
import type { ApiProduct } from '@/types/product.types';

interface ConvertToAdvancedDialogProps {
  open: boolean;
  productId: string | null;
  productTitle?: string;
  /** Raw `details.convertEndpoint` — shown for transparency when opened from a 409. */
  convertEndpoint?: string | null;
  onOpenChange: (open: boolean) => void;
  onConverted: (product: ApiProduct) => void;
}

export function ConvertToAdvancedDialog({
  open,
  productId,
  productTitle,
  convertEndpoint,
  onOpenChange,
  onConverted,
}: ConvertToAdvancedDialogProps) {
  const [isConverting, setIsConverting] = useState(false);

  async function handleConfirm() {
    if (!productId || isConverting) return;
    setIsConverting(true);
    try {
      // Idempotent on the backend, so a double-click is harmless. Never build a
      // request from `convertEndpoint` — it is a display string carrying the verb
      // and the /api prefix BASE_URL already supplies.
      const product = await convertToAdvanced(productId);
      toast.success('Switched to the advanced editor.');
      onConverted(product);
    } catch (err: unknown) {
      toast.error(getSimpleProductErrorMessage(err));
    } finally {
      setIsConverting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Wand2 className="w-4 h-4" />
            Switch to the advanced editor?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm">
              <p>
                {productTitle ? `"${productTitle}" ` : 'This product '}will move to the full
                editor, unlocking variants, options and per-variant images.
              </p>
              <p>
                Nothing else changes — your existing price, stock and images stay exactly as
                they are.
              </p>
              <p className="font-medium text-foreground">
                This is one-way. There is no way back to the quick editor.
              </p>
              {convertEndpoint && (
                <p className="text-xs text-muted-foreground font-mono break-all">
                  {convertEndpoint}
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isConverting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void handleConfirm();
            }}
            disabled={isConverting || !productId}
          >
            {isConverting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Switch to the advanced editor
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
