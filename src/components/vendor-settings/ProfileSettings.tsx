import { useRef, useState } from 'react';
import { Camera, Globe, Lock, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { useStoreStore } from '@/store';
import { PhoneInput } from '@/components/phone';
import { normalizeStoredPhone, phoneErrorKey, toE164 } from '@/lib/phone';
import { TIMEZONES } from '@/components/vendor-settings/forms/basicSetup.helpers';
import { UnsavedChangesBar } from '@/components/vendor-settings/UnsavedChangesBar';
import { MediaPicker } from '@/components/features/MediaPicker';
import { resolveFileUrl } from '@/services/files.service';
import {
  useTranslation,
  useApiError,
  useFormatters,
  LOCALES,
  SELECTABLE_LOCALES,
  clearManualLocale,
} from '@/i18n';
import type { BrandingFileRef, VendorProfileUpdatePayload } from '@/types/api';
import type { ApiFile } from '@/types/file.types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LabelWithHint } from '@/components/ui/info-hint';
import {
  SettingsSection,
  SettingsSections,
} from '@/components/vendor-settings/SettingsSection';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * The languages on offer come straight from the i18n registry — only locales
 * with a finished catalog, so a vendor can never select one that would render
 * as English. This same value is `preferred_language` on the profile, which the
 * backend uses for notifications, so the dashboard and the emails agree.
 */
const LANGUAGES = SELECTABLE_LOCALES.map((code) => ({
  value: code,
  label: LOCALES[code].nativeLabel,
}));

/** Up-to-two-letter initials for the avatar fallback. */
function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

/**
 * The vendor profile tab: personal details + localization, saved together with
 * ONE floating save bar → one PATCH /vendor/profile call (only changed fields).
 *
 *  - Full Name → displayName (editable)
 *  - Phone     → phone (editable)
 *  - Email     → read-only (server-gated by ALLOW_EMAIL_CHANGE)
 *  - Role      → read-only (from the auth session)
 *  - Country   → read-only (set once at onboarding — PROFILE_COUNTRY_IMMUTABLE)
 *  - Timezone / Language → editable (the profile's localization surface)
 *  - Avatar → backed (`avatarFileId`): pick from the media library (MediaPicker),
 *    then persist the file id with the rest of the profile patch.
 *
 * WhatsApp number is still rendered against local placeholder state until the
 * backend exposes a dedicated field — it persists locally for now.
 */
export function ProfileSettings() {
  const { t, tDynamic, hasKey } = useTranslation();
  const fmt = useFormatters();
  const apiError = useApiError();
  const { session, updateVendorProfile, isSubmitting } = useOnboarding();
  const { store } = useStoreStore();
  const roleEntity = session?.role_entity;

  const [error, setError] = useState<string | null>(null);

  // Backed fields — dirty is derived by comparing against the live role_entity,
  // so a successful save (which merges into the session) auto-clears it.
  const [fullName, setFullName] = useState(roleEntity?.display_name ?? '');
  // Seeded canonically (E.164): a record saved before phone numbers were
  // standardized would otherwise read as edited the moment the field renders.
  const [phone, setPhone] = useState(() => normalizeStoredPhone(roleEntity?.phone));
  const [timezone, setTimezone] = useState(roleEntity?.timezone ?? '');
  const [language, setLanguage] = useState(roleEntity?.preferred_language ?? 'en');

  // Avatar (backed): `undefined` = unchanged; a file ref = newly uploaded;
  // `null` = cleared. The saved value lives on role_entity.avatar.
  const [pendingAvatar, setPendingAvatar] = useState<BrandingFileRef | null | undefined>(undefined);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);

  // Pending-backend field (local placeholder data for now).
  const [whatsapp, setWhatsapp] = useState(() => normalizeStoredPhone(roleEntity?.phone));
  const savedLocal = useRef({ whatsapp });

  if (!roleEntity || !session) return null;

  const email = roleEntity.email;
  // Label for the avatar / initials. The business name moved to the Store, so the
  // fallback chain is personal display name → store name → email local-part.
  const displayLabel = fullName || store?.name || email.split('@')[0];
  const role = session.role; // e.g. "vendor" — not editable
  // Localized where we know the role, otherwise the raw value title-cased.
  const roleKey = `account.profile.roles.${role}`;
  const roleLabel = hasKey(roleKey) ? tDynamic(roleKey) : role.charAt(0).toUpperCase() + role.slice(1);
  const countryLabel = roleEntity.country
    ? fmt.country(roleEntity.country)
    : '—';

  // Saved avatar comes from the session; the local pending value overrides it
  // until the next save (`undefined` means "no local change").
  const savedAvatar = roleEntity.avatar ?? null;
  const displayedAvatar = pendingAvatar !== undefined ? pendingAvatar : savedAvatar;
  const avatarUrl = displayedAvatar?.url;
  const avatarChanged = (displayedAvatar?.id ?? null) !== (savedAvatar?.id ?? null);

  const savedPhone = normalizeStoredPhone(roleEntity.phone);
  const nameChanged = fullName !== (roleEntity.display_name ?? '');
  const phoneChanged = phone !== savedPhone;
  const timezoneChanged = timezone !== (roleEntity.timezone ?? '');
  const languageChanged = language !== (roleEntity.preferred_language ?? 'en');
  const whatsappChanged = whatsapp !== savedLocal.current.whatsapp;
  const dirty =
    nameChanged ||
    phoneChanged ||
    timezoneChanged ||
    languageChanged ||
    avatarChanged ||
    whatsappChanged;

  // displayName (2–100 chars) and phone are NOT clearable — sending "" would be
  // rejected (README Conventions), so block empty edits. The phone is validated
  // against its country's numbering plan and stored as E.164. Both checks are
  // gated on "changed" so an unparseable legacy value doesn't lock the vendor
  // out of editing everything else on the tab.
  const nameInvalid = nameChanged && fullName.trim().length < 2;
  const phoneInvalid = phoneChanged && phoneErrorKey(phone, { required: true }) !== null;
  const whatsappInvalid = whatsappChanged && phoneErrorKey(whatsapp) !== null;

  // The MediaPicker returns a library file (uploading, if needed, happens inside
  // the picker). We keep the populated file ref and persist its id on save.
  const handleAvatarSelect = (files: ApiFile[]) => {
    const file = files[0];
    if (file) {
      setPendingAvatar({
        id: file.id,
        key: file.key,
        url: resolveFileUrl(file),
        mimeType: file.mimeType,
        size: file.size,
        originalName: file.originalName,
      });
    }
    setAvatarPickerOpen(false);
  };

  const handleRemoveAvatar = () => setPendingAvatar(null);

  const handleDiscard = () => {
    setFullName(roleEntity.display_name ?? '');
    setPhone(savedPhone);
    setTimezone(roleEntity.timezone ?? '');
    setLanguage(roleEntity.preferred_language ?? 'en');
    setPendingAvatar(undefined);
    setWhatsapp(savedLocal.current.whatsapp);
    setError(null);
  };

  const handleSave = async () => {
    if (nameInvalid || phoneInvalid || whatsappInvalid) {
      setError(t('common.validation.fixHighlighted'));
      return;
    }
    setError(null);
    try {
      // Only send changed fields — omitted keys are left unchanged server-side.
      // Country is never sent: it is set-once (PROFILE_COUNTRY_IMMUTABLE).
      // whatsapp is not yet accepted by the backend — kept local.
      const payload: Omit<VendorProfileUpdatePayload, 'version'> = {};
      if (nameChanged) payload.displayName = fullName.trim();
      // E.164 — `phoneInvalid` above guarantees this parses.
      if (phoneChanged) payload.phone = toE164(phone) ?? phone.trim();
      if (timezoneChanged) payload.timezone = timezone;
      if (languageChanged) payload.preferred_language = language;
      // `null` detaches the avatar; a file id attaches the newly uploaded one.
      if (avatarChanged) payload.avatarFileId = displayedAvatar ? displayedAvatar.id : null;
      if (Object.keys(payload).length > 0) {
        await updateVendorProfile({
          ...payload,
          // Mirror the populated avatar into role_entity.avatar (the PATCH
          // response doesn't echo it back).
          ...(avatarChanged ? { avatarPreview: displayedAvatar } : {}),
        });
        // The merged session now holds the new avatar — drop the local override.
        if (avatarChanged) setPendingAvatar(undefined);
        // Saving a language here IS the deliberate act that makes it permanent:
        // it is the value the backend renders every notification in. So it
        // retires any pre-sign-in pick from `LanguageSwitcher`, which was only
        // ever an override for "the profile does not know yet"
        // (see LOCALE_MANUAL_KEY). Without this, changing the language on this
        // screen would update the profile and leave the UI in the old one.
        if (languageChanged) clearManualLocale();
      }
      savedLocal.current = { whatsapp };
      toast.success(t('account.profile.updated'));
    } catch (err) {
      setError(apiError.resolve(err));
    }
  };

  return (
    <>
      {error && (
        <div
          role="alert"
          className="mb-4 p-3 text-sm bg-destructive/10 text-destructive rounded-lg border border-destructive/20"
        >
          {error}
        </div>
      )}

      <SettingsSections>
      <SettingsSection
        title={t('account.profile.title')}
        info={t('account.profile.info')}
        contentClassName="space-y-5"
      >
          {/* Avatar */}
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="relative">
              {avatarUrl ? (
                <>
                  <Avatar className="w-24 h-24 ring-2 ring-border">
                    <AvatarImage
                      src={avatarUrl}
                      alt={displayLabel}
                      className="object-cover"
                    />
                    <AvatarFallback className="text-2xl font-medium">
                      {initialsFrom(displayLabel)}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    onClick={() => setAvatarPickerOpen(true)}
                    aria-label={t('account.profile.changePhoto')}
                    className="absolute bottom-0 right-0 p-2 rounded-full bg-primary text-primary-foreground shadow-md hover:opacity-90 transition-opacity"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                </>
              ) : (
                // No photo yet — the whole avatar is a click target to add one.
                <button
                  type="button"
                  onClick={() => setAvatarPickerOpen(true)}
                  aria-label={t('account.profile.addPhoto')}
                  className="group relative rounded-full"
                >
                  <Avatar className="w-24 h-24 ring-2 ring-border">
                    <AvatarFallback className="text-2xl font-medium">
                      {initialsFrom(displayLabel)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute inset-0 flex items-center justify-center rounded-full bg-foreground/0 transition-colors group-hover:bg-foreground/40">
                    <Camera className="w-5 h-5 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                  </span>
                </button>
              )}
            </div>
            <div className="min-w-0 space-y-0.5">
              <p className="truncate font-medium">{displayLabel}</p>
              <p className="truncate text-sm text-muted-foreground">{email}</p>
              {displayedAvatar && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="text-xs text-destructive hover:underline"
                >
                  {t('account.profile.removePhoto')}
                </button>
              )}
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="profile-name">{t('account.profile.fullName')}</Label>
              <Input
                id="profile-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t('account.profile.fullNamePlaceholder')}
                aria-invalid={nameInvalid}
              />
              {nameInvalid && (
                <p className="text-xs text-destructive">{t('account.profile.nameTooShort')}</p>
              )}
            </div>

            <div className="space-y-2">
              <LabelWithHint
                htmlFor="profile-email"
                hintLabel={t('account.profile.emailHintLabel')}
                hint={t('account.profile.emailHint')}
              >
                {t('account.profile.email')}
              </LabelWithHint>
              <Input id="profile-email" type="email" value={email} disabled />
            </div>

            <div className="space-y-2">
              <LabelWithHint
                htmlFor="profile-phone"
                hintLabel={t('account.profile.phoneHintLabel')}
                hint={t('account.profile.phoneHint')}
              >
                {t('account.profile.phone')}
              </LabelWithHint>
              <PhoneInput
                id="profile-phone"
                value={phone}
                onChange={setPhone}
                required
                invalid={phoneInvalid}
              />
            </div>

            <div className="space-y-2">
              <LabelWithHint
                htmlFor="profile-whatsapp"
                hintLabel={t('account.profile.whatsappHintLabel')}
                hint={t('account.profile.whatsappHint')}
              >
                {t('account.profile.whatsapp')}
              </LabelWithHint>
              <PhoneInput
                id="profile-whatsapp"
                value={whatsapp}
                onChange={setWhatsapp}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <LabelWithHint
                htmlFor="profile-role"
                hintLabel={t('account.profile.roleHintLabel')}
                hint={t('account.profile.roleHint')}
              >
                {t('account.profile.role')}
              </LabelWithHint>
              <div className="relative">
                <Input id="profile-role" value={roleLabel} disabled />
                <ShieldCheck className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>
          </div>
      </SettingsSection>

      {/* Localization — profile-level regional settings (PATCH /vendor/profile) */}
      <SettingsSection
        title={t('account.localization.title')}
        icon={Globe}
        info={t('account.localization.info')}
      >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <LabelWithHint
                hintLabel={t('account.localization.countryHintLabel')}
                hint={t('account.localization.countryHint')}
              >
                <Lock className="mr-1.5 w-3 h-3 text-muted-foreground" /> {t('account.localization.country')}
              </LabelWithHint>
              <Input
                value={countryLabel}
                disabled
                readOnly
                aria-label={t('account.localization.countryReadOnly')}
              />
            </div>

            <div className="space-y-2">
              <LabelWithHint
                htmlFor="profile-timezone"
                hintLabel={t('account.localization.timezoneHintLabel')}
                hint={t('account.localization.timezoneHint')}
              >
                {t('account.localization.timezone')}
              </LabelWithHint>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger id="profile-timezone">
                  <SelectValue placeholder={t('account.localization.timezonePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {`${t(tz.cityKey)} (${tz.offset})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <LabelWithHint
                htmlFor="profile-language"
                hintLabel={t('account.localization.languageHintLabel')}
                hint={t('account.localization.languageHint')}
              >
                {t('account.localization.language')}
              </LabelWithHint>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger id="profile-language">
                  <SelectValue placeholder={t('account.localization.languagePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
      </SettingsSection>
      </SettingsSections>

      <UnsavedChangesBar
        visible={dirty || isSubmitting}
        saving={isSubmitting}
        onDiscard={handleDiscard}
        onSave={handleSave}
      />

      <MediaPicker
        open={avatarPickerOpen}
        onClose={() => setAvatarPickerOpen(false)}
        onSelect={handleAvatarSelect}
        multiple={false}
        acceptedTypes={['image']}
      />
    </>
  );
}
