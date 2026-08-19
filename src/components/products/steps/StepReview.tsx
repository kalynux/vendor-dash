import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronLeft, Globe, Handshake, Package, FileDigit, Sparkles } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { validateActivation } from '@/components/products/schemas/product.schemas';
import {
  collectCeilingEdits,
  minCeilingFor,
  seedCeilings,
  validateCeilings,
  variantLabel,
  type BargainCeilingEdit,
} from '@/components/products/bargain';
import { VariantThumb } from '@/components/products/VariantThumb';
import { AgencySelector } from '@/components/products/review/AgencySelector';
import { useFormatters, useMessage, useTranslation, type TranslationKey } from '@/i18n';
import type { WizardState, VendorAgencyListItemDto, ApiPickupLocation } from '@/types/product.types';
import { getProductFileCount } from '@/types/product.types';

interface StepReviewProps {
  mode: 'create' | 'edit';
  serverData: Partial<WizardState>;
  isSaving: boolean;
  stepError: string | null;
  onPublish: (values: { vectorisationEnabled: boolean; bargainEdits: BargainCeilingEdit[] }) => void;
  onSaveDraft: (values: { vectorisationEnabled: boolean; bargainEdits: BargainCeilingEdit[] }) => void;
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
  const { t } = useTranslation();
  const m = useMessage();
  const fmt = useFormatters();
  const product = serverData.serverProduct;
  const variants = serverData.serverVariants ?? [];
  const isDigital = product?.type === 'digital';
  const isPhysical = product?.type === 'physical';
  // List rows carry `fileIds`, detail responses carry resolved `files` — only the
  // latter can stand in for a variant with no picture of its own.
  const productImages = product && 'files' in product ? product.files : undefined;

  const [defaultAgency, setDefaultAgency] =
    useState<VendorAgencyListItemDto | null>(null);
  const [vectorisationEnabled, setVectorisationEnabled] = useState<boolean>(
    product?.vectorisationEnabled ?? false,
  );

  // Sync local form value when the underlying product changes (load, save, refresh)
  useEffect(() => {
    setVectorisationEnabled(product?.vectorisationEnabled ?? false);
  }, [product?.vectorisationEnabled, product?.id]);

  // ── Bargainable pricing ───────────────────────────────────────────────────
  // Active variants only: an archived variant is never sent to the AI index, so
  // a negotiation ceiling on one would be meaningless.
  //
  // `serviceConfig` also excludes service variants, which the backend refuses with
  // 400 CATALOG_VARIANT_BARGAIN_NOT_SUPPORTED — their price is a base rate the
  // booking engine prorates, so a flat range would not describe what is charged.
  // Services normally render StepServiceReview rather than this step, but the
  // variant-level check holds even if one is reached some other way.
  const bargainVariants = variants.filter((v) => v.status === 'active' && !v.serviceConfig);

  // Ceilings are held as strings: the inputs produce strings, '' is exactly the
  // "no window" signal, and it avoids a NaN dance on every keystroke.
  const [ceilings, setCeilings] = useState<Record<string, string>>(() =>
    seedCeilings(bargainVariants),
  );

  // `serverVariants` is replaced wholesale on every save, so array identity is a
  // useless dependency. Key off the values we actually care about — which also
  // catches a PRICE change, since that can invalidate a ceiling already typed.
  const variantsKey = bargainVariants
    .map((v) => `${v.id}:${v.price}:${v.bargain?.maxPrice ?? ''}`)
    .join('|');
  useEffect(() => {
    setCeilings(seedCeilings(bargainVariants));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantsKey]);

  // Derived during render rather than held in state: nothing here is async, and
  // the error clears the instant the number is fixed with no effect round-trip.
  // Same approach as `activationErrors` below.
  const ceilingErrors = validateCeilings(bargainVariants, ceilings);
  const hasCeilingErrors = Object.keys(ceilingErrors).length > 0;
  const submitValues = () => ({
    vectorisationEnabled,
    bargainEdits: collectCeilingEdits(bargainVariants, ceilings),
  });

  const activationErrors: TranslationKey[] = product
    ? validateActivation({
      productType: product.type,
      description: product.description,
      variants: variants.map((v) => ({ price: v.price, status: v.status })),
      defaultVariantId: product.defaultVariantId,
    })
    : ['products.activation.notCreated'];

  const liveFormatCount = variants.filter((v) => v.status === 'active').length;

  const productAgencyId = product?.delivery?.agencyId ?? null;
  const productFreeDelivery = product?.delivery?.freeDelivery ?? false;
  const productPickupLocation = product?.delivery?.pickupLocation ?? null;
  const effectiveAgencyId = productAgencyId ?? defaultAgency?.id ?? null;
  const physicalNeedsAgency = isPhysical && !effectiveAgencyId;
  if (physicalNeedsAgency) {
    activationErrors.push('products.activation.noAgency');
  }
  if (isPhysical && !physicalNeedsAgency && !productPickupLocation) {
    activationErrors.push('products.activation.noPickupLocation');
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

  const statusLabelKeys: Record<string, TranslationKey> = {
    draft: 'products.status.draft',
    active: 'products.status.active',
    archived: 'products.status.archived',
    pending_review: 'products.status.pendingReview',
    suspended: 'products.status.suspended',
  };

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
        <h2 className="text-lg font-semibold">{t('products.review.title')}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t('products.review.description')}
        </p>
      </div>

      {stepError && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{m(stepError)}</AlertDescription>
        </Alert>
      )}

      {isLockedForVectorisation && (
        <Alert>
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>
            {t('products.review.lockedIndexing')}
          </AlertDescription>
        </Alert>
      )}

      {productStatus === 'archived' && (
        <Alert>
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>
            {t('products.review.archivedNotice')}
          </AlertDescription>
        </Alert>
      )}
      {productStatus === 'pending_review' && (
        <Alert>
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>
            {t('products.review.pendingReviewNotice')}
          </AlertDescription>
        </Alert>
      )}
      {productStatus === 'suspended' && (
        <Alert>
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>
            {t('products.review.suspendedNotice')}
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
                  {t(statusLabelKeys[product.status] ?? 'products.status.draft')}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t(`products.type.${product.type}` as TranslationKey)}
                </span>
                <span className="text-xs text-muted-foreground">{product.category}</span>
              </div>
            </div>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div>
              <span className="text-muted-foreground text-xs">
                {t(isDigital ? 'products.review.summaryFormats' : 'products.review.summaryVariants')}
              </span>
              <p className="font-medium">
                {isDigital
                  ? t('products.review.formatsLive', {
                      total: variants.length,
                      live: liveFormatCount,
                    })
                  : variants.length}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">{t('products.review.summaryImages')}</span>
              <p className="font-medium">{getProductFileCount(product)}</p>
            </div>
            {isDigital && (
              <div>
                <span className="text-muted-foreground text-xs">
                  {t('products.review.summaryDownloads')}
                </span>
                <p className="font-medium">
                  {t(product.digitalConfig?.isActive === false
                    ? 'products.review.downloadsPaused'
                    : 'products.review.downloadsEnabled')}
                </p>
              </div>
            )}
            {product.tags.length > 0 && (
              <div className="col-span-2">
                <span className="text-muted-foreground text-xs">{t('products.review.tags')}</span>
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
          pickup={product?.pickup ?? null}
          unlimitedStockVariants={variants
            .filter((v) => v.status === 'active' && v.isInfiniteStock)
            .map((v) => ({ id: v.id, sku: v.sku }))}
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
                <p className="font-medium text-sm">{t('products.review.vectorisationTitle')}</p>
                <p className="text-xs text-muted-foreground mt-0.5 max-w-md">
                  {t('products.review.vectorisationDescription')}
                </p>
              </div>
              <Switch
                checked={vectorisationEnabled}
                onCheckedChange={setVectorisationEnabled}
                disabled={controlsDisabled}
                aria-label={t('products.review.vectorisationTitle')}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bargainable pricing — one ceiling per variant.
          Gated on the LOCAL toggle state, not `product.vectorisationEnabled`, so it
          appears the moment the switch flips; the flip is persisted by the same
          handler that writes these ceilings. */}
      {vectorisationEnabled && product && bargainVariants.length > 0 && (
        <div className="rounded-xl border border-border p-5 space-y-4">
          <div className="flex items-start gap-3">
            <Handshake className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="font-medium text-sm">{t('products.bargain.title')}</p>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-md">
                {t('products.bargain.description')}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {bargainVariants.map((v) => {
              const rowError = ceilingErrors[v.id];
              const minCeiling = minCeilingFor(v.price);
              return (
                <div
                  key={v.id}
                  className="grid grid-cols-1 gap-2 border-t border-border pt-3 first:border-t-0 first:pt-0 sm:grid-cols-[1fr_auto] sm:items-start"
                >
                  {/* The variant's own first image, so a vendor pricing a
                      forty-row matrix recognises the row instead of decoding
                      "Rouge / XL" against a SKU. */}
                  <div className="flex min-w-0 items-start gap-3">
                    <VariantThumb files={v.files} fallback={productImages} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{variantLabel(v)}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{v.sku}</span>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {fmt.currency(v.price)}
                        </span>
                        {/* A stored window shows regardless; `bargainable` only decides
                            whether it reads as live or dimmed. Never struck through —
                            this is a ceiling, not a "was" price. */}
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
                      disabled={controlsDisabled}
                      onChange={(e) =>
                        setCeilings((prev) => ({ ...prev, [v.id]: e.target.value }))
                      }
                      aria-invalid={!!rowError}
                      aria-describedby={`bargain-${v.id}-hint`}
                      className={cn('h-9 text-sm', rowError && 'border-destructive')}
                    />
                    {/* The floor is spelled out per row rather than only in the
                        error, because the number depends on this variant's price
                        and guessing it is the whole difficulty. */}
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

          <p className="text-xs text-muted-foreground">{t('products.bargain.clearHint')}</p>
        </div>
      )}

      {/* Activation checklist */}
      <div className="space-y-2">
        <p className="text-sm font-medium">{t('products.review.requirements')}</p>
        {canPublish ? (
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <CheckCircle2 className="w-4 h-4" />
            {t('products.review.requirementsMet')}
          </div>
        ) : (
          <ul className="space-y-1.5">
            {activationErrors.map((key, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-destructive">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                {t(key)}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button type="button" variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ChevronLeft className="w-4 h-4" />
          {t('common.actions.back')}
        </Button>
        <div className="flex items-center gap-2">
          {product?.status === 'draft' && (
            <Button
              type="button"
              variant="outline"
              onClick={() => onSaveDraft(submitValues())}
              disabled={isSaving || isLockedForVectorisation || hasCeilingErrors}
            >
              {t('products.review.keepAsDraft')}
            </Button>
          )}
          {showPublish && (
            <Button
              type="button"
              onClick={() => onPublish(submitValues())}
              disabled={isSaving || !canPublish || isLockedForVectorisation || hasCeilingErrors}
              className="gap-1.5"
            >
              {isSaving ? (
                t('products.review.publishing')
              ) : (
                <>
                  <Globe className="w-4 h-4" />
                  {t('products.actions.publish')}
                </>
              )}
            </Button>
          )}
          {showSaveChanges && (
            <Button
              type="button"
              onClick={() => onSaveDraft(submitValues())}
              disabled={isSaving || isLockedForVectorisation || hasCeilingErrors}
              className="gap-1.5"
            >
              {isSaving ? t('common.actions.saving') : t('common.actions.saveChanges')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
