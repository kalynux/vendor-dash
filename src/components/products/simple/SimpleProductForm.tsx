import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, X, Plus, ChevronDown, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ProductMediaUpload } from '@/components/products/ProductMediaUpload';
import { useTranslation, useMessage } from '@/i18n';
import { PRODUCT_IMAGE_LIMIT } from '@/components/products/media.constants';
import {
  simpleProductSchema,
  type SimpleProductFormValues,
  type SimpleProductFormInput,
} from '@/components/products/schemas/simple-product.schemas';
import type { ApiFileDetail } from '@/types/product.types';

/** Which button the vendor pressed — the pages turn this into a `publish` value. */
export type SimpleSubmitIntent = 'publish' | 'draft' | 'save';

export type SimpleFieldErrors = Partial<Record<keyof SimpleProductFormValues, string>>;

export interface SimpleProductFormProps {
  mode: 'create' | 'edit';
  /**
   * Edit only. Must be fully resolved before this component mounts — react-hook-form
   * captures defaultValues on first render and ProductMediaUpload latches onto the
   * first non-empty `existingFiles`.
   */
  initialValues?: SimpleProductFormValues;
  /** Edit only — seeds the media gallery. */
  existingFiles?: ApiFileDetail[];
  isSubmitting: boolean;
  /** True while indexing / archived / pending review — every control goes read-only. */
  disabled?: boolean;
  /** Top-of-form banner, already mapped to a vendor-readable sentence. */
  formError?: string | null;
  /** Server errors projected onto individual fields, e.g. a taken SKU. */
  fieldErrors?: SimpleFieldErrors;
  /** Edit only — enables the "Save & publish" action. */
  canPublish?: boolean;
  onSubmit: (values: SimpleProductFormValues, intent: SimpleSubmitIntent) => void | Promise<void>;
  onCancel: () => void;
  /**
   * Rendered directly under the stock input — where the discrepancy is. The edit
   * page uses it for the "120 → 90 · awaiting approval" notice on an
   * agency-warehoused product.
   */
  stockNotice?: React.ReactNode;
  /**
   * True when this product's pickup is `agency_storage`. A warehouse holds a
   * countable quantity, so the backend refuses the pair with
   * `422 CATALOG_PRODUCT_AGENCY_STORAGE_INFINITE_STOCK`.
   */
  disableUnlimitedStock?: boolean;
  /**
   * Fires on every switch change (and once on mount) so the page can OR the LIVE
   * value into what it tells the pickup picker. The switch is a deferred form
   * field while the picker writes immediately — without this they can disagree
   * inside one screen.
   */
  onStockModeChange?: (isInfiniteStock: boolean) => void;
  /**
   * Rendered between the fields and the action bar. The edit page injects the
   * delivery card, AI-search toggle and status control here — all separate
   * endpoints, and therefore not this form's business.
   */
  children?: React.ReactNode;
}

const EMPTY_VALUES: SimpleProductFormValues = {
  title: '',
  category: '',
  description: '',
  tags: [],
  seoTitle: '',
  seoDescription: '',
  fileIds: [],
  price: 0,
  compareAtPrice: undefined,
  stock: 0,
  isInfiniteStock: false,
  sku: '',
  lowStockThreshold: undefined,
  allowOversell: false,
  weight: undefined,
  length: undefined,
  width: undefined,
  height: undefined,
};

export function SimpleProductForm({
  mode,
  initialValues,
  existingFiles = [],
  isSubmitting,
  disabled = false,
  formError,
  fieldErrors,
  canPublish = false,
  onSubmit,
  onCancel,
  children,
  stockNotice,
  disableUnlimitedStock = false,
  onStockModeChange,
}: SimpleProductFormProps) {
  const { t } = useTranslation();
  const m = useMessage();
  const isEdit = mode === 'edit';
  const tagInputRef = useRef<HTMLInputElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const intentRef = useRef<SimpleSubmitIntent>(isEdit ? 'save' : 'publish');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<SimpleProductFormInput, unknown, SimpleProductFormValues>({
    resolver: zodResolver(simpleProductSchema),
    defaultValues: (initialValues ?? EMPTY_VALUES) as SimpleProductFormInput,
  });

  const tags = (watch('tags') ?? []) as string[];
  const isInfiniteStock = watch('isInfiniteStock');
  const price = watch('price');
  const compareAtPrice = watch('compareAtPrice');
  const seoTitle = watch('seoTitle') ?? '';
  const seoDesc = watch('seoDescription') ?? '';

  // Report the live switch value up, including the value it mounted with, so the
  // pickup picker judges "agency storage" against what the vendor sees rather
  // than against what was last persisted.
  useEffect(() => {
    onStockModeChange?.(isInfiniteStock === true);
  }, [isInfiniteStock, onStockModeChange]);

  // Project server-side field errors (a taken SKU, a rejected image) onto the
  // inputs, revealing the collapsed section when the culprit lives inside it.
  useEffect(() => {
    if (!fieldErrors) return;
    const collapsedKeys: (keyof SimpleProductFormValues)[] = [
      'sku',
      'lowStockThreshold',
      'allowOversell',
      'weight',
      'length',
      'width',
      'height',
      'seoTitle',
      'seoDescription',
    ];
    let focused = false;
    for (const [key, message] of Object.entries(fieldErrors)) {
      if (!message) continue;
      const field = key as keyof SimpleProductFormValues;
      setError(field, { type: 'server', message });
      if (collapsedKeys.includes(field)) setMoreOpen(true);
      if (!focused) {
        focused = true;
        // fileIds has no focusable input — skip rather than throw.
        if (field !== 'fileIds' && field !== 'tags') setFocus(field);
      }
    }
  }, [fieldErrors, setError, setFocus]);

  function addTag() {
    const input = tagInputRef.current;
    if (!input) return;
    const value = input.value.trim();
    if (!value || tags.includes(value)) return;
    setValue('tags', [...tags, value], { shouldValidate: true, shouldDirty: true });
    input.value = '';
  }

  function removeTag(index: number) {
    setValue(
      'tags',
      tags.filter((_, i) => i !== index),
      { shouldValidate: true, shouldDirty: true },
    );
  }

  function onTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    }
  }

  function submitWith(intent: SimpleSubmitIntent) {
    intentRef.current = intent;
  }

  const isBusy = isSubmitting || disabled;

  return (
    <form
      onSubmit={handleSubmit((values) => onSubmit(values, intentRef.current))}
      className="space-y-6"
    >
      {formError && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{m(formError)}</AlertDescription>
        </Alert>
      )}

      {/* Photos */}
      <div className="space-y-1.5">
        <Label>{t('products.fields.photos')}</Label>
        <p className="text-xs text-muted-foreground">
          {t('products.fields.photosHint', { max: PRODUCT_IMAGE_LIMIT.physical })}
        </p>
        <ProductMediaUpload
          existingFiles={existingFiles}
          maxFiles={PRODUCT_IMAGE_LIMIT.physical}
          disabled={isBusy}
          onMediaChange={(ids) => setValue('fileIds', ids, { shouldDirty: true })}
        />
        {errors.fileIds && (
          <p className="text-xs text-destructive">{m(errors.fileIds.message as string)}</p>
        )}
      </div>

      {/* Title */}
      <div className="space-y-1.5">
        <Label htmlFor="title">
          {t('products.fields.productName')} <span className="text-destructive">*</span>
        </Label>
        <Input
          id="title"
          placeholder={t('products.fields.namePlaceholder')}
          disabled={isBusy}
          {...register('title')}
          aria-invalid={!!errors.title}
        />
        {errors.title && <p className="text-xs text-destructive">{m(errors.title.message)}</p>}
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="description">
          {t('products.fields.description')} <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="description"
          placeholder={t('products.fields.descriptionHelp')}
          rows={4}
          disabled={isBusy}
          {...register('description')}
          aria-invalid={!!errors.description}
        />
        {errors.description ? (
          <p className="text-xs text-destructive">{m(errors.description.message)}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t('products.fields.descriptionRequired')}
          </p>
        )}
      </div>

      {/* Category */}
      <div className="space-y-1.5">
        <Label htmlFor="category">
          {t('products.fields.category')} <span className="text-destructive">*</span>
        </Label>
        <Input
          id="category"
          placeholder={t('products.fields.categoryPlaceholder')}
          disabled={isBusy}
          {...register('category')}
          aria-invalid={!!errors.category}
        />
        {errors.category && <p className="text-xs text-destructive">{m(errors.category.message)}</p>}
      </div>

      {/* Price / compare-at / stock */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="price">
            {t('products.fields.price')} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="price"
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            placeholder="0"
            disabled={isBusy}
            {...register('price')}
            aria-invalid={!!errors.price}
          />
          {errors.price && <p className="text-xs text-destructive">{m(errors.price.message)}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="compareAtPrice">{t('products.fields.compareAtPrice')}</Label>
          <Input
            id="compareAtPrice"
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            placeholder={t('products.fields.compareAtOptional')}
            disabled={isBusy}
            {...register('compareAtPrice')}
            aria-invalid={!!errors.compareAtPrice}
          />
          {errors.compareAtPrice ? (
            <p className="text-xs text-destructive">{m(errors.compareAtPrice.message)}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {typeof compareAtPrice === 'number' &&
              typeof price === 'number' &&
              compareAtPrice > 0 &&
              compareAtPrice <= price
                ? t('products.fields.compareAtTooLowHint')
                : t('products.fields.compareAtHigherHint')}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="stock">{t('products.fields.stock')}</Label>
          <Input
            id="stock"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            placeholder="0"
            disabled={isBusy || isInfiniteStock === true}
            {...register('stock')}
            aria-invalid={!!errors.stock}
          />
          {errors.stock && <p className="text-xs text-destructive">{m(errors.stock.message)}</p>}
          {/* Where the discrepancy is: the field above holds the server's
              figure, and this says what is still waiting on the agency. */}
          {stockNotice}
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 self-end">
          <div className="min-w-0">
            <p className="text-sm font-medium">{t('products.fields.unlimitedStock')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {disableUnlimitedStock
                ? t('products.fields.unlimitedStockLockedHint')
                : t('products.fields.unlimitedStockHint')}
            </p>
          </div>
          <Switch
            checked={isInfiniteStock === true}
            onCheckedChange={(checked) =>
              setValue('isInfiniteStock', checked, { shouldDirty: true })
            }
            disabled={isBusy || disableUnlimitedStock}
            aria-label={t('products.fields.unlimitedStock')}
          />
        </div>
      </div>

      {/* More options */}
      <Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
        <CollapsibleTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="gap-1.5 w-full sm:w-auto">
            <Settings2 className="w-3.5 h-3.5" />
            {t('products.fields.moreOptions')}
            <ChevronDown
              className={cn('w-3.5 h-3.5 transition-transform', moreOpen && 'rotate-180')}
            />
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="space-y-6 pt-4">
          {/* SKU */}
          <div className="space-y-1.5">
            <Label htmlFor="sku">{t('products.fields.sku')}</Label>
            <Input
              id="sku"
              placeholder={t(
                isEdit
                  ? 'products.fields.skuPlaceholderEdit'
                  : 'products.fields.skuPlaceholderCreate',
              )}
              disabled={isBusy}
              {...register('sku')}
              aria-invalid={!!errors.sku}
            />
            {errors.sku ? (
              <p className="text-xs text-destructive">{m(errors.sku.message)}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t(isEdit ? 'products.fields.skuHintEdit' : 'products.fields.skuHintCreate')}
              </p>
            )}
          </div>

          {/* Edit-only inventory controls — not part of the create contract. */}
          {isEdit && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="lowStockThreshold">{t('products.fields.lowStockAlertAt')}</Label>
                <Input
                  id="lowStockThreshold"
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  placeholder={t('products.fields.noAlert')}
                  disabled={isBusy}
                  {...register('lowStockThreshold')}
                  aria-invalid={!!errors.lowStockThreshold}
                />
                {errors.lowStockThreshold && (
                  <p className="text-xs text-destructive">{m(errors.lowStockThreshold.message)}</p>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 self-end">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{t('products.fields.allowOversell')}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t('products.fields.allowOversellHint')}
                  </p>
                </div>
                <Switch
                  checked={watch('allowOversell') === true}
                  onCheckedChange={(checked) =>
                    setValue('allowOversell', checked, { shouldDirty: true })
                  }
                  disabled={isBusy}
                  aria-label={t('products.fields.allowOversell')}
                />
              </div>
            </div>
          )}

          {/* Tags */}
          <div className="space-y-1.5">
            <Label>{t('products.fields.tags')}</Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((tag, i) => (
                <Badge key={`${tag}-${i}`} variant="secondary" className="gap-1 text-xs">
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(i)}
                    disabled={isBusy}
                    className="hover:text-destructive transition-colors ml-0.5"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                ref={tagInputRef}
                placeholder={t('products.fields.addTagPlaceholder')}
                className="h-8"
                disabled={isBusy}
                onKeyDown={onTagKeyDown}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addTag}
                disabled={isBusy}
                className="gap-1.5 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                {t('common.actions.add')}
              </Button>
            </div>
            {errors.tags?.message && (
              <p className="text-xs text-destructive">{m(errors.tags.message as string)}</p>
            )}
          </div>

          {/* Shipping dimensions */}
          <div className="rounded-lg border border-border p-4 space-y-4">
            <p className="text-sm font-medium">{t('products.fields.dimensionsTitle')}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(
                [
                  ['weight', 'products.fields.weightG'],
                  ['length', 'products.fields.lengthCm'],
                  ['width', 'products.fields.widthCm'],
                  ['height', 'products.fields.heightCm'],
                ] as const
              ).map(([field, labelKey]) => (
                <div key={field} className="space-y-1.5">
                  <Label htmlFor={field} className="text-xs text-muted-foreground">
                    {t(labelKey)}
                  </Label>
                  <Input
                    id={field}
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    disabled={isBusy}
                    {...register(field)}
                    aria-invalid={!!errors[field]}
                  />
                  {errors[field] && (
                    <p className="text-xs text-destructive">{m(errors[field]?.message)}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* SEO */}
          <div className="rounded-lg border border-border p-4 space-y-4">
            <p className="text-sm font-medium">{t('products.fields.seoTitle')}</p>

            <div className="space-y-1.5">
              <Label htmlFor="seoTitle" className="text-xs text-muted-foreground">
                {t('products.fields.seoTitleLabel')}{' '}
                <span className="text-muted-foreground/60">
                  {t('products.fields.charCount', { used: seoTitle.length, max: 60 })}
                </span>
              </Label>
              <Input
                id="seoTitle"
                placeholder={t('products.fields.seoTitlePlaceholder')}
                maxLength={60}
                disabled={isBusy}
                {...register('seoTitle')}
                aria-invalid={!!errors.seoTitle}
              />
              {errors.seoTitle && (
                <p className="text-xs text-destructive">{m(errors.seoTitle.message)}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="seoDescription" className="text-xs text-muted-foreground">
                {t('products.fields.seoDescriptionLabel')}{' '}
                <span className="text-muted-foreground/60">
                  {t('products.fields.charCount', { used: seoDesc.length, max: 160 })}
                </span>
              </Label>
              <Textarea
                id="seoDescription"
                placeholder={t('products.fields.seoDescriptionPlaceholder')}
                maxLength={160}
                rows={2}
                disabled={isBusy}
                {...register('seoDescription')}
                aria-invalid={!!errors.seoDescription}
              />
              {errors.seoDescription && (
                <p className="text-xs text-destructive">{m(errors.seoDescription.message)}</p>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {children}

      {/* Action bar */}
      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 pt-2 border-t border-border">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isSubmitting}>
          {t('common.actions.cancel')}
        </Button>

        <div className="flex flex-col-reverse sm:flex-row gap-2">
          {isEdit ? (
            <>
              {canPublish && (
                <Button
                  type="submit"
                  variant="outline"
                  disabled={isBusy}
                  onClick={() => submitWith('publish')}
                >
                  {t('products.simple.savePublish')}
                </Button>
              )}
              <Button type="submit" disabled={isBusy} onClick={() => submitWith('save')}>
                {isSubmitting ? t('common.actions.saving') : t('common.actions.saveChanges')}
              </Button>
            </>
          ) : (
            <>
              <Button
                type="submit"
                variant="outline"
                disabled={isBusy}
                onClick={() => submitWith('draft')}
              >
                {t('products.wizard.saveDraft')}
              </Button>
              <Button type="submit" disabled={isBusy} onClick={() => submitWith('publish')}>
                {isSubmitting ? t('products.simple.publishing') : t('products.actions.publish')}
              </Button>
            </>
          )}
        </div>
      </div>
    </form>
  );
}
