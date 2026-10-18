import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { EditorPageShell } from '@/components/layout/EditorPageShell';
import { ProductFormBody } from '@/components/products/form/ProductFormBody';
import { SettingsSection } from '@/components/vendor-settings/SettingsSection';
import { AgencySelector } from '@/components/products/review/AgencySelector';
import {
  SimpleProductForm,
  type SimpleFieldErrors,
  type SimpleSubmitIntent,
} from '@/components/products/simple/SimpleProductForm';
import { projectSimpleError } from '@/components/products/simple/simpleFormErrors';
import {
  toCreatePayload,
  type SimpleProductFormValues,
} from '@/components/products/schemas/simple-product.schemas';
import {
  createSimpleProduct,
  getDeliveryErrorMessage,
  updateProduct,
  updateSimpleProduct,
} from '@/services/products.service';
import { useMessage, useTranslation } from '@/i18n';
import type { ApiPickupLocation, SimpleActivationMeta } from '@/types/product.types';
import type { CategoryEntry } from '@/types/category.types';
import { useCategoryConflicts } from '@/components/products/categories/useCategoryConflicts';

export function SimpleProductCreate() {
  const { t } = useTranslation();
  const m = useMessage();
  const navigate = useNavigate();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<SimpleFieldErrors | undefined>();
  const [offerPlans, setOfferPlans] = useState(false);
  const { run: runCategorySave, dialog: categoryConflictDialog } = useCategoryConflicts();
  const [resolvedCategories, setResolvedCategories] = useState<CategoryEntry[] | null>(null);

  // Delivery, held here until the product exists. `null` agency = the shop's
  // default; `null` pickup = let the server work it out, as before.
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [pickupLocation, setPickupLocation] = useState<ApiPickupLocation | null>(null);
  /** The live unlimited-stock switch — agency storage needs a countable quantity. */
  const [liveInfiniteStock, setLiveInfiniteStock] = useState(false);

  // Kept so the "auto-generate SKU" recovery can resubmit without asking the
  // vendor to retype anything.
  const lastValuesRef = useRef<SimpleProductFormValues | null>(null);

  const goToList = useCallback(() => navigate('/dashboard/products'), [navigate]);

  /**
   * The product exists as a draft — open it in its editor, with everything that
   * was typed and, when publishing was refused, the to-do list on top. Replacing
   * the form with the list on this page made the work look thrown away.
   * `replace`: going back must not land on an empty create form.
   */
  const openDraft = useCallback(
    (id: string, activation: SimpleActivationMeta | null) =>
      navigate(`/dashboard/product-edit/${id}/simple`, {
        replace: true,
        state: activation ? { activation } : null,
      }),
    [navigate],
  );

  // Turning unlimited stock on rules agency storage out; drop that choice rather
  // than send a pair the server refuses.
  useEffect(() => {
    if (liveInfiniteStock && pickupLocation?.source === 'agency_storage') setPickupLocation(null);
  }, [liveInfiniteStock, pickupLocation?.source]);

  const handleAgencyChange = useCallback((next: string | null) => {
    setAgencyId(next);
    // The pickup choice was offered by the previous agency's policy.
    setPickupLocation(null);
  }, []);

  const unlimitedStockVariants = useMemo(
    () => (liveInfiniteStock ? [{ id: 'new', sku: t('products.delivery.thisProduct') }] : []),
    [liveInfiniteStock, t],
  );

  const submit = useCallback(
    async (values: SimpleProductFormValues, publish: boolean) => {
      setIsSubmitting(true);
      setFormError(null);
      setFieldErrors(undefined);
      setOfferPlans(false);
      lastValuesRef.current = values;
      // The create takes no agency. With one of its own chosen, the product goes
      // in as a draft first, so both the pickup check and the publish check
      // judge the agency the vendor picked rather than the shop's default.
      const ownAgency = agencyId !== null;
      try {
        // "Did you mean …?" re-submits this same create — the 422 saved nothing.
        // The answers go back into the form and into `lastValuesRef`, so the
        // recovery buttons below resend them rather than asking again.
        const saved = await runCategorySave(
          values.categories,
          (categories) =>
            createSimpleProduct({
              ...toCreatePayload({ ...values, categories }, ownAgency ? false : publish),
              ...(!ownAgency && pickupLocation ? { pickupLocation } : {}),
            }),
          (categories) => {
            lastValuesRef.current = { ...values, categories };
            setResolvedCategories(categories);
          },
        );
        if (!saved.ok) return;
        let res = saved.value;

        if (ownAgency) {
          try {
            await updateProduct(res.product.id, { delivery: { agencyId } });
            if (pickupLocation || publish) {
              res = await updateSimpleProduct(res.product.id, {
                ...(pickupLocation ? { pickupLocation } : {}),
                ...(publish ? { publish: true } : {}),
              });
            }
          } catch (err: unknown) {
            // Everything typed is saved; only the delivery part is missing.
            // Staying here would create a second product on the next press.
            toast.error(m(getDeliveryErrorMessage(err)));
            openDraft(res.product.id, null);
            return;
          }
        }

        if (res.activation.published) {
          toast.success(t('products.quickAdd.createdPublished'));
          goToList();
          return;
        }
        if (!publish) {
          toast.success(t('products.quickAdd.savedAsDraft'));
          goToList();
          return;
        }
        openDraft(res.product.id, res.activation);
      } catch (err: unknown) {
        // Nothing was created. The form keeps everything that was typed.
        const projection = projectSimpleError(err);
        setFormError(projection.formError);
        setFieldErrors(projection.fieldErrors);
        // The plan check runs before anything is written, draft or not, so a
        // draft cannot get past it either — the way out is a bigger plan.
        setOfferPlans(projection.offerDraftFallback);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } finally {
        setIsSubmitting(false);
      }
    },
    [goToList, openDraft, t, m, runCategorySave, agencyId, pickupLocation],
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

  return (
    <EditorPageShell
      title={t('products.quickAdd.title')}
      // The handset gets the sentence without its link: the mobile header is one
      // truncated line, and a link that may be cut mid-word is worse than none.
      // The full editor is a tap away from the products list either way.
      description={t('products.quickAdd.subtitleLead')}
      descriptionNode={
        <>
          {t('products.quickAdd.subtitleLead')}{' '}
          <Link to="/dashboard/product-upload" className="underline hover:text-foreground">
            {t('products.quickAdd.subtitleLink')}
          </Link>
        </>
      }
      backTo="/dashboard/products"
      backLabel={t('products.wizard.backToProducts')}
    >
      <ProductFormBody className="space-y-4 md:space-y-6">
        {/* Recoveries after a failed create, right above the form they act on. */}
        {(offerPlans || fieldErrors?.sku) && (
          <div className="flex flex-col gap-2 md:flex-row md:flex-wrap">
            {offerPlans && (
              <Button asChild variant="outline" className="max-md:h-11 max-md:w-full">
                <Link to="/dashboard/account/billing">{t('products.quickAdd.viewPlans')}</Link>
              </Button>
            )}

            {fieldErrors?.sku && (
              <Button
                variant="outline"
                onClick={useGeneratedSku}
                className="max-md:h-11 max-md:w-full"
              >
                {t('products.quickAdd.useGeneratedSku')}
              </Button>
            )}
          </div>
        )}

        <SimpleProductForm
          mode="create"
          isSubmitting={isSubmitting}
          formError={formError}
          fieldErrors={fieldErrors}
          onSubmit={handleSubmit}
          onCancel={goToList}
          onStockModeChange={setLiveInfiniteStock}
          resolvedCategories={resolvedCategories}
        >
          {/* The same section the edit page shows. Only the agency and pickup
              point: the parcel record behind "Shipping configuration" is keyed
              by product id, so it appears once the product is saved. */}
          <SettingsSection title={t('products.delivery.title')} contentClassName="space-y-6">
            <AgencySelector
              productId={null}
              deferred
              productAgencyId={agencyId}
              isSaving={isSubmitting}
              onAgencyChange={handleAgencyChange}
              pickupLocation={pickupLocation}
              onPickupLocationChange={setPickupLocation}
              unlimitedStockVariants={unlimitedStockVariants}
            />
          </SettingsSection>
        </SimpleProductForm>
      </ProductFormBody>
      {categoryConflictDialog}
    </EditorPageShell>
  );
}
