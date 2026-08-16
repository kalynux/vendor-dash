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
import { ChatRichTextEditor } from '@/components/rich-text';
import { toPlainText, type RichDoc } from '@/lib/richtext';
import { useTranslation, useMessage } from '@/i18n';
import {
  SEO_TITLE_MAX, SEO_DESCRIPTION_MAX,
} from '@/components/services/service.constants';
import {
  serviceBasicsSchema, type ServiceBasicsFormValues,
} from '@/components/services/schemas/service.schemas';

interface StepServiceBasicsProps {
  defaultValues: ServiceBasicsFormValues;
  isSaving: boolean;
  stepError: string | null;
  onSaveComplete: (values: ServiceBasicsFormValues) => void;
  /** Back on the first step leaves the wizard. */
  onBack: () => void;
  mode?: 'create' | 'edit';
}

export function StepServiceBasics({
  defaultValues,
  isSaving,
  stepError,
  onSaveComplete,
  onBack,
  mode = 'create',
}: StepServiceBasicsProps) {
  const { t } = useTranslation();
  const m = useMessage();
  const tagInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    // Three generics because `descriptionRich` carries a zod `.default()`, so the
    // form's input type (field optional) and its output type (field guaranteed)
    // are no longer the same — the same shape the product forms already use.
  } = useForm<z.input<typeof serviceBasicsSchema>, unknown, ServiceBasicsFormValues>({
    resolver: zodResolver(serviceBasicsSchema),
    defaultValues,
  });

  const tags = watch('tags') as string[];
  const descriptionRich = watch('descriptionRich') as RichDoc;
  const titleValue = watch('title') ?? '';

  /** Keeps `description` a derived projection of the document. See StepBasicInfo. */
  function onDescriptionChange(doc: RichDoc) {
    setValue('descriptionRich', doc, { shouldValidate: false });
    setValue('description', toPlainText(doc), { shouldValidate: true, shouldDirty: true });
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

  const seoTitle = watch('seoTitle') ?? '';
  const seoDesc = watch('seoDescription') ?? '';

  return (
    <form onSubmit={handleSubmit(onSaveComplete)} className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{t('services.basics.title')}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t('services.basics.description')}
        </p>
      </div>

      {stepError && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{stepError}</AlertDescription>
        </Alert>
      )}

      {/* Title */}
      <div className="space-y-1.5">
        <Label htmlFor="title">
          {t('services.basics.name')} <span className="text-destructive">*</span>
        </Label>
        <Input
          id="title"
          placeholder={t('services.basics.namePlaceholder')}
          {...register('title')}
          aria-invalid={!!errors.title}
        />
        {errors.title && <p className="text-xs text-destructive">{m(errors.title.message)}</p>}
      </div>

      {/* Category */}
      <div className="space-y-1.5">
        <Label htmlFor="category">
          {t('services.basics.category')} <span className="text-destructive">*</span>
        </Label>
        <Input
          id="category"
          placeholder={t('services.basics.categoryPlaceholder')}
          {...register('category')}
          aria-invalid={!!errors.category}
        />
        {errors.category && <p className="text-xs text-destructive">{m(errors.category.message)}</p>}
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="description">
          {t('services.basics.descriptionLabel')} <span className="text-destructive">*</span>
        </Label>
        <ChatRichTextEditor
          id="description"
          value={descriptionRich}
          onChange={onDescriptionChange}
          previewTitle={titleValue}
          invalid={!!errors.description}
        />
        {errors.description && (
          <p className="text-xs text-destructive">{m(errors.description.message)}</p>
        )}
      </div>

      {/* Tags */}
      <div className="space-y-1.5">
        <Label>{t('services.basics.tags')}</Label>
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
            placeholder={t('services.basics.tagPlaceholder')}
            className="h-8"
            onKeyDown={onTagKeyDown}
          />
          <Button type="button" variant="outline" size="sm" onClick={addTag} className="gap-1.5 shrink-0">
            <Plus className="w-3.5 h-3.5" />
            {t('common.actions.add')}
          </Button>
        </div>
        {errors.tags?.root && <p className="text-xs text-destructive">{m(errors.tags.root.message)}</p>}
        {errors.tags?.message && (
          <p className="text-xs text-destructive">{m(errors.tags.message as string)}</p>
        )}
      </div>

      {/* SEO (optional) */}
      <div className="rounded-lg border border-border p-4 space-y-4">
        <p className="text-sm font-medium">{t('services.basics.seoSection')}</p>

        <div className="space-y-1.5">
          <Label htmlFor="seoTitle" className="text-xs text-muted-foreground">
            {t('services.basics.seoTitle')}{' '}
            <span className="text-muted-foreground/60">
              {t('services.basics.charCount', { current: seoTitle.length, max: SEO_TITLE_MAX })}
            </span>
          </Label>
          <Input
            id="seoTitle"
            placeholder={t('services.basics.seoTitlePlaceholder')}
            maxLength={SEO_TITLE_MAX}
            {...register('seoTitle')}
            aria-invalid={!!errors.seoTitle}
          />
          {errors.seoTitle && <p className="text-xs text-destructive">{m(errors.seoTitle.message)}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="seoDescription" className="text-xs text-muted-foreground">
            {t('services.basics.seoDescription')}{' '}
            <span className="text-muted-foreground/60">
              {t('services.basics.charCount', {
                current: seoDesc.length,
                max: SEO_DESCRIPTION_MAX,
              })}
            </span>
          </Label>
          <Textarea
            id="seoDescription"
            placeholder={t('services.basics.seoDescriptionPlaceholder')}
            maxLength={SEO_DESCRIPTION_MAX}
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
            : mode === 'edit'
              ? t('common.actions.save')
              : t('services.wizard.saveAndContinue')}
          {!isSaving && <ChevronRight className="w-4 h-4" />}
        </Button>
      </div>
    </form>
  );
}
