import { AlertCircle, CheckCircle2, ChevronLeft, Globe, Package, FileDigit } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { validateActivation } from '@/components/products/schemas/product.schemas';
import type { WizardState } from '@/types/product.types';
import { getProductFileCount } from '@/types/product.types';

interface StepReviewProps {
  mode: 'create' | 'edit';
  serverData: Partial<WizardState>;
  isSaving: boolean;
  stepError: string | null;
  onPublish: () => void;
  onSaveDraft: () => void;
  onBack: () => void;
}

export function StepReview({
  mode,
  serverData,
  isSaving,
  stepError,
  onPublish,
  onSaveDraft,
  onBack,
}: StepReviewProps) {
  const product = serverData.serverProduct;
  const variants = serverData.serverVariants ?? [];
  const isDigital = product?.type === 'digital';

  const activationErrors = product
    ? validateActivation({
      productType: product.type,
      variants: variants.map((v) => ({ price: v.price, status: v.status })),
      defaultVariantId: product.defaultVariantId,
      digitalAssetId: product.digitalConfig?.asset?.id,
    })
    : ['Product has not been created yet'];

  const canPublish = activationErrors.length === 0;

  const statusColors: Record<string, string> = {
    draft: 'bg-muted text-muted-foreground',
    active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    archived: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    pending_review: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    suspended: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Review & publish</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Review your product before publishing. You can always save as draft and publish later.
        </p>
      </div>

      {stepError && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{stepError}</AlertDescription>
        </Alert>
      )}

      {/* Product summary card */}
      {product && (
        <div className="rounded-xl border border-border p-5 space-y-4">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
              {isDigital ? (
                <FileDigit className="w-5 h-5 text-muted-foreground" />
              ) : (
                <Package className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{product.title}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[product.status] ?? ''}`}
                >
                  {product.status.replace('_', ' ')}
                </span>
                <span className="text-xs text-muted-foreground capitalize">{product.type}</span>
                <span className="text-xs text-muted-foreground">{product.category}</span>
              </div>
            </div>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div>
              <span className="text-muted-foreground text-xs">Variants</span>
              <p className="font-medium">{variants.length}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Images</span>
              <p className="font-medium">{getProductFileCount(product)}</p>
            </div>
            {isDigital && (
              <div>
                <span className="text-muted-foreground text-xs">Digital asset</span>
                <p className="font-medium">
                  {product.digitalConfig?.asset?.id ? 'Uploaded' : 'Not uploaded'}
                </p>
              </div>
            )}
            {product.tags.length > 0 && (
              <div className="col-span-2">
                <span className="text-muted-foreground text-xs">Tags</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {product.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs font-normal">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Activation checklist */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Publishing requirements</p>
        {canPublish ? (
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <CheckCircle2 className="w-4 h-4" />
            All requirements met — ready to publish
          </div>
        ) : (
          <ul className="space-y-1.5">
            {activationErrors.map((err, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-destructive">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                {err}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button type="button" variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ChevronLeft className="w-4 h-4" />
          Back
        </Button>
        <div className="flex items-center gap-2">
          {product?.status === 'draft' && (
            <Button
              type="button"
              variant="outline"
              onClick={onSaveDraft}
              disabled={isSaving}
            >
              Keep as draft
            </Button>
          )}
          <Button
            type="button"
            onClick={onPublish}
            disabled={isSaving || !canPublish}
            className="gap-1.5"
          >
            {isSaving ? (
              'Publishing…'
            ) : (
              <>
                <Globe className="w-4 h-4" />
                Publish
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
