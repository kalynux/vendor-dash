import { useCallback, useEffect, useMemo, useState, type ComponentProps, type ReactNode } from 'react';
import {
  Loader2,
  Image as ImageIcon,
  X,
  ExternalLink,
  Lock,
  Store as StoreIcon,
  Camera,
  Copy,
  Check,
  Mail,
  Globe,
  CalendarDays,
  LifeBuoy,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { normalizeStoredPhone, phoneErrorKey, toE164 } from '@/lib/phone';
import { PhoneInput } from '@/components/phone';
import { useStoreStore } from '@/store';
import { updateStore, updateStoreStatus } from '@/services/store.service';
import { resolveFileUrl } from '@/services/files.service';
import { MediaPicker } from '@/components/features/MediaPicker';
import { mapProfileError } from '@/components/vendor-settings/errors';
import { UnsavedChangesBar } from '@/components/vendor-settings/UnsavedChangesBar';
import { useTranslation, useFormatters, type TranslationKey } from '@/i18n';
import { ApiError } from '@/types/api';
import type { ApiFile, FileRef } from '@/types/file.types';
import type { StoreUpdatePayload, VendorStore } from '@/types/store.types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { InfoHint } from '@/components/ui/info-hint';
import {
  SettingsSection,
  SettingsSections,
} from '@/components/vendor-settings/SettingsSection';

// The editable string fields, in payload key order. `name` is required (2–100);
// the rest are nullable. slug + country are immutable (rendered read-only) —
// the store carries no address/city; physical locations live on the vendor
// profile as business addresses.
type EditableKey =
  | 'name'
  | 'description'
  | 'supportEmail'
  | 'supportPhone'
  | 'supportWhatsapp';

interface FormState {
  name: string;
  description: string;
  // Full file objects (or `null`) — `.url` drives the preview, `.id` is what the
  // PATCH sends as `logoFileId` / `bannerFileId`.
  logo: FileRef | null;
  banner: FileRef | null;
  supportEmail: string;
  supportPhone: string;
  supportWhatsapp: string;
}

/** Validation results are keys, not sentences — the component translates them. */
type FieldErrors = Partial<Record<EditableKey, TranslationKey>>;

function toForm(s: VendorStore): FormState {
  return {
    name: s.name ?? '',
    description: s.description ?? '',
    logo: s.logo,
    banner: s.banner,
    supportEmail: s.supportEmail ?? '',
    // Legacy records hold spaced or country-code-less numbers; seed the canonical
    // form so an untouched field doesn't read as edited.
    supportPhone: normalizeStoredPhone(s.supportPhone),
    supportWhatsapp: normalizeStoredPhone(s.supportWhatsapp),
  };
}

/** Normalize an editable text value: trim, and treat an empty string as `null`. */
function norm(v: string): string | null {
  const t = v.trim();
  return t === '' ? null : t;
}

/** Support numbers go to the backend in E.164, or `null` when cleared. */
function normPhone(v: string): string | null {
  return toE164(v) ?? norm(v);
}

/**
 * Build the PATCH payload from the diff between the edited form and the stored
 * store, always including `version`. Only changed fields are sent (partial
 * update). `name` is sent as-is (required); every other field is null-normalized.
 */
function buildPayload(form: FormState, store: VendorStore): StoreUpdatePayload {
  const payload: StoreUpdatePayload = { version: store.version };

  if (form.name.trim() !== (store.name ?? '')) payload.name = form.name.trim();

  const stringFields: Exclude<EditableKey, 'name'>[] = ['description', 'supportEmail'];
  for (const key of stringFields) {
    const next = norm(form[key]);
    if (next !== (store[key] ?? null)) payload[key] = next;
  }

  // Compared canonically, so re-spacing a legacy number is not a change.
  for (const key of ['supportPhone', 'supportWhatsapp'] as const) {
    const next = normPhone(form[key]);
    if (next !== normPhone(store[key] ?? '')) payload[key] = next;
  }

  // Send the file id (or `null` to detach) only when the selected file changed.
  if ((form.logo?.id ?? null) !== (store.logo?.id ?? null)) payload.logoFileId = form.logo?.id ?? null;
  if ((form.banner?.id ?? null) !== (store.banner?.id ?? null)) payload.bannerFileId = form.banner?.id ?? null;

  return payload;
}

/** Client-side validation mirroring the PATCH /vendor/store constraints. */
function validateForm(form: FormState): FieldErrors {
  const errors: FieldErrors = {};

  const name = form.name.trim();
  if (name.length < 2) errors.name = 'settings.storefront.validation.nameTooShort';
  else if (name.length > 100) errors.name = 'settings.storefront.validation.nameTooLong';

  const email = form.supportEmail.trim();
  if (email && !/^\S+@\S+\.\S+$/.test(email)) {
    errors.supportEmail = 'common.validation.email';
  }

  // Both support numbers are optional, but a number that is filled in has to be
  // dialable — customers reach the vendor on these.
  for (const key of ['supportPhone', 'supportWhatsapp'] as const) {
    const messageKey = phoneErrorKey(form[key]);
    if (messageKey) errors[key] = messageKey;
  }

  return errors;
}

export function StorefrontSettings() {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const { store, isLoading, fetchStore, applyStore } = useStoreStore();

  const [form, setForm] = useState<FormState | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState<'logo' | 'banner' | null>(null);
  const [togglingVacation, setTogglingVacation] = useState(false);
  const [fetchAttempted, setFetchAttempted] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load the store if it wasn't already fetched by the dashboard shell.
  useEffect(() => {
    if (!store && !isLoading && !fetchAttempted) {
      fetchStore();
      setFetchAttempted(true);
    }
  }, [store, isLoading, fetchStore, fetchAttempted]);

  // (Re)seed the form whenever the underlying store changes (initial load / save).
  useEffect(() => {
    if (store) {
      setForm(toForm(store));
      setFieldErrors({});
    }
  }, [store]);

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    // Editing a field clears its stale validation error.
    setFieldErrors((prev) => (key in prev ? { ...prev, [key]: undefined } : prev));
  }, []);

  const dirty = useMemo(() => {
    if (!store || !form) return false;
    return Object.keys(buildPayload(form, store)).length > 1; // more than just `version`
  }, [store, form]);

  const handleDiscard = useCallback(() => {
    if (store) {
      setForm(toForm(store));
      setFieldErrors({});
      setErrorKey(null);
      setError(null);
    }
  }, [store]);

  const handleSave = useCallback(async () => {
    if (!store || !form) return;

    const errors = validateForm(form);
    if (Object.values(errors).some(Boolean)) {
      setFieldErrors(errors);
      setErrorKey('common.validation.fixHighlighted');
      setError(null);
      return;
    }

    setSaving(true);
    setErrorKey(null);
    setError(null);
    try {
      const updated = await updateStore(buildPayload(form, store));
      applyStore(updated);
      toast.success(t('settings.storefront.saved'));
    } catch (err) {
      if (err instanceof ApiError && err.isConflict) {
        // Optimistic-locking clash — refresh so the vendor edits the latest.
        toast.error(t('settings.storefront.conflictReload'));
        await fetchStore();
      } else {
        setError(mapProfileError(err));
      }
    } finally {
      setSaving(false);
    }
  }, [store, form, applyStore, fetchStore, t]);

  const handleVacationToggle = useCallback(
    async (nextOpen: boolean) => {
      if (!store) return;
      setTogglingVacation(true);
      try {
        const updated = await updateStoreStatus({ isOpen: nextOpen, version: store.version });
        applyStore(updated);
        toast.success(t(nextOpen ? 'settings.storefront.status.reopened' : 'settings.storefront.status.closedToast'));
      } catch (err) {
        if (err instanceof ApiError && err.isConflict) {
          toast.error(t('settings.storefront.conflictRetry'));
          await fetchStore();
        } else {
          toast.error(mapProfileError(err));
        }
      } finally {
        setTogglingVacation(false);
      }
    },
    [store, applyStore, fetchStore, t],
  );

  const onPickImage = useCallback(
    (files: ApiFile[]) => {
      const file = files[0];
      if (file && picker) {
        const ref: FileRef = {
          id: file.id,
          key: file.key,
          url: resolveFileUrl(file),
          mimeType: file.mimeType,
          size: file.size,
          originalName: file.originalName,
        };
        set(picker, ref);
      }
      setPicker(null);
    },
    [picker, set],
  );

  const handleCopyUrl = useCallback(async () => {
    if (!store) return;
    try {
      await navigator.clipboard.writeText(store.publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('settings.storefront.copyUrlFailed'));
    }
  }, [store, t]);

  if (isLoading && !store) return <StorefrontSkeleton />;

  if (!store || !form) {
    return (
      <SettingsSection
        title={t('settings.storefront.title')}
        info={t('settings.storefront.info')}
      >
        <div role="alert" className="p-3 text-sm bg-destructive/10 text-destructive rounded-lg border border-destructive/20">
          {t('settings.storefront.loadFailed')}
        </div>
        <Button variant="outline" className="mt-3" onClick={fetchStore}>{t('common.actions.retry')}</Button>
      </SettingsSection>
    );
  }

  const previewName = form.name.trim() || store.name;

  return (
    <div className="space-y-6">
      {/* ─── Storefront preview hero ─────────────────────────────────────── */}
      {/* Full-bleed on mobile (cancels the page's own px-6) — a framed banner
          inside a card inside the page padding left it postage-stamp small. */}
      <div className="overflow-hidden max-md:-mx-6 md:rounded-xl md:border md:bg-card md:shadow-sm">
        {/* Banner — live preview of the picked image */}
        <div className="relative aspect-[3/1] min-h-[130px] max-h-[260px] w-full bg-muted">
          {form.banner ? (
            <>
              <img
                src={form.banner.url}
                alt={t('settings.storefront.bannerAlt')}
                crossOrigin="use-credentials"
                className="h-full w-full object-cover"
              />
              {/* Change / remove controls — shown only once a banner is set */}
              <div className="absolute right-3 top-3 flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="bg-background/80 shadow-sm backdrop-blur-sm hover:bg-background/95 gap-1.5"
                  onClick={() => setPicker('banner')}
                >
                  <Camera className="w-3.5 h-3.5" />
                  {t('settings.storefront.changeBanner')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="bg-background/80 px-2 shadow-sm backdrop-blur-sm hover:bg-background/95 hover:text-destructive"
                  aria-label={t('settings.storefront.removeBanner')}
                  onClick={() => set('banner', null)}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </>
          ) : (
            // No banner yet — the whole area is a click target to add one.
            <button
              type="button"
              onClick={() => setPicker('banner')}
              aria-label={t('settings.storefront.addBanner')}
              className="group flex h-full w-full flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-primary/5 via-muted to-muted transition-colors hover:from-primary/10"
            >
              <ImageIcon className="w-6 h-6 text-muted-foreground/60 transition-colors group-hover:text-muted-foreground" />
              <p className="text-xs text-muted-foreground">{t('settings.storefront.addBannerPrompt')}</p>
            </button>
          )}
        </div>
      </div>

      {/* Identity row — logo overlaps the banner */}
        <div className="md:px-6 md:pb-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="relative -mt-10 shrink-0 sm:-mt-12">
              {form.logo ? (
                <>
                  <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border-4 border-card bg-muted shadow-md sm:h-24 sm:w-24">
                    <img
                      src={form.logo.url}
                      alt={t('settings.storefront.logoAlt')}
                      crossOrigin="use-credentials"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <button
                    type="button"
                    aria-label={t('settings.storefront.changeLogo')}
                    onClick={() => setPicker('logo')}
                    className="absolute -bottom-1.5 -right-1.5 rounded-full border border-border bg-background p-1.5 text-foreground shadow-sm transition-colors hover:bg-accent"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={t('settings.storefront.removeLogo')}
                    onClick={() => set('logo', null)}
                    className="absolute -right-1.5 -top-1.5 rounded-full border border-border bg-background p-1 text-muted-foreground shadow-sm transition-colors hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </>
              ) : (
                // No logo yet — the whole box is a click target to add one.
                <button
                  type="button"
                  aria-label={t('settings.storefront.addLogo')}
                  onClick={() => setPicker('logo')}
                  className="group flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border-4 border-card bg-muted shadow-md transition-colors hover:bg-accent sm:h-24 sm:w-24"
                >
                  <StoreIcon className="w-8 h-8 text-muted-foreground transition-colors group-hover:text-foreground" />
                </button>
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-xl font-bold leading-tight">{previewName}</h2>
                <StatusBadge isOpen={store.isOpen} label={t(store.isOpen ? 'settings.storefront.status.open' : 'settings.storefront.status.closed')} />
              </div>
              <a
                href={store.publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-full items-center gap-1 truncate text-sm text-muted-foreground hover:text-primary hover:underline"
              >
                <Globe className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{store.publicUrl}</span>
              </a>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={handleCopyUrl}>
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {t(copied ? 'common.actions.copied' : 'common.actions.copyLink')}
              </Button>
              <Button asChild size="sm" className="gap-1.5">
                <a href={store.publicUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-3.5 h-3.5" />
                  {t('settings.storefront.viewStore')}
                </a>
              </Button>
            </div>
          </div>
        </div>

      {(errorKey || error) && (
        <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          {errorKey ? t(errorKey) : error}
        </div>
      )}

      {/* ─── Forms + side rail ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 items-start max-md:divide-y md:gap-6 lg:grid-cols-3">
        {/* Main column */}
        <SettingsSections className="lg:col-span-2">
          {/* Identity */}
          <SettingsSection
            title={t('settings.storefront.identity.title')}
            icon={StoreIcon}
            info={t('settings.storefront.identity.info')}
            contentClassName="space-y-5"
          >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="store-name">{t('settings.storefront.identity.name')}</Label>
                  <span className="text-xs tabular-nums text-muted-foreground">{t('settings.storefront.identity.counter', { current: form.name.length, max: 100 })}</span>
                </div>
                <Input
                  id="store-name"
                  value={form.name}
                  maxLength={100}
                  aria-invalid={!!fieldErrors.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder={t('settings.storefront.identity.namePlaceholder')}
                />
                <FieldError messageKey={fieldErrors.name} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="store-description">{t('settings.storefront.identity.description')}</Label>
                  <span
                    className={cn(
                      'text-xs tabular-nums text-muted-foreground',
                      form.description.length > 900 && 'text-amber-600 dark:text-amber-500',
                    )}
                  >
                    {t('settings.storefront.identity.counter', { current: form.description.length, max: 1000 })}
                  </span>
                </div>
                <Textarea
                  id="store-description"
                  value={form.description}
                  maxLength={1000}
                  rows={5}
                  onChange={(e) => set('description', e.target.value)}
                  placeholder={t('settings.storefront.identity.descriptionPlaceholder')}
                  className="resize-y"
                />
              </div>
          </SettingsSection>

          {/* Support contacts */}
          <SettingsSection
            title={t('settings.storefront.support.title')}
            icon={LifeBuoy}
            info={t('settings.storefront.support.info')}
          >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="store-email">{t('settings.storefront.support.email')}</Label>
                  <IconInput
                    icon={Mail}
                    id="store-email"
                    type="email"
                    value={form.supportEmail}
                    aria-invalid={!!fieldErrors.supportEmail}
                    onChange={(e) => set('supportEmail', e.target.value)}
                    placeholder={t('settings.storefront.support.emailPlaceholder')}
                  />
                  <FieldError messageKey={fieldErrors.supportEmail} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="store-phone">{t('settings.storefront.support.phone')}</Label>
                  <PhoneInput
                    id="store-phone"
                    value={form.supportPhone}
                    onChange={(v) => set('supportPhone', v)}
                    error={fieldErrors.supportPhone ? t(fieldErrors.supportPhone) : undefined}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="store-wa">{t('settings.storefront.support.whatsapp')}</Label>
                  <PhoneInput
                    id="store-wa"
                    value={form.supportWhatsapp}
                    onChange={(v) => set('supportWhatsapp', v)}
                    error={fieldErrors.supportWhatsapp ? t(fieldErrors.supportWhatsapp) : undefined}
                  />
                </div>
              </div>
          </SettingsSection>

        </SettingsSections>

        {/* Side rail */}
        <SettingsSections>
          {/* Vacation mode */}
          <SettingsSection
            title={t('settings.storefront.status.title')}
            info={t('settings.storefront.status.info')}
          >
              <div className="flex items-center justify-between gap-3 rounded-lg border p-3 sm:p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={cn(
                      'shrink-0 rounded-lg p-2',
                      store.isOpen
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
                    )}
                  >
                    <StoreIcon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{t(store.isOpen ? 'settings.storefront.status.openTitle' : 'settings.storefront.status.closed')}</p>
                    <p className="text-xs text-muted-foreground">
                      {t(store.isOpen ? 'settings.storefront.status.openBody' : 'settings.storefront.status.closedBody')}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {togglingVacation && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                  <Switch
                    checked={store.isOpen}
                    disabled={togglingVacation}
                    onCheckedChange={handleVacationToggle}
                    aria-label={t('settings.storefront.status.toggleLabel')}
                  />
                </div>
              </div>
          </SettingsSection>

          {/* Store details (read-only) */}
          <SettingsSection
            title={t('settings.storefront.details.title')}
            info={t('settings.storefront.details.info')}
            contentClassName="space-y-4"
          >
              <DetailRow icon={Globe} label={t('settings.storefront.details.publicUrl')}>
                <a
                  href={store.publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-sm text-primary hover:underline"
                >
                  {store.publicUrl}
                </a>
              </DetailRow>
              <Separator />
              <DetailRow
                icon={Lock}
                label={t('settings.storefront.details.slug')}
                hint={t('settings.storefront.details.slugHint')}
              >
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{store.slug}</code>
              </DetailRow>
              <Separator />
              <DetailRow
                icon={Lock}
                label={t('settings.storefront.details.country')}
                hint={t('settings.storefront.details.countryHint')}
              >
                <span className="text-sm">{store.country ?? t('common.labels.emptyValue')}</span>
              </DetailRow>
              <Separator />
              <DetailRow icon={CalendarDays} label={t('settings.storefront.details.lastUpdated')}>
                <span className="text-sm">{fmt.date(store.updatedAt)}</span>
              </DetailRow>
          </SettingsSection>
        </SettingsSections>
      </div>

      <UnsavedChangesBar
        visible={dirty || saving}
        saving={saving}
        onDiscard={handleDiscard}
        onSave={handleSave}
      />

      <MediaPicker
        open={picker !== null}
        onClose={() => setPicker(null)}
        onSelect={onPickImage}
        multiple={false}
        acceptedTypes={['image']}
      />
    </div>
  );
}

// ─── Presentational helpers ───────────────────────────────────────────────────

function StatusBadge({ isOpen, label }: { isOpen: boolean; label: string }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        'gap-1.5 border-transparent',
        isOpen
          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
          : 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', isOpen ? 'bg-emerald-500' : 'bg-amber-500')} />
      {label}
    </Badge>
  );
}

/** Input with a leading icon (support-contact fields). */
function IconInput({ icon: Icon, className, ...props }: ComponentProps<typeof Input> & { icon: LucideIcon }) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-muted-foreground" />
      <Input className={cn('pl-9', className)} {...props} />
    </div>
  );
}

function FieldError({ messageKey }: { messageKey?: TranslationKey }) {
  const { t } = useTranslation();
  if (!messageKey) return null;
  return <p className="text-xs text-destructive">{t(messageKey)}</p>;
}

/** Labeled read-only row in the "Store details" section. */
function DetailRow({
  icon: Icon,
  label,
  hint,
  children,
}: {
  icon: LucideIcon;
  label: string;
  /** Explanation folded behind an info icon rather than printed under the value. */
  hint?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-1">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="w-3 h-3" /> {label}
        {hint && (
          <InfoHint label={t('settings.storefront.details.hintLabel', { label })} align="start" className="-my-1">
            {hint}
          </InfoHint>
        )}
      </p>
      {children}
    </div>
  );
}

/** Loading state mirroring the hero + two-column layout. */
function StorefrontSkeleton() {
  return (
    <div className="space-y-6">
      <div className="overflow-hidden max-md:-mx-6 md:rounded-xl md:border md:bg-card md:shadow-sm">
        <Skeleton className="aspect-[3/1] min-h-[130px] max-h-[260px] w-full rounded-none" />
      </div>
      <div className="md:px-6 md:pb-5">
        <div className="flex items-end gap-4">
          <Skeleton className="-mt-10 h-20 w-20 rounded-xl border-4 border-card sm:-mt-12 sm:h-24 sm:w-24" />
          <div className="flex-1 space-y-2 pb-1">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Skeleton className="h-56 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-36 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
