import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus, Pencil, Trash2, Tag, ArrowLeft, Check } from 'lucide-react';
import { toast } from 'sonner';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetBody, SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent, EmptyMedia,
} from '@/components/ui/empty';
import { cn } from '@/lib/utils';
import { FlagBadge } from '@/components/customers/FlagBadge';
import {
  flagSchema, type FlagFormValues,
} from '@/components/customers/schemas/customer.schemas';
import {
  FLAG_COLOR_PRESETS, DEFAULT_FLAG_COLOR, FLAG_NAME_MAX, FLAG_DESCRIPTION_MAX,
  contrastColor,
} from '@/components/customers/customer.constants';
import { responsiveSheetProps } from '@/components/ui/responsive-sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTranslation, useMessage, useApiError } from '@/i18n';
import { createFlag, updateFlag, deleteFlag } from '@/services/customers.service';
import { ApiError } from '@/types/api';
import type { CustomerFlag } from '@/types/customers.types';

interface FlagsManagerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flags: CustomerFlag[];
  /** Called after any create/update/delete so the parent can refresh. */
  onChanged: () => void;
}

type EditorTarget = { mode: 'create' } | { mode: 'edit'; flag: CustomerFlag } | null;

export function FlagsManagerSheet({ open, onOpenChange, flags, onChanged }: FlagsManagerSheetProps) {
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const apiError = useApiError();
  const sheet = responsiveSheetProps(isMobile, 'sm:max-w-md');

  const [editor, setEditor] = useState<EditorTarget>(null);
  const [pendingDelete, setPendingDelete] = useState<CustomerFlag | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Reset to the list view whenever the sheet is re-opened.
  useEffect(() => {
    if (open) setEditor(null);
  }, [open]);

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteFlag(pendingDelete.id);
      toast.success(t('customers.toast.flagDeleted'));
      setPendingDelete(null);
      onChanged();
    } catch (err) {
      apiError.toast(err, { fallbackKey: 'customers.errors.deleteFlagFailed' });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={sheet.side} className={cn('p-0', sheet.className)}>
        <SheetHeader className="gap-1 border-b pr-12">
          <div className="flex items-center gap-2">
            {editor && (
              <button
                type="button"
                onClick={() => setEditor(null)}
                aria-label={t('customers.flags.back')}
                className="-ml-1 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent tap-target"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <SheetTitle>
              {editor?.mode === 'create'
                ? t('customers.flags.newFlag')
                : editor?.mode === 'edit'
                  ? t('customers.flags.editFlag')
                  : t('customers.flags.title')}
            </SheetTitle>
          </div>
          <SheetDescription>
            {editor
              ? t('customers.flags.editorDescription')
              : t('customers.flags.description')}
          </SheetDescription>
        </SheetHeader>

        {editor ? (
          <FlagEditor
            key={editor.mode === 'edit' ? editor.flag.id : 'create'}
            target={editor}
            onDone={() => {
              setEditor(null);
              onChanged();
            }}
            onCancel={() => setEditor(null)}
          />
        ) : (
          <>
            <SheetBody className="p-4">
              {flags.length === 0 ? (
                <Empty className="py-12">
                  <EmptyHeader>
                    <EmptyMedia variant="icon"><Tag className="h-6 w-6" /></EmptyMedia>
                    <EmptyTitle>{t('customers.flags.emptyTitle')}</EmptyTitle>
                    <EmptyDescription>
                      {t('customers.flags.emptyDescription')}
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button onClick={() => setEditor({ mode: 'create' })} className="gap-2">
                      <Plus className="h-4 w-4" /> {t('customers.flags.newFlag')}
                    </Button>
                  </EmptyContent>
                </Empty>
              ) : (
                <ul className="space-y-2">
                  {flags.map((flag) => (
                    <li
                      key={flag.id}
                      className="flex items-center gap-3 rounded-lg border p-3"
                    >
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-bold"
                        style={{ backgroundColor: flag.color, color: contrastColor(flag.color) }}
                      >
                        {flag.name.slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{flag.name}</p>
                        {flag.description && (
                          <p className="truncate text-xs text-muted-foreground">{flag.description}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditor({ mode: 'edit', flag })}
                        aria-label={t('customers.flags.editAria', { name: flag.name })}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent tap-target"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(flag)}
                        aria-label={t('customers.flags.deleteAria', { name: flag.name })}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive tap-target"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </SheetBody>

            {flags.length > 0 && (
              <SheetFooter className="border-t">
                <Button onClick={() => setEditor({ mode: 'create' })} className="gap-2">
                  <Plus className="h-4 w-4" /> {t('customers.flags.newFlag')}
                </Button>
              </SheetFooter>
            )}
          </>
        )}
      </SheetContent>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !deleting && !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('customers.flags.deleteTitle', { name: pendingDelete?.name ?? '' })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('customers.flags.deleteDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              {t('customers.flags.keepFlag')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              {t('customers.flags.deleteConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}

// ─── Create / edit form ───────────────────────────────────────────────────────

function FlagEditor({
  target, onDone, onCancel,
}: {
  target: Exclude<EditorTarget, null>;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const m = useMessage();
  const apiError = useApiError();
  const existing = target.mode === 'edit' ? target.flag : null;
  const {
    register, handleSubmit, watch, setValue, setError,
    formState: { errors, isSubmitting },
  } = useForm<FlagFormValues>({
    resolver: zodResolver(flagSchema),
    defaultValues: {
      name: existing?.name ?? '',
      color: existing?.color ?? DEFAULT_FLAG_COLOR,
      description: existing?.description ?? '',
    },
  });

  const color = watch('color');
  const name = watch('name');

  async function onSubmit(values: FlagFormValues) {
    const description = values.description?.trim() ? values.description.trim() : null;
    try {
      if (existing) {
        await updateFlag(existing.id, { name: values.name.trim(), color: values.color, description });
        toast.success(t('customers.toast.flagUpdated'));
      } else {
        await createFlag({ name: values.name.trim(), color: values.color, description });
        toast.success(t('customers.toast.flagCreated'));
      }
      onDone();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VENDOR_CUSTOMER_FLAG_DUPLICATE') {
        setError('name', { message: 'customers.flags.duplicateName' });
        return;
      }
      if (err instanceof ApiError) {
        // Field-level messages come back localized by code, never as backend prose.
        const fields = apiError.fields(err);
        for (const field of ['name', 'color', 'description'] as const) {
          if (fields[field]) setError(field, { message: fields[field] });
        }
      }
      apiError.toast(err, { fallbackKey: 'customers.errors.saveFlagFailed' });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
      <SheetBody className="space-y-5 p-4">
        {/* Live preview */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{t('customers.flags.preview')}</span>
          <FlagBadge
            flag={{
              name: name?.trim() || t('customers.flags.previewName'),
              color: color || DEFAULT_FLAG_COLOR,
            }}
          />
        </div>

        {/* Name */}
        <div className="space-y-1.5">
          <Label htmlFor="flag-name">
            {t('customers.flags.name')} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="flag-name"
            placeholder={t('customers.flags.namePlaceholder')}
            maxLength={FLAG_NAME_MAX}
            {...register('name')}
            aria-invalid={!!errors.name}
          />
          {errors.name && <p className="text-xs text-destructive">{m(errors.name.message)}</p>}
        </div>

        {/* Colour */}
        <div className="space-y-1.5">
          <Label>
            {t('customers.flags.colour')} <span className="text-destructive">*</span>
          </Label>
          <div className="flex flex-wrap gap-2">
            {FLAG_COLOR_PRESETS.map((preset) => {
              const active = color?.toLowerCase() === preset.value.toLowerCase();
              return (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setValue('color', preset.value, { shouldValidate: true })}
                  aria-label={t(preset.nameKey)}
                  className={cn(
                    'tap-target flex h-8 w-8 items-center justify-center rounded-full ring-offset-background transition',
                    active && 'ring-2 ring-ring ring-offset-2',
                  )}
                  style={{ backgroundColor: preset.value }}
                >
                  {active && <Check className="h-4 w-4" style={{ color: contrastColor(preset.value) }} />}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <input
              type="color"
              value={/^#([0-9a-fA-F]{6})$/.test(color ?? '') ? color : DEFAULT_FLAG_COLOR}
              onChange={(e) => setValue('color', e.target.value, { shouldValidate: true })}
              className="h-9 w-12 cursor-pointer rounded border bg-transparent p-1"
              aria-label={t('customers.flags.customColour')}
            />
            <Input
              value={color ?? ''}
              onChange={(e) => setValue('color', e.target.value, { shouldValidate: true })}
              placeholder="#FF8800"
              className="w-32 font-mono"
              aria-invalid={!!errors.color}
            />
          </div>
          {errors.color && <p className="text-xs text-destructive">{m(errors.color.message)}</p>}
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label htmlFor="flag-description">{t('customers.flags.descriptionLabel')}</Label>
          <Textarea
            id="flag-description"
            rows={3}
            maxLength={FLAG_DESCRIPTION_MAX}
            placeholder={t('customers.flags.descriptionPlaceholder')}
            {...register('description')}
            aria-invalid={!!errors.description}
          />
          {errors.description && (
            <p className="text-xs text-destructive">{m(errors.description.message)}</p>
          )}
        </div>
      </SheetBody>

      <SheetFooter className="flex-row justify-end gap-2 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          {t('common.actions.cancel')}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {existing ? t('common.actions.saveChanges') : t('customers.flags.create')}
        </Button>
      </SheetFooter>
    </form>
  );
}
