import { useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { AlertCircle, X, Plus, ChevronRight, ChevronLeft } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { basicInfoSchema, type BasicInfoFormValues } from '@/components/products/schemas/product.schemas';
import { useMessage, useTranslation } from '@/i18n';
import type { WizardState } from '@/types/product.types';

interface StepBasicInfoProps {
  mode: 'create' | 'edit';
  serverData: Partial<WizardState>;
  isSaving: boolean;
  stepError: string | null;
  onSaveComplete: (updates: Partial<WizardState>) => void;
  onBack: () => void;
}

export function StepBasicInfo({
  mode,
  serverData,
  isSaving,
  stepError,
  onSaveComplete,
  onBack,
}: StepBasicInfoProps) {
  const { t } = useTranslation();
  const m = useMessage();
  const product = serverData.serverProduct;
  const tagInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<z.input<typeof basicInfoSchema>, unknown, BasicInfoFormValues>({
    resolver: zodResolver(basicInfoSchema),
    defaultValues: {
      title: product?.title ?? '',
      category: product?.category ?? '',
      description: product?.description ?? '',
      tags: product?.tags ?? [],
      seoTitle: product?.seo?.title ?? '',
      seoDescription: product?.seo?.description ?? '',
    },
  });

  const tags = watch('tags') as string[];

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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{t('products.wizard.basicsTitle')}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t('products.wizard.basicsDescription')}
        </p>
      </div>

      {stepError && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{m(stepError)}</AlertDescription>
        </Alert>
      )}

      {/* Title */}
      <div className="space-y-1.5">
        <Label htmlFor="title">
          {t('products.wizard.productTitle')} <span className="text-destructive">*</span>
        </Label>
        <Input
          id="title"
          placeholder={t('products.wizard.productTitlePlaceholder')}
          {...register('title')}
          aria-invalid={!!errors.title}
        />
        {errors.title && <p className="text-xs text-destructive">{m(errors.title.message)}</p>}
      </div>

      {/* Category */}
      <div className="space-y-1.5">
        <Label htmlFor="category">
          {t('products.fields.category')} <span className="text-destructive">*</span>
        </Label>
        <Input
          id="category"
          placeholder={t('products.wizard.categoryPlaceholder')}
          {...register('category')}
          aria-invalid={!!errors.category}
        />
        {errors.category && <p className="text-xs text-destructive">{m(errors.category.message)}</p>}
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
          {...register('description')}
          aria-invalid={!!errors.description}
        />
        {errors.description && (
          <p className="text-xs text-destructive">{m(errors.description.message)}</p>
        )}
      </div>

      {/* Tags */}
      <div className="space-y-1.5">
        <Label>{t('products.fields.tags')}</Label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {(tags ?? []).map((tag, i) => (
            <Badge key={`${tag}-${i}`} variant="secondary" className="gap-1 text-xs">
              {tag}
              <button
                type="button"
                onClick={() => removeTag(i)}
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
            onKeyDown={onTagKeyDown}
          />
          <Button type="button" variant="outline" size="sm" onClick={addTag} className="gap-1.5 shrink-0">
            <Plus className="w-3.5 h-3.5" />
            {t('common.actions.add')}
          </Button>
        </div>
        {errors.tags?.root && <p className="text-xs text-destructive">{m(errors.tags.root.message)}</p>}
        {errors.tags?.message && <p className="text-xs text-destructive">{m(errors.tags.message as string)}</p>}
      </div>

      {/* SEO (collapsible section) */}
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
            placeholder={t('products.fields.seoTitlePlaceholderWizard')}
            maxLength={60}
            {...register('seoTitle')}
            aria-invalid={!!errors.seoTitle}
          />
          {errors.seoTitle && <p className="text-xs text-destructive">{m(errors.seoTitle.message)}</p>}
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
            {...register('seoDescription')}
            aria-invalid={!!errors.seoDescription}
          />
          {errors.seoDescription && (
            <p className="text-xs text-destructive">{m(errors.seoDescription.message)}</p>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button type="button" variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ChevronLeft className="w-4 h-4" />
          {t('common.actions.back')}
        </Button>
        <Button type="submit" disabled={isSaving} className="gap-1.5">
          {isSaving
            ? t('common.actions.saving')
            : t(mode === 'create' ? 'products.wizard.saveAndContinue' : 'common.actions.save')}
          {!isSaving && <ChevronRight className="w-4 h-4" />}
        </Button>
      </div>
    </form>
  );
}
