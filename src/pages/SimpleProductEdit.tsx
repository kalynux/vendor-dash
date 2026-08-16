import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertCircle, Eye, MoreHorizontal, Sparkles, Wand2, Copy } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageBackButton } from '@/components/layout/PageBackButton';
import { AgencySelector } from '@/components/products/review/AgencySelector';
import {
  SimpleProductForm,
  type SimpleFieldErrors,
  type SimpleSubmitIntent,
} from '@/components/products/simple/SimpleProductForm';
import { ActivationBlockersPanel } from '@/components/products/simple/ActivationBlockersPanel';
import { ConvertToAdvancedDialog } from '@/components/products/simple/ConvertToAdvancedDialog';
import { projectSimpleError } from '@/components/products/simple/simpleFormErrors';
import {
  toFormValues,
  toUpdatePayload,
  isEmptyUpdate,
  type SimpleProductFormValues,
} from '@/components/products/schemas/simple-product.schemas';
import {
  fetchSimpleProduct,
  updateSimpleProduct,
  updateProduct,
  updateProductStatus,
  duplicateProduct,
  setVectorisationEnabled,
  getAllowedStatusTransitions,
  getSimpleProductErrorMessage,
  getDeliveryErrorMessage,
  type SimpleProductResult,
} from '@/services/products.service';
import { fetchStockRequests, withdrawStockRequest } from '@/services/stockRequests.service';
import { useApiError, useMessage, useTranslation, type TranslationKey } from '@/i18n';
import type {
  ApiProductDetail,
  ApiPickupLocation,
  ApiVariant,
  SimpleActivationMeta,
} from '@/types/product.types';
import type { StockRequestDto } from '@/types/stock-requests.types';

export function SimpleProductEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { t } = useTranslation();
  const m = useMessage();
  const apiError = useApiError();
  const [product, setProduct] = useState<ApiProductDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<SimpleFieldErrors | undefined>();
  const [activation, setActivation] = useState<SimpleActivationMeta | null>(null);
  const [activationMessage, setActivationMessage] = useState<string | undefined>();
  const [demoted, setDemoted] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  /** The single variant, kept so the pickup picker can see its stock mode. */
  const [variant, setVariant] = useState<ApiVariant | null>(null);
  /** The live (possibly unsaved) value of the unlimited-stock switch. */
  const [liveInfiniteStock, setLiveInfiniteStock] = useState(false);
  /** An open stock request on this SKU, if the agency has yet to answer. */
  const [pendingStockRequest, setPendingStockRequest] = useState<StockRequestDto | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  /**
   * Bumped to remount the form on the server's values. react-hook-form captures
   * `defaultValues` on first render, so rebasing the ref alone would leave the
   * vendor looking at a quantity the server refused to write.
   */
  const [formEpoch, setFormEpoch] = useState(0);

  // The baseline the save diff is computed against; refreshed after every write
  // so a second save doesn't re-send what the first already persisted.
  const initialValuesRef = useRef<SimpleProductFormValues | null>(null);

  const goToList = useCallback(() => navigate('/dashboard/products'), [navigate]);

  // ─── Load ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      try {
        const { product: loaded, variant: loadedVariant } = await fetchSimpleProduct(id!);
        if (cancelled) return;
        // Self-healing guard: a deep link, bookmark or stale list row may point
        // here for an advanced product. Guard on `mode &&` so a backend that
        // omits the field can't bounce us in a loop.
        if (loaded.mode && loaded.mode !== 'simple') {
          navigate(`/dashboard/product-edit/${loaded.id}`, { replace: true });
          return;
        }
        setProduct(loaded);
        setVariant(loadedVariant);
        setLiveInfiniteStock(loadedVariant?.isInfiniteStock ?? false);
        initialValuesRef.current = toFormValues(loaded, loadedVariant);

        // Only an agency-warehoused product can have a pending stock request,
        // so skip the call for everything else.
        if (loaded.delivery?.pickupLocation?.source === 'agency_storage') {
          const requests = await fetchStockRequests({
            productId: loaded.id,
            status: 'pending',
            limit: 1,
          }).catch(() => null);
          if (!cancelled && requests) setPendingStockRequest(requests.data[0] ?? null);
        }
      } catch (err: unknown) {
        if (!cancelled) setLoadError(getSimpleProductErrorMessage(err));
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  const productStatus = product?.status ?? null;
  const isLockedForVectorisation = product?.vectorisationStatus === 'pending';
  // archived/pending_review reject content updates; suspended stays editable
  // because assigning a working agency is the way out of suspension.
  const isReadOnlyStatus = productStatus === 'archived' || productStatus === 'pending_review';
  const isLocked = isLockedForVectorisation || isReadOnlyStatus;

  const statusTransitions = useMemo(
    () => (productStatus ? getAllowedStatusTransitions(productStatus) : []),
    [productStatus],
  );

  const isWarehoused = product?.delivery?.pickupLocation?.source === 'agency_storage';

  /**
   * What blocks a move TO agency storage. The switch is a deferred form field
   * while the pickup picker writes immediately, so the LIVE switch value is OR'd
   * in — otherwise a vendor could flip unlimited on (unsaved), pick agency
   * storage (the server still sees `false`, so it succeeds), then eat a 422 on
   * the next save.
   */
  const unlimitedStockVariants = useMemo(
    () =>
      variant && (liveInfiniteStock || variant.isInfiniteStock) && variant.status === 'active'
        ? [{ id: variant.id, sku: variant.sku }]
        : [],
    [variant, liveInfiniteStock],
  );

  const handleWithdrawStockRequest = useCallback(async () => {
    if (!pendingStockRequest) return;
    setWithdrawing(true);
    try {
      await withdrawStockRequest(pendingStockRequest.id);
      setPendingStockRequest(null);
      toast.success(t('products.simple.stockRequestWithdrawn'));
    } catch (err: unknown) {
      apiError.toast(err, {
        context: 'stockRequest',
        fallbackKey: 'inventory.requests.errors.actionFailed',
      });
    } finally {
      setWithdrawing(false);
    }
  }, [pendingStockRequest, t, apiError]);

  // ─── Applying a write result ────────────────────────────────────────────────

  /** Returns true when this write silently demoted an active product to draft. */
  const applyResult = useCallback((res: SimpleProductResult, wasActive: boolean) => {
    setProduct(res.product);
    setActivation(res.activation);
    setActivationMessage(res.message);
    // `defaultVariant` is the server's truth for the variant half of the write —
    // including a stock figure it declined to change.
    const saved = res.product.defaultVariant;
    if (saved) {
      setVariant((prev) => (prev ? { ...prev, ...saved } : prev));
      if (saved.isInfiniteStock !== undefined) setLiveInfiniteStock(saved.isInfiniteStock);
    }
    // The quantity was NOT written: it queued for the storage agency.
    if (res.stockAdjustment) {
      setPendingStockRequest(res.stockAdjustment.request as StockRequestDto);
    }
    // Omitting `publish` means an edit that broke the active-state invariant
    // silently demotes to draft — the blockers list is the vendor's only notice.
    const nowDemoted = wasActive && res.product.status === 'draft';
    setDemoted(nowDemoted);
    return nowDemoted;
  }, []);

  // ─── Save ───────────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(
    async (values: SimpleProductFormValues, intent: SimpleSubmitIntent) => {
      if (!product || !initialValuesRef.current) return;
      // `publish: false` is never sent from here — omitting it preserves the
      // demote-on-invariant-break signal, and unpublishing goes through
      // PATCH /products/:id/status instead.
      const publish = intent === 'publish' ? true : undefined;
      const payload = toUpdatePayload(values, initialValuesRef.current, publish);

      if (isEmptyUpdate(payload) && publish === undefined) {
        toast.info(t('products.simple.nothingToSave'));
        return;
      }

      const wasActive = product.status === 'active';
      setIsSubmitting(true);
      setFormError(null);
      setFieldErrors(undefined);
      try {
        const res = await updateSimpleProduct(product.id, payload);
        // Rebase the diff on what the server actually stored — the nested
        // defaultVariant is authoritative for the variant fields (e.g. a SKU it
        // generated or normalised), so the next save can't re-send a stale one.
        //
        // `isInfiniteStock` matters as much as `stock` here: on an
        // agency-warehoused product the backend DROPS both from the write, so
        // recording what was typed would mark them clean and they would never
        // be re-sent — the form and the server would disagree forever.
        const saved = res.product.defaultVariant;
        initialValuesRef.current = saved
          ? {
              ...values,
              sku: saved.sku,
              price: saved.price,
              stock: saved.stock,
              // `SimpleDefaultVariant` types these as optional, so fall back to
              // what was typed when the server omits them.
              isInfiniteStock: saved.isInfiniteStock ?? values.isInfiniteStock,
              compareAtPrice: saved.compareAtPrice ?? values.compareAtPrice,
              lowStockThreshold: saved.lowStockThreshold ?? values.lowStockThreshold,
              allowOversell: saved.allowOversell ?? values.allowOversell,
              // NOT the `?? values.x` fallback the others use: an absent `bargain`
              // legitimately means "the window was cleared", and falling back to
              // what was typed would mark a clear as unsaved forever. The `in`
              // check separates "the server omitted the key" (older backend —
              // trust what we sent) from "the server returned no window".
              bargainMaxPrice:
                'bargain' in saved ? saved.bargain?.maxPrice : values.bargainMaxPrice,
            }
          : values;
        const wasDemoted = applyResult(res, wasActive);
        if (res.stockAdjustment) {
          // Remount the form so the vendor sees the quantity the server holds,
          // not the one they typed — "render `data` as returned, not as
          // submitted". Everything else in the body did apply.
          setFormEpoch((n) => n + 1);
          toast.warning(
            t('products.simple.stockQueued', {
              from: saved?.stock ?? '—',
              to: res.stockAdjustment.request.requestedQuantity,
            }),
          );
        } else if (wasDemoted) {
          toast.warning(res.message ?? t('products.blockers.demoted'));
        } else {
          toast.success(res.message ?? t('products.toast.changesSaved'));
        }
      } catch (err: unknown) {
        const projection = projectSimpleError(err);
        setFormError(projection.formError);
        setFieldErrors(projection.fieldErrors);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } finally {
        setIsSubmitting(false);
      }
    },
    [product, applyResult],
  );

  // ─── Delivery ───────────────────────────────────────────────────────────────
  // freeDelivery and pickupLocation go through the simple endpoint so the
  // response refreshes meta.activation; the agency id is not part of that
  // contract and uses the standard product PATCH, which stays allowed.

  const patchSimple = useCallback(
    async (payload: Parameters<typeof updateSimpleProduct>[1]) => {
      if (!product) return;
      const wasActive = product.status === 'active';
      setIsSubmitting(true);
      try {
        const res = await updateSimpleProduct(product.id, payload);
        // Deliberately does not touch initialValuesRef: freeDelivery and
        // pickupLocation are not form fields (AgencySelector owns them), so
        // rebasing the diff here would only risk drift.
        applyResult(res, wasActive);
      } catch (err: unknown) {
        toast.error(getSimpleProductErrorMessage(err));
      } finally {
        setIsSubmitting(false);
      }
    },
    [product, applyResult],
  );

  const handleAgencyChange = useCallback(
    async (agencyId: string | null) => {
      if (!product) return;
      try {
        const { data } = await updateProduct(product.id, { delivery: { agencyId } });
        setProduct((prev) => (prev ? { ...prev, delivery: data.delivery } : prev));
      } catch (err: unknown) {
        toast.error(getDeliveryErrorMessage(err));
      }
    },
    [product],
  );

  const handleFreeDeliveryChange = useCallback(
    (freeDelivery: boolean) => patchSimple({ freeDelivery }),
    [patchSimple],
  );

  const handlePickupLocationChange = useCallback(
    (pickupLocation: ApiPickupLocation | null) => patchSimple({ pickupLocation }),
    [patchSimple],
  );

  const handleRetryPublish = useCallback(() => patchSimple({ publish: true }), [patchSimple]);

  const handlePickupLocationChosen = useCallback(
    (pickupLocation: ApiPickupLocation) => patchSimple({ pickupLocation, publish: true }),
    [patchSimple],
  );

  // ─── AI search ──────────────────────────────────────────────────────────────
  // An immediate write, not a deferred form field: it is a separate endpoint and
  // this editor has no publish step to piggyback on.

  const handleVectorisationToggle = useCallback(
    async (enabled: boolean) => {
      if (!product) return;
      try {
        const status = await setVectorisationEnabled(product.id, enabled);
        setProduct((prev) =>
          prev
            ? {
                ...prev,
                vectorisationEnabled: status.vectorisationEnabled,
                vectorisationStatus: status.vectorisationStatus,
              }
            : prev,
        );
        toast.success(t(enabled ? 'products.ai.enabled' : 'products.ai.disabled'));
      } catch (err: unknown) {
        toast.error(getSimpleProductErrorMessage(err));
      }
    },
    [product],
  );

  // ─── Header actions ─────────────────────────────────────────────────────────

  const handleStatusTransition = useCallback(
    async (target: Parameters<typeof updateProductStatus>[1]) => {
      if (!product) return;
      try {
        const updated = await updateProductStatus(product.id, target);
        setProduct((prev) => (prev ? { ...prev, status: updated.status } : prev));
        setActivation(null);
        setDemoted(false);
        toast.success(
          t('products.toast.statusChanged', {
            name: product.title,
            status: t(`products.status.${target === 'pending_review' ? 'pendingReview' : target}` as TranslationKey),
          }),
        );
      } catch (err: unknown) {
        toast.error(getSimpleProductErrorMessage(err));
      }
    },
    [product],
  );

  const handleDuplicate = useCallback(async () => {
    if (!product) return;
    try {
      const copy = await duplicateProduct(product.id);
      toast.success(t('products.toast.duplicated'));
      navigate(
        copy.mode === 'simple'
          ? `/dashboard/product-edit/${copy.id}/simple`
          : `/dashboard/product-edit/${copy.id}`,
      );
    } catch (err: unknown) {
      toast.error(getSimpleProductErrorMessage(err));
    }
  }, [product, navigate]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loadError) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <PageBackButton
          fallbackPath="/dashboard/products"
          label={t('products.wizard.backToProducts')}
        />
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{m(loadError)}</AlertDescription>
        </Alert>
      </div>
    );
  }

  // Never mount the form before the product resolves: react-hook-form captures
  // defaultValues on first render, and ProductMediaUpload latches onto the first
  // non-empty existingFiles — an early mount would leave the gallery empty and
  // the next save would wipe every image, since fileIds is a full replacement.
  if (!product || !initialValuesRef.current) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in max-w-3xl mx-auto -mx-6 sm:mx-auto">
      <div className="px-4 sm:px-0 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <PageBackButton
            fallbackPath="/dashboard/products"
            label={t('products.wizard.backToProducts')}
            className="mb-1"
          />
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold">{t('products.wizard.editTitle')}</h1>
            <Badge variant="outline" className="text-[10px]">
              {t('products.wizard.quickBadge')}
            </Badge>
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1 truncate">
            {product.title}
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="shrink-0">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate(`/preview/product/${product.id}`)}>
              <Eye className="w-4 h-4 mr-2" />
              {t('products.preview.action')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setConvertOpen(true)}>
              <Wand2 className="w-4 h-4 mr-2" />
              {t('products.actions.convertToAdvancedEditor')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void handleDuplicate()}>
              <Copy className="w-4 h-4 mr-2" />
              {t('common.actions.duplicate')}
            </DropdownMenuItem>
            {statusTransitions.length > 0 && <DropdownMenuSeparator />}
            {statusTransitions.map((transition) => (
              <DropdownMenuItem
                key={transition.intent}
                variant={transition.destructive ? 'destructive' : undefined}
                onClick={() => void handleStatusTransition(transition.target)}
              >
                {t(transition.labelKey)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isLockedForVectorisation && (
        <div className="px-4 sm:px-0">
          <Alert>
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>
              {t('products.review.lockedIndexing')}
            </AlertDescription>
          </Alert>
        </div>
      )}

      {isReadOnlyStatus && (
        <div className="px-4 sm:px-0">
          <Alert>
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>
              {t(productStatus === 'archived'
                ? 'products.review.archivedNotice'
                : 'products.review.pendingReviewNotice')}
            </AlertDescription>
          </Alert>
        </div>
      )}

      {productStatus === 'suspended' && (
        <div className="px-4 sm:px-0">
          <Alert>
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>
              {t('products.simple.suspendedNotice')}
            </AlertDescription>
          </Alert>
        </div>
      )}

      {activation && !activation.published && (
        <div className="px-4 sm:px-0">
          <ActivationBlockersPanel
            activation={activation}
            message={activationMessage}
            demoted={demoted}
            isBusy={isSubmitting}
            onRetryPublish={handleRetryPublish}
            onPickupLocationChosen={handlePickupLocationChosen}
            onDone={goToList}
          />
        </div>
      )}

      <Card className="rounded-none border-x-0 sm:rounded-xl sm:border">
        <CardContent className="p-4 sm:p-6">
          <div className={isLocked ? 'pointer-events-none opacity-60' : ''}>
            <SimpleProductForm
              // `formEpoch` remounts the form on the server's values after a
              // stock change the backend declined to write.
              key={`${product.id}:${formEpoch}`}
              mode="edit"
              initialValues={initialValuesRef.current}
              existingFiles={product.files}
              isSubmitting={isSubmitting}
              disabled={isLocked}
              formError={formError}
              fieldErrors={fieldErrors}
              canPublish={productStatus === 'draft'}
              onSubmit={handleSubmit}
              onCancel={goToList}
              disableUnlimitedStock={isWarehoused}
              onStockModeChange={setLiveInfiniteStock}
              // Revealed only once AI discovery is on — the window is inert without
              // it, and the toggle that governs it is rendered just above.
              showBargainField={product.vectorisationEnabled === true}
              stockNotice={
                pendingStockRequest ? (
                  <PendingStockRequestNotice
                    request={pendingStockRequest}
                    withdrawing={withdrawing}
                    onWithdraw={handleWithdrawStockRequest}
                  />
                ) : null
              }
            >
              <AgencySelector
                productId={product.id}
                productAgencyId={product.delivery?.agencyId ?? null}
                isSaving={isSubmitting || isLocked}
                onAgencyChange={handleAgencyChange}
                freeDelivery={product.delivery?.freeDelivery ?? false}
                onFreeDeliveryChange={handleFreeDeliveryChange}
                pickupLocation={product.delivery?.pickupLocation ?? null}
                onPickupLocationChange={handlePickupLocationChange}
                pickup={product.pickup ?? null}
                unlimitedStockVariants={unlimitedStockVariants}
              />

              <div className="rounded-xl border border-border p-5 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-sm">{t('products.simple.aiSearchTitle')}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 max-w-md">
                      {t('products.simple.aiSearchDescription')}
                    </p>
                  </div>
                  <Switch
                    checked={product.vectorisationEnabled ?? false}
                    onCheckedChange={(checked) => void handleVectorisationToggle(checked)}
                    disabled={isSubmitting || isLockedForVectorisation || isReadOnlyStatus}
                    aria-label={t('products.simple.aiSearchTitle')}
                  />
                </div>
              </div>
            </SimpleProductForm>
          </div>
        </CardContent>
      </Card>

      <ConvertToAdvancedDialog
        open={convertOpen}
        productId={product.id}
        productTitle={product.title}
        onOpenChange={setConvertOpen}
        onConverted={(converted) =>
          navigate(`/dashboard/product-edit/${converted.id}`, { replace: true })
        }
      />
    </div>
  );
}

/**
 * Sits directly under the stock input, where the discrepancy is.
 *
 * The field above shows what the agency has on record; this says what is queued
 * and offers the only way back out — withdrawing the proposal, which is also
 * what unblocks proposing a different quantity (one open request per SKU).
 */
function PendingStockRequestNotice({
  request,
  withdrawing,
  onWithdraw,
}: {
  request: StockRequestDto;
  withdrawing: boolean;
  onWithdraw: () => void;
}) {
  const { t } = useTranslation();
  const canWithdraw = request.availableActions.includes('withdraw');

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-2.5 text-xs text-amber-700 dark:text-amber-400">
      <p className="font-medium tabular-nums">
        {t('products.simple.stockQueuedNotice', {
          from: request.currentQuantity ?? request.quantityBefore,
          to: request.requestedQuantity,
        })}
      </p>
      <p className="mt-0.5 opacity-90">{t('products.simple.stockQueuedHint')}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button asChild size="sm" variant="outline" className="h-7 text-xs">
          <Link to={`/dashboard/inventory/requests?view=${encodeURIComponent(request.id)}`}>
            {t('products.simple.viewStockRequest')}
          </Link>
        </Button>
        {canWithdraw && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            disabled={withdrawing}
            onClick={onWithdraw}
          >
            {t('products.simple.withdrawStockRequest')}
          </Button>
        )}
      </div>
    </div>
  );
}
