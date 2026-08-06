import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageBackButton } from '@/components/layout/PageBackButton';
import {
  SimpleProductForm,
  type SimpleFieldErrors,
  type SimpleSubmitIntent,
} from '@/components/products/simple/SimpleProductForm';
import { ActivationBlockersPanel } from '@/components/products/simple/ActivationBlockersPanel';
import { projectSimpleError } from '@/components/products/simple/simpleFormErrors';
import {
  toCreatePayload,
  type SimpleProductFormValues,
} from '@/components/products/schemas/simple-product.schemas';
import {
  createSimpleProduct,
  updateSimpleProduct,
  type SimpleProductResult,
} from '@/services/products.service';
import { useApiError, useTranslation } from '@/i18n';
import type { ApiPickupLocation } from '@/types/product.types';

export function SimpleProductCreate() {
  const { t } = useTranslation();
  const apiError = useApiError();
  const navigate = useNavigate();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<SimpleFieldErrors | undefined>();
  const [offerDraftFallback, setOfferDraftFallback] = useState(false);
  const [result, setResult] = useState<SimpleProductResult | null>(null);

  // Kept so the "Save as draft instead" / "auto-generate SKU" recoveries can
  // resubmit without asking the vendor to retype anything.
  const lastValuesRef = useRef<SimpleProductFormValues | null>(null);

  const goToList = useCallback(() => navigate('/dashboard/products'), [navigate]);

  const submit = useCallback(
    async (values: SimpleProductFormValues, publish: boolean) => {
      setIsSubmitting(true);
      setFormError(null);
      setFieldErrors(undefined);
      setOfferDraftFallback(false);
      lastValuesRef.current = values;
      try {
        const res = await createSimpleProduct(toCreatePayload(values, publish));
        if (res.activation.published) {
          toast.success(res.message ?? t('products.quickAdd.createdPublished'));
          goToList();
          return;
        }
        if (!publish) {
          toast.success(res.message ?? t('products.quickAdd.savedAsDraft'));
          goToList();
          return;
        }
        // Created but not published — stay put and show the checklist. The
        // product exists and is not lost.
        setResult(res);
      } catch (err: unknown) {
        const projection = projectSimpleError(err);
        setFormError(projection.formError);
        setFieldErrors(projection.fieldErrors);
        setOfferDraftFallback(projection.offerDraftFallback);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } finally {
        setIsSubmitting(false);
      }
    },
    [goToList, t],
  );

  const handleSubmit = useCallback(
    (values: SimpleProductFormValues, intent: SimpleSubmitIntent) =>
      submit(values, intent === 'publish'),
    [submit],
  );

  const useGeneratedSku = useCallback(() => {
    const values = lastValuesRef.current;
    if (!values) return;
    void submit({ ...values, sku: '' }, true);
  }, [submit]);

  const saveAsDraftInstead = useCallback(() => {
    const values = lastValuesRef.current;
    if (!values) return;
    void submit(values, false);
  }, [submit]);

  // Remediation after a 201 that could not publish. Both go through the simple
  // PATCH so the response carries a fresh meta.activation.
  const patchAndRefresh = useCallback(
    async (payload: Parameters<typeof updateSimpleProduct>[1]) => {
      if (!result) return;
      setIsSubmitting(true);
      try {
        const res = await updateSimpleProduct(result.product.id, payload);
        if (res.activation.published) {
          toast.success(res.message ?? t('products.quickAdd.published'));
          goToList();
          return;
        }
        setResult(res);
      } catch (err: unknown) {
        apiError.toast(err, { context: 'simpleProduct', fallbackKey: 'products.errors.saveFailed' });
      } finally {
        setIsSubmitting(false);
      }
    },
    [result, goToList, t, apiError],
  );

  const handlePickupLocationChosen = useCallback(
    (pickupLocation: ApiPickupLocation) => patchAndRefresh({ pickupLocation, publish: true }),
    [patchAndRefresh],
  );

  const handleRetryPublish = useCallback(
    () => patchAndRefresh({ publish: true }),
    [patchAndRefresh],
  );

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in max-w-3xl mx-auto -mx-6 sm:mx-auto">
      <div className="px-4 sm:px-0">
        <PageBackButton
          fallbackPath="/dashboard/products"
          label={t('products.wizard.backToProducts')}
          className="mb-1"
        />
        <h1 className="text-xl sm:text-2xl font-bold">{t('products.quickAdd.title')}</h1>
        <p className="text-muted-foreground text-xs sm:text-sm mt-1">
          {t('products.quickAdd.subtitleLead')}{' '}
          <Link to="/dashboard/product-upload" className="underline hover:text-foreground">
            {t('products.quickAdd.subtitleLink')}
          </Link>
        </p>
      </div>

      <Card className="rounded-none border-x-0 sm:rounded-xl sm:border">
        <CardContent className="p-4 sm:p-6 space-y-6">
          {result ? (
            <ActivationBlockersPanel
              activation={result.activation}
              message={result.message}
              isBusy={isSubmitting}
              onRetryPublish={handleRetryPublish}
              onPickupLocationChosen={handlePickupLocationChosen}
              onDone={goToList}
            />
          ) : (
            <>
              {offerDraftFallback && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button size="sm" variant="outline" onClick={saveAsDraftInstead}>
                    {t('products.simple.saveDraftInstead')}
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/dashboard/account/billing">{t('products.quickAdd.viewPlans')}</Link>
                  </Button>
                </div>
              )}

              {fieldErrors?.sku && (
                <Button size="sm" variant="outline" onClick={useGeneratedSku}>
                  {t('products.quickAdd.useGeneratedSku')}
                </Button>
              )}

              <SimpleProductForm
                mode="create"
                isSubmitting={isSubmitting}
                formError={formError}
                fieldErrors={fieldErrors}
                onSubmit={handleSubmit}
                onCancel={goToList}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
