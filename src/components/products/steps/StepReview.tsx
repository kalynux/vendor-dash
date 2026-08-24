import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronLeft, Globe, Handshake, Package, FileDigit, Ruler, Sparkles } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { validateActivation } from '@/components/products/schemas/product.schemas';
import {
  collectCeilingEdits,
  seedCeilings,
  validateCeilings,
  type BargainCeilingEdit,
} from '@/components/products/bargain';
import { BargainCeilingsSheet } from '@/components/products/BargainCeilingsSheet';
import { ShippingConfigSheet } from '@/components/products/ShippingConfigSheet';
import { AgencySelector } from '@/components/products/review/AgencySelector';
import { fetchShippingConfig } from '@/services/shipping.service';
import { useMessage, useTranslation, type TranslationKey } from '@/i18n';
import type { WizardState, VendorAgencyListItemDto, ApiPickupLocation } from '@/types/product.types';
import type { ShippingConfig } from '@/types/shipping.types';
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

  // ── Shipping configuration ────────────────────────────────────────────────
  // Product-level parcel weight, dimensions, origin postcode and handling time.
  // Physical products only; a non-physical one is a 400 on that endpoint.
  //
  // Deliberately NOT part of the activation checklist below: this record does not
  // gate publishing. What an agency warehousing the product reads it for is the
  // parcel's dimensions when the variant carries none of its own.
  const productId = product?.id;
  const [shipping, setShipping] = useState<ShippingConfig | null>(null);
  const [shippingOpen, setShippingOpen] = useState(false);

  useEffect(() => {
    if (!isPhysical || !productId) {
      setShipping(null);
      return;
    }
    let cancelled = false;
    // A failure leaves the summary reading "not set", which is the same thing the
    // vendor sees when it genuinely is not — the row opens the sheet either way,
    // and the sheet surfaces its own load error.
    fetchShippingConfig(productId)
      .then((config) => {
        if (!cancelled) setShipping(config);
      })
      .catch(() => {
        if (!cancelled) setShipping(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isPhysical, productId]);

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

  // Whether there is anything to price at all. A product still being built has
  // no server variants yet, and a service product has none that qualify.
  const canPriceBargain = !!product && bargainVariants.length > 0;
  const [bargainOpen, setBargainOpen] = useState(false);
  // How many rows currently carry a window — the one number the collapsed
  // summary has to show, so closing the sheet never hides what was set in it.
  const ceilingsSetCount = bargainVariants.filter(
    (v) => (ceilings[v.id] ?? '').trim() !== '',
  ).length;

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
      <div className="rounded-xl border border-border p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-sm">{t('products.review.vectorisationTitle')}</p>
                <p className="text-xs text-muted-foreground mt-0.5 max-w-md">
                  {t('products.review.vectorisationDescription')}
                </p>
              </div>
              <Switch
                checked={vectorisationEnabled}
                onCheckedChange={(next) => {
                  setVectorisationEnabled(next);
                  // Turning this on is the *only* thing that makes a negotiation
                  // ceiling meaningful, so it presents the rows straight away
                  // rather than unfolding them below the fold where they were
                  // routinely missed. Dismissing is a real answer — pricing is
                  // optional, and the summary row below reopens it.
                  if (next && canPriceBargain) setBargainOpen(true);
                }}
                disabled={controlsDisabled}
                aria-label={t('products.review.vectorisationTitle')}
              />
            </div>
          </div>
        </div>
      </div>

      {/*
        Bargainable pricing.

        The rows themselves live in a sheet (BargainCeilingsSheet) — see its
        header for why. What stays inline is a summary: how many windows are
        set, and the way back in. That matters more than it looks, because the
        sheet is dismissible and Publish is blocked while a ceiling is invalid;
        without a collapsed row carrying that error, a vendor could be stuck on
        a disabled button with the explanation hidden behind a closed sheet.

        Gated on the LOCAL toggle state, not `product.vectorisationEnabled`, so it
        appears the moment the switch flips; the flip is persisted by the same
        handler that writes these ceilings.
      */}
      {vectorisationEnabled && canPriceBargain && (
        <button
          type="button"
          onClick={() => setBargainOpen(true)}
          disabled={controlsDisabled}
          className={cn(
            'flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors',
            'hover:bg-accent/40 disabled:pointer-events-none disabled:opacity-60',
            hasCeilingErrors ? 'border-destructive/50 bg-destructive/5' : 'border-border',
          )}
        >
          <Handshake className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{t('products.bargain.title')}</p>
            <p
              className={cn(
                'mt-0.5 text-xs',
                hasCeilingErrors ? 'text-destructive' : 'text-muted-foreground',
              )}
            >
              {hasCeilingErrors
                ? t('products.bargain.summaryInvalid')
                : ceilingsSetCount > 0
                  ? t('products.bargain.summarySet', { count: ceilingsSetCount })
                  : t('products.bargain.summaryNone')}
            </p>
          </div>
          <span className="shrink-0 text-xs font-semibold text-primary">
            {ceilingsSetCount > 0 ? t('common.actions.edit') : t('products.bargain.summaryAction')}
          </span>
        </button>
      )}

      {/*
        Shipping configuration — same collapsed-summary-plus-sheet shape as the
        bargain row above, and for the same reason: seven fields unfolded inline
        would push Publish off a phone screen.

        Unlike that one, this sheet saves for itself. There is no ordering
        constraint to respect (the bargain rows have to be written before the
        vectorisation flip; this record is independent), so making the caller own
        the inputs would buy nothing and would mean a vendor could leave the step
        with a half-entered parcel.
      */}
      {isPhysical && productId && (
        <button
          type="button"
          onClick={() => setShippingOpen(true)}
          disabled={controlsDisabled}
          className={cn(
            'flex w-full items-center gap-3 rounded-xl border border-border p-4 text-left',
            'transition-colors hover:bg-accent/40 disabled:pointer-events-none disabled:opacity-60',
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
      )}

      {isPhysical && productId && (
        <ShippingConfigSheet
          open={shippingOpen}
          onOpenChange={setShippingOpen}
          productId={productId}
          disabled={controlsDisabled}
          onSaved={setShipping}
        />
      )}

      <BargainCeilingsSheet
        open={bargainOpen}
        onOpenChange={setBargainOpen}
        variants={bargainVariants}
        ceilings={ceilings}
        onCeilingChange={(id, raw) => setCeilings((prev) => ({ ...prev, [id]: raw }))}
        errors={ceilingErrors}
        disabled={controlsDisabled}
        productImages={productImages}
      />

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
