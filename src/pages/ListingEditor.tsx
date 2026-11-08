import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Archive, AlertCircle, Plus, Trash2, Undo2, X } from 'lucide-react';

import { EditorPageShell, type EditorPageAction } from '@/components/layout/EditorPageShell';
import { ProductFormBody } from '@/components/products/form/ProductFormBody';
import { SettingsSection, SettingsSections } from '@/components/vendor-settings/SettingsSection';
import { ProductMediaUpload } from '@/components/products/ProductMediaUpload';
import { CategoryPicker } from '@/components/products/categories/CategoryPicker';
import { useCategoryConflicts } from '@/components/products/categories/useCategoryConflicts';
import { ChatRichTextEditor } from '@/components/rich-text';
import { AddressSearch } from '@/components/features/AddressSearch';
import { PhoneInput } from '@/components/phone';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { InfoHint } from '@/components/ui/info-hint';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ListingStatusPanel } from '@/components/listings/ListingStatusPanel';
import { listingAbilities } from '@/components/listings/listingStatus';
import {
  buildListingWrite,
  defaultWeek,
  draftFromDetail,
  emptyDraft,
  isEmptyWrite,
  type ListingDraft,
} from '@/components/listings/listingDraft';
import {
  archiveListing,
  createListing,
  discardListingRevision,
  fetchListing,
  submitListing,
  updateListing,
  useListingActionCosts,
  withdrawListing,
} from '@/services/listings.service';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { FALLBACK_PHONE_COUNTRY, PLATFORM_COUNTRIES, formatPhoneInternational } from '@/lib/phone';
import { toPlainText } from '@/lib/richtext';
import { ApiError } from '@/types/api';
import type { FileRef } from '@/types/file.types';
import {
  LISTING_LIMITS,
  LISTING_SOCIAL_NETWORKS,
  type ListingContacts,
  type ListingMissingField,
  type ListingSocialNetwork,
  type OpeningDay,
  type VendorListingDetail,
} from '@/types/listings.types';
import { useApiError, useFormatters, useTranslation, type TranslationKey } from '@/i18n';
import { cn } from '@/lib/utils';

const DAY_KEYS: Record<OpeningDay, TranslationKey> = {
  monday: 'services.days.monday',
  tuesday: 'services.days.tuesday',
  wednesday: 'services.days.wednesday',
  thursday: 'services.days.thursday',
  friday: 'services.days.friday',
  saturday: 'services.days.saturday',
  sunday: 'services.days.sunday',
};

const MISSING_KEYS: Record<ListingMissingField, TranslationKey> = {
  title: 'listings.editor.missing.title',
  companyName: 'listings.editor.missing.companyName',
  categories: 'listings.editor.missing.categories',
  country: 'listings.editor.missing.country',
  city: 'listings.editor.missing.city',
  area: 'listings.editor.missing.area',
  description: 'listings.editor.missing.description',
  contact: 'listings.editor.missing.contact',
};

/** Social network names are brands — shown as such in every language. */
const NETWORK_LABELS: Record<ListingSocialNetwork, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  x: 'X',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  other: '',
};

type FieldErrors = Partial<Record<string, string>>;

/** A refused first submit, handed to the saved listing's own address. */
type CarriedError = { missing: ListingMissingField[] } | { message: string };

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p data-field-error className="text-xs text-destructive">
      {message}
    </p>
  );
}

/**
 * Create or edit a service listing (`/dashboard/listings/new`, `/dashboard/listings/:id`).
 *
 * Two parts, kept apart on purpose: what customers see, and the hidden contacts
 * they unlock one tap at a time (each unlock costs the provider credits). A
 * notification about a listing opens this screen, so its status — and why, when
 * it is paused or refused — leads the page.
 *
 * Save writes only what changed. Submit saves first, then sends for review,
 * which costs the indexing credits shown on its button (returned on a refusal
 * or a withdrawal). While a submission waits for review nothing can be edited.
 */
export function ListingEditor() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const { t } = useTranslation();
  const fmt = useFormatters();
  const apiError = useApiError();
  const costs = useListingActionCosts();
  const roleEntity = useOnboarding().session?.role_entity;
  const { run: runCategorySave, dialog: categoryConflictDialog } = useCategoryConflicts();

  const [detail, setDetail] = useState<VendorListingDetail | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [loadError, setLoadError] = useState<string | null>(null);

  const startDraft = useMemo(
    // The profile's country; Cameroon until the provider has one.
    () => emptyDraft(roleEntity?.country || FALLBACK_PHONE_COUNTRY, roleEntity?.display_name ?? ''),
    // Only the first render's profile matters: it seeds a NEW listing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [draft, setDraft] = useState<ListingDraft>(startDraft);
  const initialRef = useRef<ListingDraft | null>(null);
  const [photos, setPhotos] = useState<FileRef[]>([]);
  // Remounts the photo picker against the server's list after a load.
  const [photosKey, setPhotosKey] = useState(0);

  const [busy, setBusy] = useState<null | 'save' | 'submit' | 'withdraw' | 'discard' | 'archive'>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [offerTopUp, setOfferTopUp] = useState(false);
  const [missing, setMissing] = useState<ListingMissingField[]>([]);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [confirm, setConfirm] = useState<null | 'discard' | 'archive'>(null);

  const adopt = useCallback((d: VendorListingDetail) => {
    const { draft: next, photos: files } = draftFromDetail(d);
    setDetail(d);
    setDraft(next);
    initialRef.current = next;
    setPhotos(files);
    setPhotosKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    fetchListing(id)
      .then((d) => active && adopt(d))
      .catch((err) => {
        if (!active) return;
        setLoadError(
          err instanceof ApiError && err.status === 404
            ? t('listings.editor.notFound')
            : apiError.resolve(err, { fallbackKey: 'listings.editor.loadFailed' }),
        );
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id, isNew, adopt, apiError, t]);

  // A refused first submit arrives here through router state (see handleSubmit).
  const location = useLocation();
  const carried = (location.state as { submitError?: CarriedError } | null)?.submitError ?? null;
  useEffect(() => {
    if (!carried) return;
    if ('missing' in carried) {
      setMissing(carried.missing);
      const fe: FieldErrors = {};
      for (const f of carried.missing) fe[f === 'contact' ? 'contacts' : f] = t(MISSING_KEYS[f]);
      setFieldErrors(fe);
    } else {
      setFormError(carried.message);
    }
    // Once: drop it so a refresh does not show it again.
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const abilities = listingAbilities(detail);
  const locked = !isNew && !abilities.edit;
  const set = useCallback(<K extends keyof ListingDraft>(key: K, value: ListingDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setFieldErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  }, []);

  const pendingWrite = useMemo(
    () => buildListingWrite(draft, isNew ? null : initialRef.current),
    [draft, isNew],
  );
  const dirty = isNew ? true : !isEmptyWrite(pendingWrite);

  const resetErrors = () => {
    setFormError(null);
    setOfferTopUp(false);
    setMissing([]);
    setFieldErrors({});
  };

  /** Show a refused write: the field it names, or one line at the top. */
  const showError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.code === 'LISTING_INCOMPLETE') {
        const list = (err.detailsObject?.missing as ListingMissingField[] | undefined) ?? [];
        setMissing(list);
        const fe: FieldErrors = {};
        for (const f of list) fe[f === 'contact' ? 'contacts' : f] = t(MISSING_KEYS[f]);
        setFieldErrors(fe);
      } else if (err instanceof ApiError && err.code === 'VALIDATION_ERROR') {
        const raw = apiError.fields(err);
        const fe: FieldErrors = {};
        for (const [path, msg] of Object.entries(raw)) fe[path.split('.').pop() ?? path] = msg;
        setFieldErrors(fe);
        setFormError(t('listings.editor.fixHighlighted'));
      } else if (err instanceof ApiError && (err.code === 'LISTING_VIDEO_LINK_INVALID' || err.code === 'LISTING_VIDEO_NOT_WATCHABLE')) {
        setFieldErrors({ videoUrl: apiError.resolve(err) });
      } else {
        setOfferTopUp(err instanceof ApiError && err.code === 'BILLING_INSUFFICIENT_CREDITS');
        setFormError(apiError.resolve(err, { fallbackKey: 'listings.editor.loadFailed' }));
      }
      requestAnimationFrame(() => {
        document.querySelector('[data-field-error], [data-form-error]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    },
    [apiError, t],
  );

  /**
   * Write the draft. Returns the saved listing, or `null` when the vendor
   * closed the "Did you mean …?" question or the save failed (already shown).
   */
  const save = useCallback(async (): Promise<VendorListingDetail | null> => {
    const initial = isNew ? null : initialRef.current;
    const result = await runCategorySave(
      draft.categories,
      (categories) => {
        const body = buildListingWrite(draft, initial, categories);
        return id ? updateListing(id, body) : createListing(body);
      },
      (categories) => setDraft((d) => ({ ...d, categories })),
    );
    if (!result.ok) return null;
    return result.value;
  }, [draft, id, isNew, runCategorySave]);

  const handleSave = useCallback(async () => {
    resetErrors();
    if (!isNew && !dirty) {
      toast.info(t('listings.editor.nothingToSave'));
      return;
    }
    setBusy('save');
    try {
      const saved = await save();
      if (!saved) return;
      adopt(saved);
      if (isNew) {
        toast.success(t('listings.editor.created'));
        navigate(`/dashboard/listings/${saved.id}`, { replace: true });
      } else {
        toast.success(t('listings.editor.saved'));
      }
    } catch (err) {
      showError(err);
    } finally {
      setBusy(null);
    }
  }, [adopt, dirty, isNew, navigate, save, showError, t]);

  const handleSubmit = useCallback(async () => {
    resetErrors();
    setBusy('submit');
    // A brand-new listing moves to its own address only once everything below
    // has finished — moving remounts this page — and moves even when the
    // submit is refused, so a second tap can never create a second listing.
    let createdId: string | null = null;
    let carried: CarriedError | null = null;
    try {
      let current = detail;
      // Save first: a new listing must exist, and a live one has nothing to
      // submit until a write opens its revision.
      if (isNew || dirty || (current && !current.pending)) {
        const saved = await save();
        if (!saved) return;
        current = saved;
        adopt(saved);
        if (isNew) createdId = saved.id;
      }
      if (!current) return;
      const submitted = await submitListing(current.id);
      adopt(submitted);
      toast.success(t('listings.editor.submitted'));
    } catch (err) {
      showError(err);
      // Carried across the move, in case it remounts the page.
      if (err instanceof ApiError && err.code === 'LISTING_INCOMPLETE') {
        carried = { missing: (err.detailsObject?.missing as ListingMissingField[] | undefined) ?? [] };
      } else {
        carried = { message: apiError.resolve(err, { fallbackKey: 'listings.editor.loadFailed' }) };
      }
    } finally {
      setBusy(null);
      if (createdId) {
        navigate(`/dashboard/listings/${createdId}`, { replace: true, state: carried ? { submitError: carried } : null });
      }
    }
  }, [adopt, apiError, detail, dirty, isNew, navigate, save, showError, t]);

  const runAction = useCallback(
    async (kind: 'withdraw' | 'discard' | 'archive') => {
      if (!detail) return;
      resetErrors();
      setBusy(kind);
      try {
        const next =
          kind === 'withdraw'
            ? await withdrawListing(detail.id)
            : kind === 'discard'
              ? await discardListingRevision(detail.id)
              : await archiveListing(detail.id);
        adopt(next);
        toast.success(
          t(
            kind === 'withdraw'
              ? 'listings.actions.withdrawn'
              : kind === 'discard'
                ? 'listings.actions.discarded'
                : 'listings.actions.archived',
          ),
        );
      } catch (err) {
        showError(err);
      } finally {
        setBusy(null);
        setConfirm(null);
      }
    },
    [adopt, detail, showError, t],
  );

  const actions: EditorPageAction[] = [];
  if (detail && abilities.withdraw) {
    actions.push({
      id: 'withdraw',
      icon: Undo2,
      label: t('listings.actions.withdraw'),
      onClick: () => void runAction('withdraw'),
      busy: busy === 'withdraw',
      inline: true,
    });
  }
  if (detail && abilities.discardRevision) {
    actions.push({
      id: 'discard',
      icon: X,
      label: t('listings.actions.discard'),
      onClick: () => setConfirm('discard'),
      busy: busy === 'discard',
    });
  }
  if (detail && abilities.archive) {
    actions.push({
      id: 'archive',
      icon: Archive,
      label: t('listings.actions.archive'),
      onClick: () => setConfirm('archive'),
      busy: busy === 'archive',
      destructive: true,
    });
  }

  const title = isNew
    ? t('listings.editor.newTitle')
    : draft.title.trim() || detail?.title || t('listings.editor.editTitle');

  if (loading || loadError) {
    return (
      <EditorPageShell title={t('listings.editor.editTitle')} backTo="/dashboard/listings" backLabel={t('listings.editor.back')}>
        <ProductFormBody className="space-y-4">
          {loadError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          ) : (
            <>
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-40 w-full" />
            </>
          )}
        </ProductFormBody>
      </EditorPageShell>
    );
  }

  const disabled = locked || busy !== null;
  // The approved contacts, shown beside the edited ones while a revision waits.
  const live = detail?.published && detail.pending ? detail.contacts.published : null;
  const submitLabel = costs
    ? t('listings.editor.submitWithCost', { count: costs.vectorisation })
    : t('listings.editor.submit');
  const descriptionLength = toPlainText(draft.description).trim().length;
  const isDraftOnly = isNew || !detail?.published;
  const actionButton = 'max-md:h-11 max-md:w-full';

  return (
    <EditorPageShell
      title={title}
      description={detail ? detail.companyName || undefined : t('listings.list.description')}
      backTo="/dashboard/listings"
      backLabel={t('listings.editor.back')}
      actions={actions}
    >
      <ProductFormBody className="space-y-6">
        {detail && <ListingStatusPanel listing={detail} />}

        {locked && detail?.status !== 'archived' && (
          <p className="text-sm text-muted-foreground">{t('listings.editor.lockedWhileReview')}</p>
        )}

        {(formError || missing.length > 0) && (
          <Alert variant="destructive" data-form-error>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="space-y-2">
              {missing.length > 0 ? (
                <>
                  <p className="font-medium">{t('listings.editor.missingTitle')}</p>
                  <p>
                    {t('listings.editor.missingBody', {
                      list: fmt.list(missing.map((f) => t(MISSING_KEYS[f]))),
                    })}
                  </p>
                </>
              ) : (
                <p>{formError}</p>
              )}
              {offerTopUp && (
                <Link to="/dashboard/account/billing" className="inline-block font-medium underline">
                  {t('listings.suspension.topUp')}
                </Link>
              )}
            </AlertDescription>
          </Alert>
        )}

        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void handleSave();
          }}
          className="space-y-6"
        >
          <SettingsSections>
            {/* ── What customers see ─────────────────────────────────────── */}
            <SettingsSection title={t('listings.editor.publicTitle')} contentClassName="space-y-5">
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label>{t('listings.editor.photos')}</Label>
                  <span className="text-xs text-muted-foreground">{t('listings.editor.optional')}</span>
                </div>
                <ProductMediaUpload
                  key={photosKey}
                  existingFiles={photos}
                  maxFiles={LISTING_LIMITS.photosMax}
                  disabled={disabled}
                  onMediaChange={(ids) => set('photoIds', ids)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="listing-title">{t('listings.editor.title')}</Label>
                <Input
                  id="listing-title"
                  value={draft.title}
                  maxLength={LISTING_LIMITS.titleMax}
                  placeholder={t('listings.editor.titlePlaceholder')}
                  disabled={disabled}
                  aria-invalid={!!fieldErrors.title}
                  onChange={(e) => set('title', e.target.value)}
                />
                <FieldError message={fieldErrors.title} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="listing-company">{t('listings.editor.companyName')}</Label>
                <Input
                  id="listing-company"
                  value={draft.companyName}
                  maxLength={LISTING_LIMITS.companyMax}
                  autoComplete="organization"
                  disabled={disabled}
                  aria-invalid={!!fieldErrors.companyName}
                  onChange={(e) => set('companyName', e.target.value)}
                />
                <FieldError message={fieldErrors.companyName} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="listing-description">{t('listings.editor.description')}</Label>
                <ChatRichTextEditor
                  id="listing-description"
                  value={draft.description}
                  onChange={(doc) => set('description', doc)}
                  previewTitle={draft.title}
                  disabled={disabled}
                  invalid={!!fieldErrors.description}
                />
                <FieldError message={fieldErrors.description} />
                <p className="text-xs text-muted-foreground">
                  {t('listings.editor.descriptionHint', { min: LISTING_LIMITS.descriptionMin })}{' '}
                  {descriptionLength > 0 && descriptionLength < LISTING_LIMITS.descriptionMin && (
                    <span className="tabular-nums">({descriptionLength}/{LISTING_LIMITS.descriptionMin})</span>
                  )}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="listing-categories">{t('listings.editor.categories')}</Label>
                <CategoryPicker
                  id="listing-categories"
                  value={draft.categories}
                  onChange={(next) => set('categories', next)}
                  disabled={disabled}
                  invalid={!!fieldErrors.categories}
                />
                <FieldError message={fieldErrors.categories} />
              </div>
            </SettingsSection>

            {/* ── Where ──────────────────────────────────────────────────── */}
            <SettingsSection title={t('listings.editor.whereTitle')} contentClassName="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="listing-country">{t('listings.editor.country')}</Label>
                <Select value={draft.country || undefined} onValueChange={(v) => set('country', v)} disabled={disabled}>
                  <SelectTrigger id="listing-country" aria-invalid={!!fieldErrors.country}>
                    <SelectValue placeholder={t('listings.editor.countryPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORM_COUNTRIES.map((code) => (
                      <SelectItem key={code} value={code}>
                        {fmt.country(code)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError message={fieldErrors.country} />
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="listing-city">{t('listings.editor.city')}</Label>
                  <Input
                    id="listing-city"
                    value={draft.city}
                    maxLength={LISTING_LIMITS.cityMax}
                    autoComplete="address-level2"
                    disabled={disabled}
                    aria-invalid={!!fieldErrors.city}
                    onChange={(e) => set('city', e.target.value)}
                  />
                  <FieldError message={fieldErrors.city} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="listing-area">{t('listings.editor.area')}</Label>
                  <Input
                    id="listing-area"
                    value={draft.area}
                    maxLength={LISTING_LIMITS.areaMax}
                    placeholder={t('listings.editor.areaPlaceholder')}
                    disabled={disabled}
                    aria-invalid={!!fieldErrors.area}
                    onChange={(e) => set('area', e.target.value)}
                  />
                  <FieldError message={fieldErrors.area} />
                  {!fieldErrors.area && <p className="text-xs text-muted-foreground">{t('listings.editor.areaHint')}</p>}
                </div>
              </div>

              <OpeningHoursField
                value={draft.openingHours}
                onChange={(v) => set('openingHours', v)}
                disabled={disabled}
              />
            </SettingsSection>

            {/* ── Hidden contacts ────────────────────────────────────────── */}
            <SettingsSection title={t('listings.editor.contactsTitle')} contentClassName="space-y-5">
              <p className="text-sm text-muted-foreground">{t('listings.editor.contactsNote')}</p>
              <FieldError message={fieldErrors.contacts} />

              <div className="space-y-2">
                <Label htmlFor="listing-whatsapp">{t('listings.editor.whatsapp')}</Label>
                <PhoneInput
                  id="listing-whatsapp"
                  value={draft.whatsapp}
                  onChange={(v) => set('whatsapp', v)}
                  defaultCountry={draft.country || undefined}
                  disabled={disabled}
                  error={fieldErrors.whatsapp}
                />
                <LiveNow live={live} field="whatsapp" draft={draft} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="listing-phone">{t('listings.editor.phone')}</Label>
                <PhoneInput
                  id="listing-phone"
                  value={draft.phone}
                  onChange={(v) => set('phone', v)}
                  defaultCountry={draft.country || undefined}
                  disabled={disabled}
                  error={fieldErrors.phone}
                />
              </div>

              {/* One contact field for customers: unlocking "Phone" shows both
                  numbers for one charge. "Ask them to call me" sends the first. */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="listing-phone2">{t('listings.editor.phone2')}</Label>
                  <span className="text-xs text-muted-foreground">{t('listings.editor.optional')}</span>
                </div>
                <PhoneInput
                  id="listing-phone2"
                  value={draft.phone2}
                  onChange={(v) => set('phone2', v)}
                  defaultCountry={draft.country || undefined}
                  disabled={disabled}
                  error={fieldErrors.phone2}
                />
                {!fieldErrors.phone2 && (
                  <p className="text-xs text-muted-foreground">{t('listings.editor.phone2Hint')}</p>
                )}
                <LiveNow live={live} field="phones" draft={draft} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="listing-email">{t('listings.editor.email')}</Label>
                <Input
                  id="listing-email"
                  type="email"
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={draft.email}
                  disabled={disabled}
                  aria-invalid={!!fieldErrors.email}
                  onChange={(e) => set('email', e.target.value)}
                />
                <FieldError message={fieldErrors.email} />
                <LiveNow live={live} field="email" draft={draft} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="listing-website">{t('listings.editor.website')}</Label>
                <Input
                  id="listing-website"
                  type="url"
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder={t('listings.editor.websitePlaceholder')}
                  value={draft.website}
                  disabled={disabled}
                  aria-invalid={!!fieldErrors.website}
                  onChange={(e) => set('website', e.target.value)}
                />
                <FieldError message={fieldErrors.website} />
                <LiveNow live={live} field="website" draft={draft} />
              </div>

              <SocialsField
                value={draft.socials}
                onChange={(v) => set('socials', v)}
                disabled={disabled}
                error={fieldErrors.socials ?? fieldErrors.url}
              />

              <div className="space-y-2">
                <Label>{t('listings.editor.location')}</Label>
                <div className={cn(disabled && 'pointer-events-none opacity-60')} aria-disabled={disabled}>
                  <AddressSearch
                    value={draft.location}
                    onSelect={(candidate, raw) => set('location', { ...candidate, raw_input: raw })}
                    onClear={disabled ? undefined : () => set('location', null)}
                    countryBias={draft.country || null}
                  />
                </div>
                <FieldError message={fieldErrors.location} />
                <p className="text-xs text-muted-foreground">{t('listings.editor.locationHint')}</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="listing-video">{t('listings.editor.video')}</Label>
                  <InfoHint label={t('listings.editor.videoHowTitle')}>
                    <div className="space-y-2 text-sm">
                      <p className="font-medium">{t('listings.editor.videoHowTitle')}</p>
                      <p>{t('listings.editor.videoHowYoutube')}</p>
                      <p>{t('listings.editor.videoHowDrive')}</p>
                    </div>
                  </InfoHint>
                </div>
                <Input
                  id="listing-video"
                  type="url"
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder={t('listings.editor.videoPlaceholder')}
                  value={draft.videoUrl}
                  disabled={disabled}
                  aria-invalid={!!fieldErrors.videoUrl}
                  onChange={(e) => set('videoUrl', e.target.value)}
                />
                <FieldError message={fieldErrors.videoUrl} />
                {!fieldErrors.videoUrl && <p className="text-xs text-muted-foreground">{t('listings.editor.videoHint')}</p>}
              </div>
            </SettingsSection>
          </SettingsSections>

          {/* Actions — on a phone the primary lands on top, under the thumb. */}
          {detail?.status !== 'archived' && (
            <div className="space-y-3 max-md:border-t max-md:pt-5">
              <div className="flex flex-col-reverse gap-2 md:flex-row md:items-center md:justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  className={actionButton}
                  disabled={busy !== null}
                  onClick={() => navigate('/dashboard/listings')}
                >
                  {t('listings.editor.cancel')}
                </Button>
                <div className="flex flex-col-reverse gap-2 md:flex-row">
                  <Button type="submit" variant="outline" className={actionButton} disabled={disabled}>
                    {busy === 'save'
                      ? t('listings.editor.saving')
                      : isDraftOnly
                        ? t('listings.editor.saveDraft')
                        : t('listings.editor.saveChanges')}
                  </Button>
                  <Button
                    type="button"
                    className={actionButton}
                    disabled={disabled || !abilities.submit}
                    onClick={() => void handleSubmit()}
                  >
                    {busy === 'submit' ? t('listings.editor.submitting') : submitLabel}
                  </Button>
                </div>
              </div>
              {costs && !locked && (
                <p className="text-xs text-muted-foreground md:text-right">
                  {t('listings.editor.submitCostNote', { count: costs.vectorisation })}
                </p>
              )}
            </div>
          )}
        </form>
      </ProductFormBody>

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && busy === null && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t(confirm === 'archive' ? 'listings.actions.archiveTitle' : 'listings.actions.discardTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(confirm === 'archive' ? 'listings.actions.archiveBody' : 'listings.actions.discardBody')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy !== null}>{t('common.actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy !== null}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (confirm) void runAction(confirm);
              }}
            >
              {t(confirm === 'archive' ? 'listings.actions.archiveConfirm' : 'listings.actions.discardConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {categoryConflictDialog}
    </EditorPageShell>
  );
}

// ─── "Customers see now" ──────────────────────────────────────────────────────

/**
 * Under a contact being changed on a LIVE listing: what customers still unlock
 * until the change is approved. The approved and the edited contacts side by
 * side, one line, only where the two differ.
 */
function LiveNow({
  live,
  field,
  draft,
}: {
  /** The approved contacts, only while a revision exists; otherwise `null`. */
  live: ListingContacts | null;
  field: 'whatsapp' | 'phones' | 'email' | 'website';
  draft: ListingDraft;
}) {
  const { t } = useTranslation();
  if (!live) return null;

  const show = (v: string | null | undefined) =>
    v ? (v.startsWith('+') ? formatPhoneInternational(v) : v) : '';
  const liveValue =
    field === 'phones'
      ? [live.phone, live.phone2].filter(Boolean).map(show).join(', ')
      : show(live[field]);
  const editedValue =
    field === 'phones'
      ? [draft.phone, draft.phone2].filter(Boolean).map(show).join(', ')
      : show(draft[field]);
  if (liveValue === editedValue) return null;

  return (
    <p className="text-xs text-muted-foreground">
      {liveValue ? t('listings.editor.liveNow', { value: liveValue }) : t('listings.editor.liveNowNone')}
    </p>
  );
}

// ─── Opening hours ────────────────────────────────────────────────────────────

function OpeningHoursField({
  value,
  onChange,
  disabled,
}: {
  value: ListingDraft['openingHours'];
  onChange: (v: ListingDraft['openingHours']) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();

  if (!value) {
    return (
      <Button
        type="button"
        variant="outline"
        className="max-md:h-11 max-md:w-full"
        disabled={disabled}
        onClick={() => onChange(defaultWeek())}
      >
        <Plus className="mr-1.5 h-4 w-4" />
        {t('listings.editor.hoursAdd')}
      </Button>
    );
  }

  const update = (index: number, patch: Partial<(typeof value)[number]>) =>
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Label>
          {t('listings.editor.hours')} <span className="text-xs font-normal text-muted-foreground">{t('listings.editor.optional')}</span>
        </Label>
        <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onChange(null)}>
          {t('listings.editor.hoursRemove')}
        </Button>
      </div>
      <div className="divide-y">
        {value.map((row, i) => (
          <div key={row.day} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
            <span className="w-28 text-sm font-medium">{t(DAY_KEYS[row.day])}</span>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch
                checked={!row.isClosed}
                disabled={disabled}
                onCheckedChange={(open) => update(i, { isClosed: !open })}
                aria-label={t(DAY_KEYS[row.day])}
              />
              {row.isClosed ? t('listings.editor.hoursClosed') : t('listings.editor.hoursOpen')}
            </label>
            {!row.isClosed && (
              <div className="flex items-center gap-2 max-md:basis-full">
                <Input
                  type="time"
                  aria-label={t('listings.editor.hoursFrom')}
                  value={row.openTime}
                  disabled={disabled}
                  onChange={(e) => update(i, { openTime: e.target.value })}
                  className="w-32"
                />
                <span className="text-muted-foreground">–</span>
                <Input
                  type="time"
                  aria-label={t('listings.editor.hoursTo')}
                  value={row.closeTime}
                  disabled={disabled}
                  onChange={(e) => update(i, { closeTime: e.target.value })}
                  className="w-32"
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Social pages ─────────────────────────────────────────────────────────────

function SocialsField({
  value,
  onChange,
  disabled,
  error,
}: {
  value: ListingDraft['socials'];
  onChange: (v: ListingDraft['socials']) => void;
  disabled: boolean;
  error?: string;
}) {
  const { t } = useTranslation();
  const update = (index: number, patch: Partial<(typeof value)[number]>) =>
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return (
    <div className="space-y-2">
      <Label>{t('listings.editor.socials')}</Label>
      {value.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          <Select
            value={row.network}
            onValueChange={(v) => update(i, { network: v as ListingSocialNetwork })}
            disabled={disabled}
          >
            <SelectTrigger className="w-32 shrink-0" aria-label={t('listings.editor.socialNetwork')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LISTING_SOCIAL_NETWORKS.map((n) => (
                <SelectItem key={n} value={n}>
                  {n === 'other' ? t('listings.editor.socialOther') : NETWORK_LABELS[n]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="url"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="https://"
            aria-label={t('listings.editor.socialUrl')}
            value={row.url}
            disabled={disabled}
            onChange={(e) => update(i, { url: e.target.value })}
            className="min-w-0 flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            disabled={disabled}
            aria-label={t('listings.editor.socialsRemove')}
            onClick={() => onChange(value.filter((_, j) => j !== i))}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <FieldError message={error} />
      {value.length < LISTING_LIMITS.socialsMax && (
        <Button
          type="button"
          variant="outline"
          className={cn('max-md:h-11 max-md:w-full')}
          disabled={disabled}
          onClick={() => onChange([...value, { network: 'facebook', url: '' }])}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          {t('listings.editor.socialsAdd')}
        </Button>
      )}
    </div>
  );
}
