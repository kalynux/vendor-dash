import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { SettingsSection, SettingsSections } from '@/components/vendor-settings/SettingsSection';
import { validateActivation } from '@/components/products/schemas/product.schemas';
import {
  collectCeilingEdits,
  seedCeilings,
  validateCeilings,
  type BargainCeilingEdit,
} from '@/components/products/bargain';
import { BargainCeilingsSheet } from '@/components/products/BargainCeilingsSheet';
import { ShippingConfigRow } from '@/components/products/ShippingConfigRow';
import { AgencySelector } from '@/components/products/review/AgencySelector';
import { useTranslation, type TranslationKey } from '@/i18n';
import type { WizardState, VendorAgencyListItemDto, ApiPickupLocation } from '@/types/product.types';
import { getProductFileCount } from '@/types/product.types';
import { StepActions, StepError } from './StepLayout';

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
  // The row below owns its own fetch and its own sheet — see `ShippingConfigRow`.
  const productId = product?.id;

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

  const hasNotices =
    isLockedForVectorisation ||
    productStatus === 'archived' ||
    productStatus === 'pending_review' ||
    productStatus === 'suspended';

  const requirements = canPublish ? (
    <p className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
      <CheckCircle2 className="size-4 shrink-0" />
      {t('products.review.requirementsMet')}
    </p>
  ) : (
    <div className="space-y-2">
      <p className="text-sm font-medium">{t('products.review.requirements')}</p>
      <ul className="space-y-1.5">
        {activationErrors.map((key, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {t(key)}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div>
      <StepError error={stepError} />

      {hasNotices && (
        <div className="mb-4 space-y-3 md:mb-6">
          {isLockedForVectorisation && (
            <Alert>
              <AlertCircle className="size-4" />
              <AlertDescription>{t('products.review.lockedIndexing')}</AlertDescription>
            </Alert>
          )}
          {productStatus === 'archived' && (
            <Alert>
              <AlertCircle className="size-4" />
              <AlertDescription>{t('products.review.archivedNotice')}</AlertDescription>
            </Alert>
          )}
          {productStatus === 'pending_review' && (
            <Alert>
              <AlertCircle className="size-4" />
              <AlertDescription>{t('products.review.pendingReviewNotice')}</AlertDescription>
            </Alert>
          )}
          {productStatus === 'suspended' && (
            <Alert>
              <AlertCircle className="size-4" />
              <AlertDescription>{t('products.review.suspendedNotice')}</AlertDescription>
            </Alert>
          )}
        </div>
      )}

      <SettingsSections>
        {/* ── Summary ─────────────────────────────────────────────────────── */}
        <SettingsSection title={t('products.review.title')} info={t('products.review.description')}>
          {product && (
            <div className="space-y-5">
              <div className="min-w-0">
                <p className="truncate font-medium">{product.title}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-medium',
                      statusColors[product.status],
                    )}
                  >
                    {t(statusLabelKeys[product.status] ?? 'products.status.draft')}
                  </span>
                  <span>{t(`products.type.${product.type}` as TranslationKey)}</span>
                  {product.category && (
                    <>
                      <span aria-hidden>·</span>
                      <span className="min-w-0 truncate">{product.category}</span>
                    </>
                  )}
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground">
                    {t(isDigital ? 'products.review.summaryFormats' : 'products.review.summaryVariants')}
                  </dt>
                  <dd className="mt-0.5 font-medium">
                    {isDigital
                      ? t('products.review.formatsLive', {
                          total: variants.length,
                          live: liveFormatCount,
                        })
                      : variants.length}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t('products.review.summaryImages')}</dt>
                  <dd className="mt-0.5 font-medium">{getProductFileCount(product)}</dd>
                </div>
                {isDigital && (
                  <div>
                    <dt className="text-muted-foreground">{t('products.review.summaryDownloads')}</dt>
                    <dd className="mt-0.5 font-medium">
                      {t(product.digitalConfig?.isActive === false
                        ? 'products.review.downloadsPaused'
                        : 'products.review.downloadsEnabled')}
                    </dd>
                  </div>
                )}
                {product.tags.length > 0 && (
                  <div className="col-span-full">
                    <dt className="text-muted-foreground">{t('products.review.tags')}</dt>
                    <dd className="mt-1.5 flex flex-wrap gap-1.5">
                      {product.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="font-normal">
                          {tag}
                        </Badge>
                      ))}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </SettingsSection>

        {/* ── Delivery (physical products only) ───────────────────────────── */}
        {/* AgencySelector and ShippingConfigRow draw no box and no heading of
            their own — this section is their frame. */}
        {isPhysical && (
          <SettingsSection title={t('products.delivery.title')} contentClassName="space-y-6">
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

            {/*
              Shipping configuration — a collapsed summary plus a sheet, for the
              same reason as the negotiation row below: seven fields unfolded
              inline would push Publish off a phone screen.

              Shared with the quick-add editor, which had no equivalent until this
              was extracted — the two flows produce the same record, so they should
              not have two implementations of the control that writes it.
            */}
            <ShippingConfigRow
              productId={productId}
              isPhysical={isPhysical}
              disabled={controlsDisabled}
            />
          </SettingsSection>
        )}

        {/* ── AI discovery — a pure form field, saved on publish / draft ──── */}
        {/* Titled "AI search", as in the quick-add editor: "vectorisation" is
            the mechanism, not something a vendor is choosing. */}
        <SettingsSection
          title={t('products.simple.aiSearchTitle')}
          description={t('products.review.vectorisationDescription')}
          action={
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
          }
          // With no negotiation row under it the header is the whole section, so
          // its bottom margin would only pad an empty body.
          className={cn(!(vectorisationEnabled && canPriceBargain) && '[&>div:first-child]:mb-0')}
        >
          {/*
            Bargainable pricing.

            The rows themselves live in a sheet (BargainCeilingsSheet) — see its
            header for why. What stays inline is a summary: how many windows are
            set, and the way back in. That matters more than it looks, because the
            sheet is dismissible and Publish is blocked while a ceiling is invalid;
            without a collapsed row carrying that error, a vendor could be stuck on
            a disabled button with the explanation hidden behind a closed sheet.

            Gated on the LOCAL toggle state, not `product.vectorisationEnabled`, so
            it appears the moment the switch flips; the flip is persisted by the
            same handler that writes these ceilings.
          */}
          {vectorisationEnabled && canPriceBargain && (
            <button
              type="button"
              onClick={() => setBargainOpen(true)}
              disabled={controlsDisabled}
              className={cn(
                'group flex min-h-11 w-full items-center justify-between gap-4 rounded-md text-left',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                'disabled:pointer-events-none disabled:opacity-60',
              )}
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium">{t('products.bargain.title')}</span>
                <span
                  className={cn(
                    'mt-0.5 block text-sm',
                    hasCeilingErrors ? 'text-destructive' : 'text-muted-foreground',
                  )}
                >
                  {hasCeilingErrors
                    ? t('products.bargain.summaryInvalid')
                    : ceilingsSetCount > 0
                      ? t('products.bargain.summarySet', { count: ceilingsSetCount })
                      : t('products.bargain.summaryNone')}
                </span>
              </span>
              <span className="shrink-0 text-sm font-medium text-primary group-hover:underline group-hover:underline-offset-4">
                {ceilingsSetCount > 0 ? t('common.actions.edit') : t('products.bargain.summaryAction')}
              </span>
            </button>
          )}
        </SettingsSection>
      </SettingsSections>

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

      {/* The activation checklist sits right above the buttons it gates. */}
      <StepActions onBack={onBack} notice={requirements}>
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
          >
            {isSaving ? t('products.review.publishing') : t('products.actions.publish')}
          </Button>
        )}
        {showSaveChanges && (
          <Button
            type="button"
            onClick={() => onSaveDraft(submitValues())}
            disabled={isSaving || isLockedForVectorisation || hasCeilingErrors}
          >
            {isSaving ? t('common.actions.saving') : t('common.actions.saveChanges')}
          </Button>
        )}
      </StepActions>
    </div>
  );
}
