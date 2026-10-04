import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { X, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { ChatRichTextEditor } from '@/components/rich-text';
import { SettingsSection, SettingsSections } from '@/components/vendor-settings/SettingsSection';
import { basicInfoSchema, type BasicInfoFormValues } from '@/components/products/schemas/product.schemas';
import { useMessage, useTranslation } from '@/i18n';
import { hydrateDoc, toPlainText, type RichDoc } from '@/lib/richtext';
import type { ApiFileDetail, WizardState } from '@/types/product.types';
import { DisclosureTrigger } from '@/components/products/form/DisclosureTrigger';
import { StepActions, StepError } from './StepLayout';
import { CategoryPicker } from '@/components/products/categories/CategoryPicker';
import { fromProductCategories } from '@/services/categories.service';
import type { CategoryEntry } from '@/types/category.types';
import { ListingCopyAssistant, type ListingCopyApplied } from '@/components/ai-copy/ListingCopyAssistant';
import { PRODUCT_IMAGE_LIMIT } from '@/components/products/media.constants';

interface StepBasicInfoProps {
  mode: 'create' | 'edit';
  serverData: Partial<WizardState>;
  isSaving: boolean;
  stepError: string | null;
  onSaveComplete: (updates: Partial<WizardState>) => void;
  onBack: () => void;
  /**
   * The chips after the vendor answered "Did you mean …?". The page owns the
   * save, so it hands the rewritten list back here; a later save then sends
   * the answers instead of asking the same question again.
   */
  resolvedCategories?: CategoryEntry[] | null;
  /**
   * Photos picked in the "Generate" popup before the product had any. The page
   * keeps them so the photo step opens with them already in place.
   */
  aiPhotos?: ApiFileDetail[];
  onAiPhotosPicked?: (files: ApiFileDetail[]) => void;
}

export function StepBasicInfo({
  mode,
  serverData,
  isSaving,
  stepError,
  onSaveComplete,
  onBack,
  resolvedCategories,
  aiPhotos,
  onAiPhotosPicked,
}: StepBasicInfoProps) {
  const { t } = useTranslation();
  const m = useMessage();
  const product = serverData.serverProduct;
  const tagInputRef = useRef<HTMLInputElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<z.input<typeof basicInfoSchema>, unknown, BasicInfoFormValues>({
    resolver: zodResolver(basicInfoSchema),
    defaultValues: {
      title: product?.title ?? '',
      categories: fromProductCategories(product?.categories),
      description: product?.description ?? '',
      // A saved rich document wins; otherwise the plain description is parsed
      // back into one, so a product written before this editor existed opens
      // with its paragraphs and lists intact.
      descriptionRich: hydrateDoc(product?.descriptionRich, product?.description),
      tags: product?.tags ?? [],
      seoTitle: product?.seo?.title ?? '',
      seoDescription: product?.seo?.description ?? '',
    },
  });

  useEffect(() => {
    if (resolvedCategories) setValue('categories', resolvedCategories, { shouldDirty: true });
  }, [resolvedCategories, setValue]);

  const tags = watch('tags') as string[];
  const descriptionRich = watch('descriptionRich') as RichDoc;
  const titleValue = watch('title') ?? '';

  /**
   * The editor owns both halves of the description.
   *
   * `description` is derived here rather than being typed into, so the plain
   * projection and the document can never drift apart — a `description` that is
   * not `toPlainText(doc)` would be shown to customers on the storefront.
   * `shouldValidate` keeps the required-field error clearing as the vendor types,
   * exactly as the old textarea did.
   */
  function onDescriptionChange(doc: RichDoc) {
    setValue('descriptionRich', doc, { shouldValidate: false });
    setValue('description', toPlainText(doc), { shouldValidate: true, shouldDirty: true });
  }

  const productType = serverData.productType ?? 'physical';
  const savedPhotos = product && 'files' in product ? product.files : [];

  function applyGenerated(applied: ListingCopyApplied) {
    const opts = { shouldValidate: true, shouldDirty: true };
    if (applied.title) setValue('title', applied.title, opts);
    if (applied.categories) setValue('categories', applied.categories, opts);
    if (applied.descriptionRich) onDescriptionChange(applied.descriptionRich);
    if (applied.tags) {
      // Added to the vendor's own tags, never replacing them.
      const current = (getValues('tags') ?? []) as string[];
      const have = new Set(current.map((tag) => tag.toLowerCase()));
      setValue('tags', [...current, ...applied.tags.filter((tag) => !have.has(tag.toLowerCase()))], opts);
    }
    if (applied.seoTitle) setValue('seoTitle', applied.seoTitle, opts);
    if (applied.seoDescription) setValue('seoDescription', applied.seoDescription, opts);
    // Tags and SEO live behind "More options" — open it so the vendor sees them.
    if (applied.tags || applied.seoTitle || applied.seoDescription) setMoreOpen(true);
    if (applied.photos) onAiPhotosPicked?.(applied.photos);
  }

  function addTag() {
    const input = tagInputRef.current;
    if (!input) return;
    const value = input.value.trim();
    if (!value) return;
    if (tags.includes(value)) return;
    setValue('tags', [...tags, value], { shouldValidate: true });
    input.value = '';
  }

  function removeTag(index: number) {
    setValue('tags', tags.filter((_, i) => i !== index), { shouldValidate: true });
  }

  function onTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    }
  }

  function onSubmit(values: BasicInfoFormValues) {
    onSaveComplete({ _basicInfoValues: values } as Partial<WizardState> & { _basicInfoValues: BasicInfoFormValues });
  }

  const seoTitle = watch('seoTitle') ?? '';
  const seoDesc = watch('seoDescription') ?? '';

  // Tags and SEO sit behind "More options". A validation error in one of them
  // must never be hidden behind a closed disclosure, so it forces it open.
  const hiddenFieldError = !!(errors.tags || errors.seoTitle || errors.seoDescription);
  const showMore = moreOpen || hiddenFieldError;

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <StepError error={stepError} />

      <SettingsSections>
        <SettingsSection
          title={t('products.wizard.basicsTitle')}
          // "You can update these later" only means something before the
          // product exists; on the edit page it is two lines of nothing.
          description={mode === 'create' ? t('products.wizard.basicsDescription') : undefined}
          contentClassName="space-y-5"
        >
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">
              {t('products.wizard.productTitle')} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              placeholder={t('products.wizard.productTitlePlaceholder')}
              {...register('title')}
              aria-invalid={!!errors.title}
            />
            {errors.title && <p className="text-sm text-destructive">{m(errors.title.message)}</p>}
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="categories">
              {t('products.categories.label')} <span className="text-destructive">*</span>
            </Label>
            <Controller
              control={control}
              name="categories"
              render={({ field }) => (
                <CategoryPicker
                  id="categories"
                  value={field.value as CategoryEntry[]}
                  onChange={field.onChange}
                  invalid={!!errors.categories}
                  describedBy={errors.categories ? 'categories-error' : undefined}
                />
              )}
            />
            {errors.categories && (
              <p id="categories-error" className="text-sm text-destructive">
                {m(errors.categories.message ?? errors.categories.root?.message)}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="description">
                {t('products.fields.description')} <span className="text-destructive">*</span>
              </Label>
              <ListingCopyAssistant
                target="product"
                productType={productType}
                listingId={product?.id}
                photoLimit={PRODUCT_IMAGE_LIMIT[productType]}
                getSnapshot={() => ({
                  title: getValues('title') ?? '',
                  categories: (getValues('categories') ?? []) as CategoryEntry[],
                  photos: savedPhotos.length > 0 ? savedPhotos : (aiPhotos ?? []),
                })}
                onApply={applyGenerated}
              />
            </div>
            <ChatRichTextEditor
              id="description"
              value={descriptionRich}
              onChange={onDescriptionChange}
              previewTitle={titleValue}
              invalid={!!errors.description}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{m(errors.description.message)}</p>
            )}
          </div>

          {/* Tags + SEO — rarely touched, so folded away */}
          <Collapsible open={showMore} onOpenChange={setMoreOpen} className="border-t border-border">
            <DisclosureTrigger open={showMore} className="py-2">
              {t('products.fields.moreOptions')}
            </DisclosureTrigger>

            <CollapsibleContent className="space-y-5 pb-1 pt-3">
              {/* Tags */}
              <div className="space-y-2">
                <Label htmlFor="tag-input">{t('products.fields.tags')}</Label>
                {(tags ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {(tags ?? []).map((tag, i) => (
                      <Badge
                        key={`${tag}-${i}`}
                        variant="secondary"
                        className="gap-1 py-1 pl-2.5 pr-1.5 text-sm font-normal"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTag(i)}
                          aria-label={t('products.fields.removeTag', { tag })}
                          className="tap-target rounded-sm text-muted-foreground transition-colors hover:text-destructive"
                        >
                          <X className="size-3.5" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    id="tag-input"
                    ref={tagInputRef}
                    placeholder={t('products.fields.addTagPlaceholder')}
                    onKeyDown={onTagKeyDown}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addTag}
                    className="shrink-0 max-md:h-11"
                  >
                    {t('common.actions.add')}
                  </Button>
                </div>
                {errors.tags?.root && (
                  <p className="text-sm text-destructive">{m(errors.tags.root.message)}</p>
                )}
                {errors.tags?.message && (
                  <p className="text-sm text-destructive">{m(errors.tags.message as string)}</p>
                )}
              </div>

              {/* SEO title */}
              <div className="space-y-2">
                <div className="flex items-baseline justify-between gap-3">
                  <Label htmlFor="seoTitle">{t('products.fields.seoTitleLabel')}</Label>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {t('products.fields.charCount', { used: seoTitle.length, max: 60 })}
                  </span>
                </div>
                <Input
                  id="seoTitle"
                  placeholder={t('products.fields.seoTitlePlaceholderWizard')}
                  maxLength={60}
                  {...register('seoTitle')}
                  aria-invalid={!!errors.seoTitle}
                />
                {errors.seoTitle && (
                  <p className="text-sm text-destructive">{m(errors.seoTitle.message)}</p>
                )}
              </div>

              {/* SEO description */}
              <div className="space-y-2">
                <div className="flex items-baseline justify-between gap-3">
                  <Label htmlFor="seoDescription">{t('products.fields.seoDescriptionLabel')}</Label>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {t('products.fields.charCount', { used: seoDesc.length, max: 160 })}
                  </span>
                </div>
                <Textarea
                  id="seoDescription"
                  placeholder={t('products.fields.seoDescriptionPlaceholder')}
                  maxLength={160}
                  rows={3}
                  {...register('seoDescription')}
                  aria-invalid={!!errors.seoDescription}
                />
                {errors.seoDescription && (
                  <p className="text-sm text-destructive">{m(errors.seoDescription.message)}</p>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </SettingsSection>
      </SettingsSections>

      <StepActions onBack={onBack}>
        <Button type="submit" disabled={isSaving} className="gap-1.5">
          {isSaving
            ? t('common.actions.saving')
            : t(mode === 'create' ? 'products.wizard.saveAndContinue' : 'common.actions.save')}
          {!isSaving && <ChevronRight className="size-4" />}
        </Button>
      </StepActions>
    </form>
  );
}
