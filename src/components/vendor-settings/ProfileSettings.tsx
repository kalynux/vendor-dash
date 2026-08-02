import { useRef, useState } from 'react';
import { Camera, Globe, Lock, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { useStoreStore } from '@/store';
import { COUNTRIES, TIMEZONES } from '@/components/vendor-settings/forms/basicSetup.helpers';
import { mapProfileError } from '@/components/vendor-settings/errors';
import { UnsavedChangesBar } from '@/components/vendor-settings/UnsavedChangesBar';
import { MediaPicker } from '@/components/features/MediaPicker';
import { resolveFileUrl } from '@/services/files.service';
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

/** Languages the backend renders notifications in (preferred_language). */
const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'French' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'es', label: 'Spanish' },
  { value: 'ar', label: 'Arabic' },
];

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
  const { session, updateVendorProfile, isSubmitting } = useOnboarding();
  const { store } = useStoreStore();
  const roleEntity = session?.role_entity;

  const [error, setError] = useState<string | null>(null);

  // Backed fields — dirty is derived by comparing against the live role_entity,
  // so a successful save (which merges into the session) auto-clears it.
  const [fullName, setFullName] = useState(roleEntity?.display_name ?? '');
  const [phone, setPhone] = useState(roleEntity?.phone ?? '');
  const [timezone, setTimezone] = useState(roleEntity?.timezone ?? '');
  const [language, setLanguage] = useState(roleEntity?.preferred_language ?? 'en');

  // Avatar (backed): `undefined` = unchanged; a file ref = newly uploaded;
  // `null` = cleared. The saved value lives on role_entity.avatar.
  const [pendingAvatar, setPendingAvatar] = useState<BrandingFileRef | null | undefined>(undefined);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);

  // Pending-backend field (local placeholder data for now).
  const [whatsapp, setWhatsapp] = useState(roleEntity?.phone ?? '');
  const savedLocal = useRef({ whatsapp });

  if (!roleEntity || !session) return null;

  const email = roleEntity.email;
  // Label for the avatar / initials. The business name moved to the Store, so the
  // fallback chain is personal display name → store name → email local-part.
  const displayLabel = fullName || store?.name || email.split('@')[0];
  const role = session.role; // e.g. "vendor" — not editable
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
  const countryLabel = roleEntity.country
    ? (COUNTRIES.find((c) => c.code === roleEntity.country)?.name ?? roleEntity.country)
    : '—';

  // Saved avatar comes from the session; the local pending value overrides it
  // until the next save (`undefined` means "no local change").
  const savedAvatar = roleEntity.avatar ?? null;
  const displayedAvatar = pendingAvatar !== undefined ? pendingAvatar : savedAvatar;
  const avatarUrl = displayedAvatar?.url;
  const avatarChanged = (displayedAvatar?.id ?? null) !== (savedAvatar?.id ?? null);

  const nameChanged = fullName !== (roleEntity.display_name ?? '');
  const phoneChanged = phone !== (roleEntity.phone ?? '');
  const timezoneChanged = timezone !== (roleEntity.timezone ?? '');
  const languageChanged = language !== (roleEntity.preferred_language ?? 'en');
  const dirty =
    nameChanged ||
    phoneChanged ||
    timezoneChanged ||
    languageChanged ||
    avatarChanged ||
    whatsapp !== savedLocal.current.whatsapp;

  // displayName (2–100 chars) and phone (8–20 chars) are NOT clearable —
  // sending "" would be rejected (README Conventions), so block empty edits.
  const nameInvalid = nameChanged && fullName.trim().length < 2;
  const phoneInvalid =
    phoneChanged && (phone.trim().length < 8 || phone.trim().length > 20);

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
    setPhone(roleEntity.phone ?? '');
    setTimezone(roleEntity.timezone ?? '');
    setLanguage(roleEntity.preferred_language ?? 'en');
    setPendingAvatar(undefined);
    setWhatsapp(savedLocal.current.whatsapp);
    setError(null);
  };

  const handleSave = async () => {
    if (nameInvalid || phoneInvalid) {
      setError('Please fix the highlighted fields before saving.');
      return;
    }
    setError(null);
    try {
      // Only send changed fields — omitted keys are left unchanged server-side.
      // Country is never sent: it is set-once (PROFILE_COUNTRY_IMMUTABLE).
      // whatsapp is not yet accepted by the backend — kept local.
      const payload: Omit<VendorProfileUpdatePayload, 'version'> = {};
      if (nameChanged) payload.displayName = fullName.trim();
      if (phoneChanged) payload.phone = phone.trim();
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
      }
      savedLocal.current = { whatsapp };
      toast.success('Profile updated');
    } catch (err) {
      setError(mapProfileError(err));
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
        title="Profile"
        info={
          <>
            Your personal details. The name and photo here are what teammates and
            support see — your public storefront name lives under the Store tab.
            Tap your photo to pick a new one from your media library.
          </>
        }
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
                      crossOrigin="use-credentials"
                      className="object-cover"
                    />
                    <AvatarFallback className="text-2xl font-medium">
                      {initialsFrom(displayLabel)}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    onClick={() => setAvatarPickerOpen(true)}
                    aria-label="Change photo"
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
                  aria-label="Add photo"
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
                  Remove photo
                </button>
              )}
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="profile-name">Full Name</Label>
              <Input
                id="profile-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
                aria-invalid={nameInvalid}
              />
              {nameInvalid && (
                <p className="text-xs text-destructive">Name must be at least 2 characters.</p>
              )}
            </div>

            <div className="space-y-2">
              <LabelWithHint
                htmlFor="profile-email"
                hintLabel="About your email"
                hint="This is the address you sign in with, and where receipts and account notices are sent. It can't be edited here — contact support to change it."
              >
                Email
              </LabelWithHint>
              <Input id="profile-email" type="email" value={email} disabled />
            </div>

            <div className="space-y-2">
              <LabelWithHint
                htmlFor="profile-phone"
                hintLabel="About your phone number"
                hint="Your account phone number, used for account and payout follow-ups. Include the country code, e.g. +237699000001. Between 8 and 20 characters."
              >
                Phone
              </LabelWithHint>
              <Input
                id="profile-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+237 6XX XXX XXX"
                aria-invalid={phoneInvalid}
              />
              {phoneInvalid && (
                <p className="text-xs text-destructive">Phone must be 8–20 characters.</p>
              )}
            </div>

            <div className="space-y-2">
              <LabelWithHint
                htmlFor="profile-whatsapp"
                hintLabel="About your WhatsApp number"
                hint="The number you take order questions on. Separate from your account phone — the one customers see on your storefront is set under Store → Support & contact."
              >
                WhatsApp Number
              </LabelWithHint>
              <Input
                id="profile-whatsapp"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="+237 6XX XXX XXX"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <LabelWithHint
                htmlFor="profile-role"
                hintLabel="About your role"
                hint="What this account may do on the platform. Set by the platform and not editable."
              >
                Role
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
        title="Localization"
        icon={Globe}
        info="Where you operate and in which language you're contacted. Your country drives tax, shipping and address rules; your timezone is used for every date and time in the dashboard."
      >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <LabelWithHint
                hintLabel="About your country"
                hint="Set once during onboarding and locked afterwards — it decides your tax, shipping, and address rules, and your business addresses must fall inside it. Contact support if it needs to change."
              >
                <Lock className="mr-1.5 w-3 h-3 text-muted-foreground" /> Country
              </LabelWithHint>
              <Input value={countryLabel} disabled readOnly aria-label="Country (read-only)" />
            </div>

            <div className="space-y-2">
              <LabelWithHint
                htmlFor="profile-timezone"
                hintLabel="About your timezone"
                hint="Every order time, report, and schedule in the dashboard is shown in this zone. Changing it re-labels existing timestamps; it doesn't move them."
              >
                Timezone
              </LabelWithHint>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger id="profile-timezone">
                  <SelectValue placeholder="Select your timezone" />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <LabelWithHint
                htmlFor="profile-language"
                hintLabel="About your language"
                hint="The language your notifications are written in — email, WhatsApp, Telegram and in-app alerts. It does not change the language of this dashboard."
              >
                Language
              </LabelWithHint>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger id="profile-language">
                  <SelectValue placeholder="Select a language" />
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
