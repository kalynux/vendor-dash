import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronLeft, Globe, Package, FileDigit, Sparkles } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { validateActivation } from '@/components/products/schemas/product.schemas';
import { AgencySelector } from '@/components/products/review/AgencySelector';
import type { WizardState, VendorAgencyListItemDto, ApiPickupLocation } from '@/types/product.types';
import { getProductFileCount } from '@/types/product.types';

interface StepReviewProps {
  mode: 'create' | 'edit';
  serverData: Partial<WizardState>;
  isSaving: boolean;
  stepError: string | null;
  onPublish: (values: { vectorisationEnabled: boolean }) => void;
  onSaveDraft: (values: { vectorisationEnabled: boolean }) => void;
  onBack: () => void;
  onAgencyChange: (agencyId: string | null) => Promise<void> | void;
  onFreeDeliveryChange: (freeDelivery: boolean) => Promise<void> | void;
  onPickupLocationChange: (pickupLocation: ApiPickupLocation | null) => Promise<void> | void;
}

export function StepReview({
  serverData,
  isSaving,
  stepError,
  onPublish,
  onSaveDraft,
  onBack,
  onAgencyChange,
  onFreeDeliveryChange,
  onPickupLocationChange,
}: StepReviewProps) {
  const product = serverData.serverProduct;
  const variants = serverData.serverVariants ?? [];
  const isDigital = product?.type === 'digital';
  const isPhysical = product?.type === 'physical';

  const [defaultAgency, setDefaultAgency] =
    useState<VendorAgencyListItemDto | null>(null);
  const [vectorisationEnabled, setVectorisationEnabled] = useState<boolean>(
    product?.vectorisationEnabled ?? false,
  );

  // Sync local form value when the underlying product changes (load, save, refresh)
  useEffect(() => {
    setVectorisationEnabled(product?.vectorisationEnabled ?? false);
  }, [product?.vectorisationEnabled, product?.id]);

  const activationErrors = product
    ? validateActivation({
      productType: product.type,
      description: product.description,
      variants: variants.map((v) => ({ price: v.price, status: v.status })),
      defaultVariantId: product.defaultVariantId,
    })
    : ['Product has not been created yet'];

  const liveFormatCount = variants.filter((v) => v.status === 'active').length;

  const productAgencyId = product?.delivery?.agencyId ?? null;
  const productFreeDelivery = product?.delivery?.freeDelivery ?? false;
  const productPickupLocation = product?.delivery?.pickupLocation ?? null;
  const effectiveAgencyId = productAgencyId ?? defaultAgency?.id ?? null;
  const physicalNeedsAgency = isPhysical && !effectiveAgencyId;
  if (physicalNeedsAgency) {
    activationErrors.push('A delivery agency must be assigned before publishing');
  }
  if (isPhysical && !physicalNeedsAgency && !productPickupLocation) {
    activationErrors.push('A pickup location must be set before publishing');
  }

  const canPublish = activationErrors.length === 0;

  const vectorisationStatus = product?.vectorisationStatus ?? 'not_started';
  const isLockedForVectorisation = vectorisationStatus === 'pending';

  // Vendor-triggered activation is only allowed from draft (see the allowed-
  // transitions table in api-doc/vendor/products.md). archived/pending_review
  // products also reject content updates (CATALOG_PRODUCT_INVALID_STATE);
  // suspended products stay editable but can't change status themselves.
  const productStatus = product?.status ?? null;
  const isReadOnlyStatus = productStatus === 'archived' || productStatus === 'pending_review';
  const showPublish = productStatus === 'draft' || !product;
  const showSaveChanges = productStatus === 'active' || productStatus === 'suspended';
  const controlsDisabled = isSaving || isLockedForVectorisation || isReadOnlyStatus;

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

      {isLockedForVectorisation && (
        <Alert>
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>
            This product is being indexed for AI search. Editing is temporarily disabled.
          </AlertDescription>
        </Alert>
      )}

      {productStatus === 'archived' && (
        <Alert>
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>
            This product is archived and read-only. Restore it to draft from the
            products list to edit or publish it.
          </AlertDescription>
        </Alert>
      )}
      {productStatus === 'pending_review' && (
        <Alert>
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>
            This product is awaiting admin review and is read-only until moderation
            completes.
          </AlertDescription>
        </Alert>
      )}
      {productStatus === 'suspended' && (
        <Alert>
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>
            This product is suspended because of a delivery-agency issue. You can
            still edit it — assigning a working delivery agency restores it
            automatically.
          </AlertDescription>
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
              <span className="text-muted-foreground text-xs">
                {isDigital ? 'Formats' : 'Variants'}
              </span>
              <p className="font-medium">
                {isDigital ? `${variants.length} · ${liveFormatCount} live` : variants.length}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Images</span>
              <p className="font-medium">{getProductFileCount(product)}</p>
            </div>
            {isDigital && (
              <div>
                <span className="text-muted-foreground text-xs">Downloads</span>
                <p className="font-medium">
                  {product.digitalConfig?.isActive === false ? 'Paused' : 'Enabled'}
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

      {/* Delivery agency (physical products only) */}
      {isPhysical && (
        <AgencySelector
          productId={product?.id ?? null}
          productAgencyId={productAgencyId}
          isSaving={controlsDisabled}
          onAgencyChange={onAgencyChange}
          freeDelivery={productFreeDelivery}
          onFreeDeliveryChange={onFreeDeliveryChange}
          pickupLocation={productPickupLocation}
          onPickupLocationChange={onPickupLocationChange}
          onAvailabilityResolved={({ defaultAgency: d }) => setDefaultAgency(d)}
        />
      )}

      {/* Vectorisation toggle — pure form field, saved on publish/draft */}
      <div className="rounded-xl border border-border p-5">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-sm">Enable AI vectorisation</p>
                <p className="text-xs text-muted-foreground mt-0.5 max-w-md">
                  When enabled and the product is complete and active, product data
                  is sent for vectorisation so customers can find it via AI search.
                  Status and retry options are available from the product card.
                </p>
              </div>
              <Switch
                checked={vectorisationEnabled}
                onCheckedChange={setVectorisationEnabled}
                disabled={controlsDisabled}
                aria-label="Enable AI vectorisation"
              />
            </div>
          </div>
        </div>
      </div>

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
              onClick={() => onSaveDraft({ vectorisationEnabled })}
              disabled={isSaving || isLockedForVectorisation}
            >
              Keep as draft
            </Button>
          )}
          {showPublish && (
            <Button
              type="button"
              onClick={() => onPublish({ vectorisationEnabled })}
              disabled={isSaving || !canPublish || isLockedForVectorisation}
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
          )}
          {showSaveChanges && (
            <Button
              type="button"
              onClick={() => onSaveDraft({ vectorisationEnabled })}
              disabled={isSaving || isLockedForVectorisation}
              className="gap-1.5"
            >
              {isSaving ? 'Saving…' : 'Save changes'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
