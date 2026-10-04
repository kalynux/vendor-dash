import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ImagePlus, RefreshCw, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ResponsiveModal } from '@/components/services/ResponsiveModal';
import { MediaPicker } from '@/components/features/MediaPicker';
import { CategoryPicker } from '@/components/products/categories/CategoryPicker';
import { useApiError, useFormatters, useLocale, useTranslation, type TranslationKey } from '@/i18n';
import { LOCALES } from '@/i18n/config';
import { cn } from '@/lib/utils';
import type { RichDoc } from '@/lib/richtext';
import { fetchCreditBalance } from '@/services/billing.service';
import {
  AI_COPY_FIELD_COST,
  AI_COPY_MAX_IMAGES,
  AI_COPY_NOTES_MAX,
  fetchAiCopyFieldCost,
  generateListingCopy,
} from '@/services/ai-copy.service';
import { ApiError } from '@/types/api';
import {
  AI_COPY_ERROR,
  type AiCopyField,
  type AiCopyLanguage,
  type AiCopyResults,
  type AiCopyTarget,
} from '@/types/ai-copy.types';
import type { CategoryEntry } from '@/types/category.types';
import type { ApiFile } from '@/types/file.types';
import type { ApiFileDetail, ApiProductType } from '@/types/product.types';
import { RichDocView } from './RichDocView';

/** A photo the listing already has — only what the popup shows and sends. */
export interface ListingCopyPhoto {
  id: string;
  url: string | null;
}

/** What the form holds at the moment the vendor presses "Generate". */
export interface ListingCopySnapshot {
  title: string;
  categories: CategoryEntry[];
  /** The listing's photos so far. Empty → the dialog asks for some. */
  photos: ListingCopyPhoto[];
}

/** What to write back into the form. Only the keys present change anything. */
export interface ListingCopyApplied {
  /** Set when the vendor typed the name in the dialog. */
  title?: string;
  categories?: CategoryEntry[];
  descriptionRich?: RichDoc;
  tags?: string[];
  seoTitle?: string;
  seoDescription?: string;
  /** Photos picked in the dialog — they become the listing's photos. */
  photos?: ApiFileDetail[];
}

interface ListingCopyAssistantProps {
  target: AiCopyTarget;
  productType?: ApiProductType;
  /** Edit pages only. */
  listingId?: string | null;
  /** How many photos the listing itself can hold. */
  photoLimit: number;
  /** Read at the moment the button is pressed, so the dialog sees the live form. */
  getSnapshot: () => ListingCopySnapshot;
  onApply: (applied: ListingCopyApplied) => void;
  disabled?: boolean;
}

const OUTPUT_FIELDS: AiCopyField[] = ['description', 'tags', 'seoTitle', 'seoDescription', 'categories'];

const FIELD_LABEL: Record<AiCopyField, TranslationKey> = {
  description: 'aiCopy.fields.description',
  tags: 'aiCopy.fields.tags',
  seoTitle: 'aiCopy.fields.seoTitle',
  seoDescription: 'aiCopy.fields.seoDescription',
  categories: 'aiCopy.fields.categories',
};

const LANGUAGES: AiCopyLanguage[] = ['en', 'fr', 'es', 'pt', 'ar'];

const LANGUAGE_STORAGE_KEY = 'wi-vendor.aiCopy.language';

function readStoredLanguage(): AiCopyLanguage | null {
  try {
    const value = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return LANGUAGES.includes(value as AiCopyLanguage) ? (value as AiCopyLanguage) : null;
  } catch {
    return null;
  }
}

function storeLanguage(value: AiCopyLanguage) {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, value);
  } catch {
    // A remembered language is a convenience; without storage it just resets.
  }
}

function toFileDetail(file: ApiFile): ApiFileDetail {
  return {
    id: file.id,
    key: file.key,
    url: file.url ?? null,
    access: file.access ?? 'public',
    mimeType: file.mimeType,
    size: file.size,
    ...(file.originalName ? { originalName: file.originalName } : {}),
  };
}

type Phase = 'form' | 'writing' | 'results';

interface ErrorState {
  message: string;
  /** The wallet is short — the message gets a "Top up" link. */
  topUp?: boolean;
  /** The photo the server could not use — outlined in red. */
  badPhotoId?: string;
}

/**
 * The "Generate" button that sits on the description label, and the popup
 * (bottom sheet on a phone) behind it.
 *
 * The popup only asks for what the form is missing: a name when there is none,
 * photos when the listing has none yet (and those photos then become the
 * listing's photos), the category when none is chosen. Everything the AI writes
 * is shown first and goes into the form only when the vendor presses "Use
 * selected" — nothing they typed is overwritten behind their back.
 */
export function ListingCopyAssistant({
  target,
  productType,
  listingId,
  photoLimit,
  getSnapshot,
  onApply,
  disabled,
}: ListingCopyAssistantProps) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const fmt = useFormatters();
  const apiError = useApiError();

  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>('form');
  const [snapshot, setSnapshot] = useState<ListingCopySnapshot>({ title: '', categories: [], photos: [] });

  // Form
  const [name, setName] = useState('');
  const [categories, setCategories] = useState<CategoryEntry[]>([]);
  const [pickedPhotos, setPickedPhotos] = useState<ApiFileDetail[]>([]);
  const [notes, setNotes] = useState('');
  const [language, setLanguage] = useState<AiCopyLanguage>('en');
  const [fields, setFields] = useState<Set<AiCopyField>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  // Results
  const [results, setResults] = useState<Partial<AiCopyResults>>({});
  const [failed, setFailed] = useState<Set<AiCopyField>>(new Set());
  const [keep, setKeep] = useState<Set<AiCopyField>>(new Set());
  const [regenerating, setRegenerating] = useState<AiCopyField | null>(null);
  const [lastCharge, setLastCharge] = useState<number | null>(null);

  const [balance, setBalance] = useState<number | null>(null);
  const [fieldCost, setFieldCost] = useState(AI_COPY_FIELD_COST);
  const [error, setError] = useState<ErrorState | null>(null);

  const hostHasName = snapshot.title.trim().length > 0;
  const hostHasCategory = snapshot.categories.length > 0;
  const hostHasPhotos = snapshot.photos.length > 0;
  const photos = hostHasPhotos ? snapshot.photos : pickedPhotos;
  const photoCap = Math.min(photoLimit, AI_COPY_MAX_IMAGES);
  // A category chosen here (or already on the form) is input, not output.
  const categoryKnown = hostHasCategory || categories.length > 0;
  const offeredFields = OUTPUT_FIELDS.filter((f) => f !== 'categories' || !categoryKnown);
  const requestedFields = offeredFields.filter((f) => fields.has(f));
  const cost = requestedFields.length * fieldCost;
  const shortOfCredits = balance !== null && balance < cost;

  const title = (hostHasName ? snapshot.title : name).trim();
  const nameMissing = title.length === 0;
  const photosMissing = photos.length === 0;

  function handleOpen() {
    const snap = getSnapshot();
    setSnapshot(snap);
    setName('');
    setCategories([]);
    setPickedPhotos([]);
    setNotes('');
    setLanguage(readStoredLanguage() ?? (LANGUAGES.includes(locale as AiCopyLanguage) ? (locale as AiCopyLanguage) : 'en'));
    setFields(new Set(OUTPUT_FIELDS));
    setShowErrors(false);
    setResults({});
    setFailed(new Set());
    setKeep(new Set());
    setLastCharge(null);
    setError(null);
    setPhase('form');
    setOpen(true);

    setBalance(null);
    fetchCreditBalance()
      .then(setBalance)
      .catch(() => {
        // Unknown balance: the server still refuses a short wallet, and says so.
      });
    void fetchAiCopyFieldCost().then(setFieldCost);
  }

  function toggleField(field: AiCopyField, on: boolean) {
    setFields((prev) => {
      const next = new Set(prev);
      if (on) next.add(field);
      else next.delete(field);
      return next;
    });
  }

  function errorFor(err: unknown): ErrorState {
    const code = err instanceof ApiError ? err.code : null;
    switch (code) {
      case AI_COPY_ERROR.INSUFFICIENT_CREDITS:
        return { message: t('aiCopy.errors.insufficient'), topUp: true };
      case AI_COPY_ERROR.IMAGE_INVALID: {
        // `details: { fileId, reason }` — point at the photo rather than make the vendor guess.
        const fileId = (err as ApiError).detailsObject?.fileId;
        return { message: t('aiCopy.errors.image'), ...(typeof fileId === 'string' ? { badPhotoId: fileId } : {}) };
      }
      case AI_COPY_ERROR.UNAVAILABLE:
        return { message: t('aiCopy.errors.unavailable') };
      case AI_COPY_ERROR.RATE_LIMITED:
        return { message: t('aiCopy.errors.rateLimited') };
      case AI_COPY_ERROR.FAILED:
        return { message: t('aiCopy.errors.failed') };
      default:
        return { message: apiError.resolve(err, { fallbackKey: 'aiCopy.errors.failed' }) };
    }
  }

  function buildRequest(requested: AiCopyField[], previous?: Partial<AiCopyResults>) {
    const chosen = hostHasCategory ? snapshot.categories : categories;
    return {
      target,
      ...(target === 'product' && productType ? { productType } : {}),
      ...(listingId ? { listingId } : {}),
      language,
      fields: requested,
      input: {
        title,
        categories: chosen.map((c) => ('id' in c ? { id: c.id, name: c.name } : { name: c.name })),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        imageFileIds: photos.slice(0, AI_COPY_MAX_IMAGES).map((p) => p.id),
      },
      ...(previous ? { previous } : {}),
    };
  }

  async function handleGenerate() {
    setShowErrors(true);
    if (nameMissing || photosMissing || requestedFields.length === 0 || shortOfCredits) return;

    storeLanguage(language);
    setError(null);
    setPhase('writing');
    try {
      const data = await generateListingCopy(buildRequest(requestedFields));
      setResults(data.results);
      setFailed(new Set(data.failed));
      setKeep(new Set(requestedFields.filter((f) => data.results[f] !== undefined)));
      setBalance(data.balance);
      setLastCharge(data.creditsCharged);
      setPhase('results');
    } catch (err) {
      setError(errorFor(err));
      setPhase('form');
    }
  }

  async function handleRegenerate(field: AiCopyField) {
    setError(null);
    setRegenerating(field);
    try {
      const previous = results[field] !== undefined ? { [field]: results[field] } : undefined;
      const data = await generateListingCopy(buildRequest([field], previous));
      if (data.results[field] !== undefined) {
        setResults((prev) => ({ ...prev, [field]: data.results[field] }));
        setFailed((prev) => {
          const next = new Set(prev);
          next.delete(field);
          return next;
        });
        setKeep((prev) => new Set(prev).add(field));
      } else {
        setError({ message: t('aiCopy.results.failed') });
      }
      setBalance(data.balance);
      setLastCharge(data.creditsCharged);
    } catch (err) {
      setError(errorFor(err));
    } finally {
      setRegenerating(null);
    }
  }

  function handleApply() {
    const applied: ListingCopyApplied = {};
    if (!hostHasName) applied.title = title;
    if (!hostHasPhotos && pickedPhotos.length > 0) applied.photos = pickedPhotos;
    if (!hostHasCategory && categories.length > 0) applied.categories = categories;

    if (keep.has('description') && results.description) applied.descriptionRich = results.description.descriptionRich;
    if (keep.has('tags') && results.tags) applied.tags = results.tags;
    if (keep.has('seoTitle') && results.seoTitle) applied.seoTitle = results.seoTitle;
    if (keep.has('seoDescription') && results.seoDescription) applied.seoDescription = results.seoDescription;
    if (keep.has('categories') && results.categories && !categoryKnown) {
      applied.categories = results.categories.map((c) => (c.id ? { id: c.id, name: c.name } : { name: c.name }));
    }

    onApply(applied);
    setOpen(false);
    toast.success(t('aiCopy.applied'));
  }

  // ─── Pieces ──────────────────────────────────────────────────────────────────

  const photoRow = (
    <div className="space-y-2">
      <Label>{t('aiCopy.photos.label')}</Label>
      {hostHasPhotos ? (
        <div className="space-y-2">
          <PhotoStrip
            photos={snapshot.photos.slice(0, AI_COPY_MAX_IMAGES)}
            badPhotoId={error?.badPhotoId}
          />
          <p className="text-sm text-muted-foreground">
            {t('aiCopy.photos.using', { count: snapshot.photos.length })}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <PhotoStrip
              photos={pickedPhotos}
              onRemove={(id) => setPickedPhotos((prev) => prev.filter((p) => p.id !== id))}
              removeLabel={t('aiCopy.photos.remove')}
              badPhotoId={error?.badPhotoId}
            />
            {pickedPhotos.length < photoCap && (
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className={cn(
                  'flex size-16 flex-col items-center justify-center gap-1 rounded-md border border-dashed text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                  showErrors && photosMissing && 'border-destructive text-destructive',
                )}
                aria-label={t('aiCopy.photos.add')}
              >
                <ImagePlus className="size-5" />
              </button>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {t(target === 'service' ? 'aiCopy.photos.hintService' : 'aiCopy.photos.hintProduct')}
          </p>
          {showErrors && photosMissing && (
            <p className="text-sm text-destructive">{t('aiCopy.photos.required')}</p>
          )}
        </div>
      )}
    </div>
  );

  const formBody = (
    <div className="space-y-5">
      {photoRow}

      {!hostHasName && (
        <div className="space-y-2">
          <Label htmlFor="ai-copy-name">{t('aiCopy.name.label')}</Label>
          <Input
            id="ai-copy-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('aiCopy.name.placeholder')}
            maxLength={200}
            aria-invalid={showErrors && nameMissing}
            className="max-md:h-11 max-md:text-base"
          />
          {showErrors && nameMissing && (
            <p className="text-sm text-destructive">{t('aiCopy.name.required')}</p>
          )}
        </div>
      )}

      {!hostHasCategory && (
        <div className="space-y-2">
          <Label htmlFor="ai-copy-category">{t('aiCopy.category.label')}</Label>
          <CategoryPicker id="ai-copy-category" value={categories} onChange={setCategories} />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="ai-copy-notes">{t('aiCopy.notes.label')}</Label>
        <Textarea
          id="ai-copy-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('aiCopy.notes.placeholder')}
          maxLength={AI_COPY_NOTES_MAX}
          rows={3}
          className="max-md:text-base"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ai-copy-language">{t('aiCopy.language.label')}</Label>
        <Select value={language} onValueChange={(v) => setLanguage(v as AiCopyLanguage)}>
          <SelectTrigger id="ai-copy-language" className="w-full max-md:h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((code) => (
              <SelectItem key={code} value={code}>
                {LOCALES[code].nativeLabel}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">{t('aiCopy.fields.label')}</legend>
        {offeredFields.map((field) => (
          <label
            key={field}
            className="flex min-h-9 cursor-pointer items-center gap-3 text-sm max-md:min-h-11"
          >
            <Checkbox
              checked={fields.has(field)}
              onCheckedChange={(v) => toggleField(field, v === true)}
            />
            {t(FIELD_LABEL[field])}
          </label>
        ))}
      </fieldset>

      {error && <ErrorLine error={error} />}
    </div>
  );

  const formFooter = (
    <div className="flex w-full items-center justify-between gap-3">
      <div className="min-w-0 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{t('aiCopy.cost', { count: cost })}</span>
        {balance !== null && (
          <span className="block sm:inline">
            <span className="hidden sm:inline"> · </span>
            {shortOfCredits ? (
              <span className="text-destructive">
                {t('aiCopy.notEnough')}{' '}
                <Link to="/dashboard/account/billing" className="underline underline-offset-2">
                  {t('aiCopy.topUp')}
                </Link>
              </span>
            ) : (
              t('aiCopy.balance', { balance: t('aiCopy.cost', { count: balance }) })
            )}
          </span>
        )}
      </div>
      <Button
        type="button"
        onClick={handleGenerate}
        disabled={requestedFields.length === 0 || shortOfCredits}
        className="shrink-0 gap-1.5 max-md:h-11"
      >
        <Sparkles className="size-4" />
        {t('aiCopy.generate')}
      </Button>
    </div>
  );

  const writingBody = (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <Spinner className="size-6" />
      <p className="font-medium">{t('aiCopy.writing')}</p>
      <p className="text-sm text-muted-foreground">{t('aiCopy.writingHint')}</p>
    </div>
  );

  const resultFields = requestedFieldsInOrder(results, failed);

  const resultsBody = (
    <div className="space-y-5">
      {lastCharge !== null && balance !== null && (
        <p className="text-sm text-muted-foreground">
          {t('aiCopy.results.charged', { count: lastCharge, balance: fmt.number(balance) })}
        </p>
      )}

      <div className="divide-y divide-border">
        {resultFields.map((field) => {
          const label = t(FIELD_LABEL[field]);
          const ok = results[field] !== undefined;
          const busy = regenerating === field;
          return (
            <section key={field} className="space-y-2 py-4 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-3">
                {ok ? (
                  <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
                    <Checkbox
                      checked={keep.has(field)}
                      onCheckedChange={(v) =>
                        setKeep((prev) => {
                          const next = new Set(prev);
                          if (v === true) next.add(field);
                          else next.delete(field);
                          return next;
                        })
                      }
                      aria-label={t('aiCopy.results.keep', { field: label })}
                    />
                    {label}
                  </label>
                ) : (
                  <span className="text-sm font-medium">{label}</span>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRegenerate(field)}
                  disabled={regenerating !== null || (balance !== null && balance < fieldCost)}
                  aria-label={t('aiCopy.results.regenerateLabel', {
                    field: label,
                    cost: t('aiCopy.cost', { count: fieldCost }),
                  })}
                  className="tap-target h-8 shrink-0 gap-1.5 px-2 text-muted-foreground"
                >
                  {busy ? <Spinner className="size-3.5" /> : <RefreshCw className="size-3.5" />}
                  {t('aiCopy.results.regenerate')}
                </Button>
              </div>

              <div className={cn(busy && 'opacity-50')}>
                {!ok ? (
                  <p className="text-sm text-muted-foreground">{t('aiCopy.results.failed')}</p>
                ) : (
                  <ResultValue field={field} results={results} />
                )}
              </div>
            </section>
          );
        })}
      </div>

      {error && <ErrorLine error={error} />}
    </div>
  );

  const resultsFooter = (
    <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setError(null);
          setPhase('form');
        }}
        disabled={regenerating !== null}
        className="max-md:h-11"
      >
        {t('aiCopy.results.back')}
      </Button>
      <Button
        type="button"
        onClick={handleApply}
        disabled={keep.size === 0 || regenerating !== null}
        className="max-md:h-11"
      >
        {t('aiCopy.results.apply')}
      </Button>
    </div>
  );

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleOpen}
        disabled={disabled}
        aria-label={t('aiCopy.buttonLabel')}
        className="tap-target -my-1 h-7 gap-1.5 px-2 text-primary hover:text-primary"
      >
        <Sparkles className="size-3.5" />
        {t('aiCopy.button')}
      </Button>

      <ResponsiveModal
        open={open}
        onOpenChange={setOpen}
        title={t('aiCopy.title')}
        description={phase === 'form' ? t('aiCopy.subtitle') : undefined}
        // Closing mid-request would hide a charge the vendor never sees the result of.
        disableClose={phase === 'writing' || regenerating !== null}
        footer={phase === 'form' ? formFooter : phase === 'results' ? resultsFooter : undefined}
        desktopClassName="sm:max-w-lg"
        mobileClassName="h-auto max-h-[92dvh]"
      >
        {phase === 'form' ? formBody : phase === 'writing' ? writingBody : resultsBody}
      </ResponsiveModal>

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(files) => {
          setPickedPhotos((prev) => {
            const have = new Set(prev.map((p) => p.id));
            const added = files.filter((f) => !have.has(f.id)).map(toFileDetail);
            return [...prev, ...added].slice(0, photoCap);
          });
          setPickerOpen(false);
        }}
        multiple={photoCap > 1}
        acceptedTypes={['image']}
        maxFiles={Math.max(1, photoCap - pickedPhotos.length)}
        alreadySelectedIds={pickedPhotos.map((p) => p.id)}
      />
    </>
  );
}

/** Results in the form's own order, failures included so the vendor can retry them. */
function requestedFieldsInOrder(results: Partial<AiCopyResults>, failed: Set<AiCopyField>): AiCopyField[] {
  return OUTPUT_FIELDS.filter((f) => results[f] !== undefined || failed.has(f));
}

function ResultValue({ field, results }: { field: AiCopyField; results: Partial<AiCopyResults> }) {
  const { t } = useTranslation();
  switch (field) {
    case 'description':
      return results.description ? (
        <div className="space-y-1">
          <RichDocView doc={results.description.descriptionRich} />
        </div>
      ) : null;
    case 'tags':
      return (
        <div className="flex flex-wrap gap-1.5">
          {results.tags?.map((tag) => (
            <span key={tag} className="rounded-md bg-muted px-2 py-0.5 text-sm">
              {tag}
            </span>
          ))}
        </div>
      );
    case 'seoTitle':
      return <p className="text-sm">{results.seoTitle}</p>;
    case 'seoDescription':
      return <p className="text-sm text-muted-foreground">{results.seoDescription}</p>;
    case 'categories':
      return (
        <div className="flex flex-wrap gap-1.5">
          {results.categories?.map((c, i) => (
            <span key={c.id ?? c.name + i} className="rounded-md bg-muted px-2 py-0.5 text-sm">
              {c.name}
              {i === 0 && <span className="text-muted-foreground"> · {t('aiCopy.results.mainCategory')}</span>}
              {!c.id && <span className="text-muted-foreground"> · {t('aiCopy.results.newCategory')}</span>}
            </span>
          ))}
        </div>
      );
  }
}

function PhotoStrip({
  photos,
  onRemove,
  removeLabel,
  badPhotoId,
}: {
  photos: ListingCopyPhoto[];
  onRemove?: (id: string) => void;
  removeLabel?: string;
  badPhotoId?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {photos.map((photo) => {
        const url = photo.url;
        return (
          <div
            key={photo.id}
            className={cn(
              'relative size-16 overflow-hidden rounded-md bg-muted',
              photo.id === badPhotoId && 'ring-2 ring-destructive ring-offset-2 ring-offset-background',
            )}
          >
            {url && <img src={url} alt="" className="size-full object-cover" loading="lazy" />}
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(photo.id)}
                aria-label={removeLabel}
                className="tap-target absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/75"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ErrorLine({ error }: { error: ErrorState }) {
  const { t } = useTranslation();
  return (
    <p role="alert" className="text-sm text-destructive">
      {error.message}
      {error.topUp && (
        <>
          {' '}
          <Link to="/dashboard/account/billing" className="underline underline-offset-2">
            {t('aiCopy.topUp')}
          </Link>
        </>
      )}
    </p>
  );
}
