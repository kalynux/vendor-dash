import { useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, X, Plus, ChevronRight, ChevronLeft } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
  const tagInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ServiceBasicsFormValues>({
    resolver: zodResolver(serviceBasicsSchema),
    defaultValues,
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

  const seoTitle = watch('seoTitle') ?? '';
  const seoDesc = watch('seoDescription') ?? '';

  return (
    <form onSubmit={handleSubmit(onSaveComplete)} className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Service details</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Core details about your bookable service. You can update these later.
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
          Service name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="title"
          placeholder="e.g. 1-Hour Consultation"
          {...register('title')}
          aria-invalid={!!errors.title}
        />
        {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
      </div>

      {/* Category */}
      <div className="space-y-1.5">
        <Label htmlFor="category">
          Category <span className="text-destructive">*</span>
        </Label>
        <Input
          id="category"
          placeholder="e.g. Coaching, Consulting, Wellness"
          {...register('category')}
          aria-invalid={!!errors.category}
        />
        {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="description">
          Description <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="description"
          placeholder="What does this booking include?"
          rows={4}
          {...register('description')}
          aria-invalid={!!errors.description}
        />
        {errors.description && (
          <p className="text-xs text-destructive">{errors.description.message}</p>
        )}
      </div>

      {/* Tags */}
      <div className="space-y-1.5">
        <Label>Tags</Label>
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
            placeholder="Add tag, press Enter or comma"
            className="h-8"
            onKeyDown={onTagKeyDown}
          />
          <Button type="button" variant="outline" size="sm" onClick={addTag} className="gap-1.5 shrink-0">
            <Plus className="w-3.5 h-3.5" />
            Add
          </Button>
        </div>
        {errors.tags?.root && <p className="text-xs text-destructive">{errors.tags.root.message}</p>}
        {errors.tags?.message && <p className="text-xs text-destructive">{errors.tags.message as string}</p>}
      </div>

      {/* SEO (optional) */}
      <div className="rounded-lg border border-border p-4 space-y-4">
        <p className="text-sm font-medium">SEO (optional)</p>

        <div className="space-y-1.5">
          <Label htmlFor="seoTitle" className="text-xs text-muted-foreground">
            SEO title <span className="text-muted-foreground/60">({seoTitle.length}/60)</span>
          </Label>
          <Input
            id="seoTitle"
            placeholder="Leave blank to use service name"
            maxLength={60}
            {...register('seoTitle')}
            aria-invalid={!!errors.seoTitle}
          />
          {errors.seoTitle && <p className="text-xs text-destructive">{errors.seoTitle.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="seoDescription" className="text-xs text-muted-foreground">
            SEO description <span className="text-muted-foreground/60">({seoDesc.length}/160)</span>
          </Label>
          <Textarea
            id="seoDescription"
            placeholder="Brief description for search engines"
            maxLength={160}
            rows={2}
            {...register('seoDescription')}
            aria-invalid={!!errors.seoDescription}
          />
          {errors.seoDescription && (
            <p className="text-xs text-destructive">{errors.seoDescription.message}</p>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button type="button" variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ChevronLeft className="w-4 h-4" />
          Back
        </Button>
        <Button type="submit" disabled={isSaving} className="gap-1.5">
          {isSaving ? 'Saving…' : mode === 'edit' ? 'Save' : 'Save & Continue'}
          {!isSaving && <ChevronRight className="w-4 h-4" />}
        </Button>
      </div>
    </form>
  );
}
