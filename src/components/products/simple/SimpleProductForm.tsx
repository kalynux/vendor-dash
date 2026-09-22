import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { InfoHint, LabelWithHint } from '@/components/ui/info-hint';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import {
  SettingsGroup,
  SettingsSection,
  SettingsSections,
} from '@/components/vendor-settings/SettingsSection';
import { DisclosureTrigger } from '@/components/products/form/DisclosureTrigger';
import { ProductMediaUpload } from '@/components/products/ProductMediaUpload';
import { ChatRichTextEditor } from '@/components/rich-text';
import { useTranslation, useMessage, useFormatters } from '@/i18n';
import { EMPTY_DOC, toPlainText, type RichDoc } from '@/lib/richtext';
import { PRODUCT_IMAGE_LIMIT } from '@/components/products/media.constants';
import { minCeilingFor } from '@/components/products/bargain';
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
   *
   * ⚠ Pass `SettingsSection`s (a fragment of them is fine). They land as direct
   * children of the form's `SettingsSections`, whose phone hairlines come from
   * `divide-y` — which only sees direct children, so loose markup here would sit
   * unseparated and unguttered between two sections.
   */
  children?: React.ReactNode;
  /**
   * Whether to offer the bargainable-pricing ceiling. The edit page passes the
   * product's `vectorisationEnabled` so the field appears under the AI-search
   * toggle it depends on; create passes nothing and always shows it, because a
   * brand-new product is never vectorisation-enabled yet the backend stores and
   * validates the window happily — it is simply inert until the flag is on.
   */
  showBargainField?: boolean;
}

const EMPTY_VALUES: SimpleProductFormValues = {
  title: '',
  category: '',
  description: '',
  descriptionRich: EMPTY_DOC,
  tags: [],
  seoTitle: '',
  seoDescription: '',
  fileIds: [],
  price: 0,
  compareAtPrice: undefined,
  bargainMaxPrice: undefined,
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

/**
 * A watched number field as a number, for display decisions only: a finite
 * number, or a string that parses to one. Empty and non-numeric input is "no
 * value" (`undefined`), never 0.
 */
function displayNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const n = Number(value.trim());
  return Number.isFinite(n) ? n : undefined;
}

/** An error under a field, in the one size every helper line on this page uses. */
function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm text-destructive">{message}</p>;
}

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
  showBargainField = true,
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
  // Display-only numbers for the hints and the preview. `register` hands back
  // what is in the input — a string once the vendor types — so a plain
  // `typeof === 'number'` check only ever passed for untouched edit values.
  // What is submitted is unaffected: the schema does its own coercion.
  const price = displayNumber(watch('price'));
  const compareAtPrice = displayNumber(watch('compareAtPrice'));
  const seoTitle = watch('seoTitle') ?? '';
  const seoDesc = watch('seoDescription') ?? '';
  const descriptionRich = watch('descriptionRich') as RichDoc;
  const titleValue = watch('title') ?? '';

  // The simple editor has the price right there in the form, so the preview can
  // show the message as it will actually go out — title, price, description.
  const { currency } = useFormatters();
  const previewPrice = typeof price === 'number' && price > 0 ? currency(price) : null;

  /** The negotiation floor this price implies — `null` until there is a price. */
  const minCeiling =
    typeof price === 'number' && price > 0 ? minCeilingFor(price) : null;

  const bargainMaxPrice = displayNumber(watch('bargainMaxPrice'));
  const hasAskingPrice = typeof bargainMaxPrice === 'number' && bargainMaxPrice > 0;

  /**
   * A compare-at price at or under the price is stored but never shown struck
   * through — say so under the pair rather than let it silently do nothing.
   */
  const compareAtTooLow =
    typeof compareAtPrice === 'number' &&
    typeof price === 'number' &&
    compareAtPrice > 0 &&
    compareAtPrice <= price;

  /**
   * The shop publishes `compareAtPrice` only when it is strictly ABOVE the asking
   * price — otherwise it would strike through a number lower than the live one.
   * So a vendor who sets an asking price above their compare-at silently loses
   * their "was" price, on a screen that never mentioned it. Warn, never block:
   * both values are legal and stored either way.
   */
  const compareAtHiddenByAsking =
    hasAskingPrice &&
    typeof compareAtPrice === 'number' &&
    compareAtPrice > 0 &&
    compareAtPrice <= (bargainMaxPrice as number);

  /** Keeps `description` a derived projection of the document. See StepBasicInfo. */
  function onDescriptionChange(doc: RichDoc) {
    setValue('descriptionRich', doc, { shouldValidate: false, shouldDirty: true });
    setValue('description', toPlainText(doc), { shouldValidate: true, shouldDirty: true });
  }

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

  /** Accessible name for a field's info icon: "About <label>". */
  const aboutLabel = (title: string) => t('account.section.aboutTitle', { title });

  const isBusy = isSubmitting || disabled;

  // Thumb-sized and full-width on a phone, the app's ordinary buttons above it.
  const actionButton = 'max-md:h-11 max-md:w-full';

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

      <SettingsSections>
        {/* ── Photos ─────────────────────────────────────────────────────── */}
        <SettingsSection
          title={t('products.fields.photos')}
          info={t('products.fields.photosHint', { max: PRODUCT_IMAGE_LIMIT.physical })}
          contentClassName="space-y-2"
        >
          <ProductMediaUpload
            existingFiles={existingFiles}
            maxFiles={PRODUCT_IMAGE_LIMIT.physical}
            disabled={isBusy}
            onMediaChange={(ids) => setValue('fileIds', ids, { shouldDirty: true })}
          />
          <FieldError message={m(errors.fileIds?.message as string | undefined)} />
        </SettingsSection>

        {/* ── Details ────────────────────────────────────────────────────── */}
        <SettingsSection title={t('products.simple.sectionDetails')} contentClassName="space-y-5">
          <div className="space-y-2">
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
            <FieldError message={m(errors.title?.message)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">
              {t('products.fields.description')} <span className="text-destructive">*</span>
            </Label>
            <ChatRichTextEditor
              id="description"
              value={descriptionRich}
              onChange={onDescriptionChange}
              previewTitle={titleValue}
              previewPrice={previewPrice}
              disabled={isBusy}
              invalid={!!errors.description}
            />
            <FieldError message={m(errors.description?.message)} />
          </div>

          <div className="space-y-2">
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
            <FieldError message={m(errors.category?.message)} />
          </div>
        </SettingsSection>

        {/* ── Price & stock ──────────────────────────────────────────────── */}
        <SettingsSection
          title={t('products.simple.sectionPriceStock')}
          contentClassName="space-y-5"
        >
          {/* Two short numbers — side by side even on a phone. */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                {/* `min-h-5` matches the info icon beside the compare-at label,
                    so the two inputs start on the same line. */}
                <Label htmlFor="price" className="min-h-5">
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
                {errors.price ? (
                  <FieldError message={m(errors.price.message)} />
                ) : (
                  // Under an asking price this number is never published — said
                  // here, under the field it describes, rather than under the
                  // asking price where "shoppers never see this" read as if it
                  // meant the asking price itself.
                  showBargainField &&
                  hasAskingPrice && (
                    <p className="text-sm text-muted-foreground">
                      {t('products.fields.bargainFloorHint')}
                    </p>
                  )
                )}
              </div>

              <div className="space-y-2">
                <LabelWithHint
                  htmlFor="compareAtPrice"
                  hint={t('products.fields.compareAtHigherHint')}
                  hintLabel={aboutLabel(t('products.fields.compareAtPrice'))}
                >
                  {t('products.fields.compareAtPrice')}
                </LabelWithHint>
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
                <FieldError message={m(errors.compareAtPrice?.message)} />
              </div>
            </div>
            {compareAtTooLow && !errors.compareAtPrice && (
              <p className="text-sm text-muted-foreground">
                {t('products.fields.compareAtTooLowHint')}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
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
                <FieldError message={m(errors.stock?.message)} />
              </div>
            </div>
            {/* Where the discrepancy is: the field above holds the server's
                figure, and this says what is still waiting on the agency. */}
            {stockNotice}
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-1">
                <Label htmlFor="isInfiniteStock">{t('products.fields.unlimitedStock')}</Label>
                {disableUnlimitedStock && (
                  <InfoHint label={aboutLabel(t('products.fields.unlimitedStock'))} align="start">
                    {t('products.fields.unlimitedStockLockedHint')}
                  </InfoHint>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {disableUnlimitedStock
                  ? t('products.fields.unlimitedStockLockedShort')
                  : t('products.fields.unlimitedStockHint')}
              </p>
            </div>
            <Switch
              id="isInfiniteStock"
              checked={isInfiniteStock === true}
              onCheckedChange={(checked) =>
                setValue('isInfiniteStock', checked, { shouldDirty: true })
              }
              disabled={isBusy || disableUnlimitedStock}
              aria-label={t('products.fields.unlimitedStock')}
            />
          </div>
        </SettingsSection>

        {children}

        {/* ── Asking price ───────────────────────────────────────────────────
            Placed after `children` deliberately: the edit page's last child is
            the AI-search section, so this lands directly beneath the toggle
            that governs it, while staying a field of this one form. */}
        {showBargainField && (
          <SettingsSection
            title={t('products.bargain.title')}
            info={t(isEdit ? 'products.fields.bargainHint' : 'products.fields.bargainInertHint')}
            contentClassName="space-y-2"
          >
            {/* Full width on a phone — half of one cut its placeholder off
                mid-word; half width, under the price column, from `md` up. The
                section title names the field, so the label is for assistive
                tech only. */}
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                id="bargainMaxPrice"
                type="number"
                // Not `min={minCeiling}`: the schema's superRefine already
                // enforces the floor with a translated message, and a native
                // `min` makes the browser block the submit with its own bubble
                // ("Value must be greater than or equal to 12000"), in the
                // browser's language, on top of it.
                min={0}
                step="any"
                inputMode="decimal"
                placeholder={t('products.fields.bargainOptional')}
                disabled={isBusy}
                {...register('bargainMaxPrice')}
                aria-label={t('products.fields.bargainMaxPrice')}
                aria-invalid={!!errors.bargainMaxPrice}
                aria-describedby="bargainMaxPrice-hint"
              />
            </div>
            {/* The floor moves with the price, so it is spelled out here rather
                than only in the error — guessing the number is the whole
                difficulty. Nothing to say until a price has been entered. */}
            {(errors.bargainMaxPrice || minCeiling !== null) && (
              <p
                id="bargainMaxPrice-hint"
                className={cn(
                  'text-sm',
                  errors.bargainMaxPrice ? 'text-destructive' : 'text-muted-foreground',
                )}
              >
                {errors.bargainMaxPrice
                  ? m(errors.bargainMaxPrice.message)
                  : t('products.bargain.ceilingMin', { min: currency(minCeiling as number) })}
              </p>
            )}
            {/* A consequence the vendor cannot see from this screen: what
                happens to the "was" price. */}
            {compareAtHiddenByAsking && (
              <p className="text-sm text-amber-700 dark:text-amber-400">
                {t('products.fields.bargainCompareAtHidden', {
                  max: currency(bargainMaxPrice as number),
                })}
              </p>
            )}
          </SettingsSection>
        )}

        {/* ── More options ───────────────────────────────────────────────────
            One plain disclosure row, drawn as a section of its own so the phone
            hairline and the desktop card come out the same as its neighbours'. */}
        <section className="md:rounded-xl md:border md:bg-card md:text-card-foreground md:shadow-sm">
          <Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
            {/* The same row the wizard steps use, padded out to the height of
                a section so it sits evenly between the phone hairlines and
                fills the desktop card. */}
            <DisclosureTrigger open={moreOpen} className="py-4 md:rounded-xl md:px-6 md:py-5">
              {t('products.fields.moreOptions')}
            </DisclosureTrigger>

            <CollapsibleContent className="space-y-8 pb-5 pt-1 md:px-6 md:pb-6">
              {/* SKU and — edit only — the inventory controls. */}
              <div className="space-y-5">
                <div className="space-y-2">
                  <LabelWithHint
                    htmlFor="sku"
                    hint={t(isEdit ? 'products.fields.skuHintEdit' : 'products.fields.skuHintCreate')}
                    hintLabel={aboutLabel(t('products.fields.sku'))}
                  >
                    {t('products.fields.sku')}
                  </LabelWithHint>
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
                  <FieldError message={m(errors.sku?.message)} />
                </div>

                {/* Edit-only inventory controls — not part of the create contract. */}
                {isEdit && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="lowStockThreshold">
                          {t('products.fields.lowStockAlertAt')}
                        </Label>
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
                        <FieldError message={m(errors.lowStockThreshold?.message)} />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0 space-y-1">
                        <Label htmlFor="allowOversell">{t('products.fields.allowOversell')}</Label>
                        <p className="text-sm text-muted-foreground">
                          {t('products.fields.allowOversellHint')}
                        </p>
                      </div>
                      <Switch
                        id="allowOversell"
                        checked={watch('allowOversell') === true}
                        onCheckedChange={(checked) =>
                          setValue('allowOversell', checked, { shouldDirty: true })
                        }
                        disabled={isBusy}
                        aria-label={t('products.fields.allowOversell')}
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label htmlFor="tagInput">{t('products.fields.tags')}</Label>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 pb-1">
                    {tags.map((tag, i) => (
                      // `overflow-visible` so the badge does not clip the ×'s
                      // touch halo; the text truncates on its own instead.
                      <Badge
                        key={`${tag}-${i}`}
                        variant="secondary"
                        className="max-w-full gap-1.5 overflow-visible py-1 pl-2.5 pr-1.5 text-sm font-normal"
                      >
                        <span className="min-w-0 truncate">{tag}</span>
                        <button
                          type="button"
                          onClick={() => removeTag(i)}
                          disabled={isBusy}
                          aria-label={t('products.fields.removeTag', { tag })}
                          className="tap-target rounded-full text-muted-foreground transition-colors hover:text-destructive"
                        >
                          <X className="size-3.5" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    id="tagInput"
                    ref={tagInputRef}
                    placeholder={t('products.fields.addTagPlaceholder')}
                    disabled={isBusy}
                    onKeyDown={onTagKeyDown}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addTag}
                    disabled={isBusy}
                    className="shrink-0 max-md:h-11"
                  >
                    {t('common.actions.add')}
                  </Button>
                </div>
                <FieldError message={m(errors.tags?.message as string | undefined)} />
              </div>

              {/* Shipping dimensions — four short numbers, 2×2 on a phone. */}
              <SettingsGroup title={t('products.fields.dimensionsTitle')}>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  {(
                    [
                      ['weight', 'products.fields.weightG'],
                      ['length', 'products.fields.lengthCm'],
                      ['width', 'products.fields.widthCm'],
                      ['height', 'products.fields.heightCm'],
                    ] as const
                  ).map(([field, labelKey]) => (
                    <div key={field} className="space-y-2">
                      <Label htmlFor={field} className="font-normal text-muted-foreground">
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
                      <FieldError message={m(errors[field]?.message)} />
                    </div>
                  ))}
                </div>
              </SettingsGroup>

              {/* SEO */}
              <SettingsGroup title={t('products.fields.seoTitle')} contentClassName="space-y-5">
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <Label htmlFor="seoTitle" className="font-normal text-muted-foreground">
                      {t('products.fields.seoTitleLabel')}
                    </Label>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {t('products.fields.charCount', { used: seoTitle.length, max: 60 })}
                    </span>
                  </div>
                  <Input
                    id="seoTitle"
                    placeholder={t('products.fields.seoTitlePlaceholder')}
                    maxLength={60}
                    disabled={isBusy}
                    {...register('seoTitle')}
                    aria-invalid={!!errors.seoTitle}
                  />
                  <FieldError message={m(errors.seoTitle?.message)} />
                </div>

                <div className="space-y-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <Label htmlFor="seoDescription" className="font-normal text-muted-foreground">
                      {t('products.fields.seoDescriptionLabel')}
                    </Label>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {t('products.fields.charCount', { used: seoDesc.length, max: 160 })}
                    </span>
                  </div>
                  <Textarea
                    id="seoDescription"
                    placeholder={t('products.fields.seoDescriptionPlaceholder')}
                    maxLength={160}
                    rows={3}
                    disabled={isBusy}
                    {...register('seoDescription')}
                    aria-invalid={!!errors.seoDescription}
                  />
                  <FieldError message={m(errors.seoDescription?.message)} />
                </div>
              </SettingsGroup>
            </CollapsibleContent>
          </Collapsible>
        </section>
      </SettingsSections>

      {/* Action bar. DOM order is cancel → secondary → primary, which is the
          wide-screen reading order; a phone reverses it so the primary lands on
          top, under the thumb, and the quiet cancel at the bottom. The hairline
          continues the sections' separators — there is no card to end on. */}
      <div className="flex flex-col-reverse gap-2 max-md:!mt-0 max-md:border-t max-md:pt-5 md:flex-row md:items-center md:justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={isSubmitting}
          className={actionButton}
        >
          {t('common.actions.cancel')}
        </Button>

        <div className="flex flex-col-reverse gap-2 md:flex-row">
          {isEdit ? (
            <>
              {canPublish && (
                <Button
                  type="submit"
                  variant="outline"
                  disabled={isBusy}
                  onClick={() => submitWith('publish')}
                  className={actionButton}
                >
                  {t('products.simple.savePublish')}
                </Button>
              )}
              <Button
                type="submit"
                disabled={isBusy}
                onClick={() => submitWith('save')}
                className={actionButton}
              >
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
                className={actionButton}
              >
                {t('products.wizard.saveDraft')}
              </Button>
              <Button
                type="submit"
                disabled={isBusy}
                onClick={() => submitWith('publish')}
                className={actionButton}
              >
                {isSubmitting ? t('products.simple.publishing') : t('products.actions.publish')}
              </Button>
            </>
          )}
        </div>
      </div>
    </form>
  );
}
