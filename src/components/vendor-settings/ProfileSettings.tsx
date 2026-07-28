import { useRef, useState } from 'react';
import { Camera, Globe, Lock, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { COUNTRIES, TIMEZONES } from '@/components/vendor-settings/forms/basicSetup.helpers';
import { mapProfileError } from '@/components/vendor-settings/errors';
import { UnsavedChangesBar } from '@/components/vendor-settings/UnsavedChangesBar';
import { MediaPicker } from '@/components/features/MediaPicker';
import { resolveFileUrl } from '@/services/files.service';
import type { BrandingFileRef, VendorProfileUpdatePayload } from '@/types/api';
import type { ApiFile } from '@/types/file.types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
    <div className="space-y-6">
      {error && (
        <div
          role="alert"
          className="p-3 text-sm bg-destructive/10 text-destructive rounded-lg border border-destructive/20"
        >
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Your personal details and contact information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar */}
          <div className="flex items-center gap-6">
            <div className="relative">
              {avatarUrl ? (
                <>
                  <Avatar className="w-24 h-24 ring-2 ring-border">
                    <AvatarImage
                      src={avatarUrl}
                      alt={fullName || roleEntity.business_name}
                      crossOrigin="use-credentials"
                      className="object-cover"
                    />
                    <AvatarFallback className="text-2xl font-medium">
                      {initialsFrom(fullName || roleEntity.business_name)}
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
                      {initialsFrom(fullName || roleEntity.business_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute inset-0 flex items-center justify-center rounded-full bg-foreground/0 transition-colors group-hover:bg-foreground/40">
                    <Camera className="w-5 h-5 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                  </span>
                </button>
              )}
            </div>
            <div className="space-y-1">
              <p className="font-medium">{fullName || roleEntity.business_name}</p>
              <p className="text-sm text-muted-foreground">{email}</p>
              <p className="text-xs text-muted-foreground">
                Pick an image from your media library.
              </p>
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
              <Label htmlFor="profile-email">Email</Label>
              <Input id="profile-email" type="email" value={email} disabled />
              <p className="text-xs text-muted-foreground">
                Contact support to change your email address.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-phone">Phone</Label>
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
              <Label htmlFor="profile-whatsapp">WhatsApp Number</Label>
              <Input
                id="profile-whatsapp"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="+237 6XX XXX XXX"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="profile-role">Role</Label>
              <div className="relative">
                <Input id="profile-role" value={roleLabel} disabled />
                <ShieldCheck className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Localization — profile-level regional settings (PATCH /vendor/profile) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-muted-foreground" />
            Localization
          </CardTitle>
          <CardDescription>Your operating country, timezone, and language.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-muted-foreground">
                <Lock className="w-3 h-3" /> Country
              </Label>
              <Input value={countryLabel} disabled readOnly aria-label="Country (read-only)" />
              <p className="text-xs text-muted-foreground">
                Set once during onboarding — locked for tax, shipping, and address policy.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-timezone">Timezone</Label>
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
              <Label htmlFor="profile-language">Language</Label>
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
              <p className="text-xs text-muted-foreground">
                Language used for your notifications.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

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
    </div>
  );
}
