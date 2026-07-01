import { useCallback, useRef, useState } from 'react';
import { Camera, Loader2, Save, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { mapProfileError } from '@/components/vendor-settings/errors';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

/**
 * Personal profile: avatar, full name, email, phone, WhatsApp number, role.
 *
 * Wired to the real vendor session:
 *  - Full Name → display_name (editable via PATCH /vendor/profile)
 *  - Phone     → phone (editable)
 *  - Email     → read-only (server-gated by ALLOW_EMAIL_CHANGE)
 *  - Role      → read-only (from the auth session)
 *
 * Avatar and WhatsApp number are rendered against local placeholder state until
 * the backend exposes `avatar_url` and a WhatsApp number field — see
 * api-doc/vendor/profile-redesign-adjustments.md. They persist locally for now.
 */
export function ProfileSettings() {
  const { session, updateVendorProfile, isSubmitting } = useOnboarding();
  const roleEntity = session?.role_entity;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState<string | null>(null);

  // Backed fields.
  const [fullName, setFullName] = useState(roleEntity?.display_name ?? '');
  const [phone, setPhone] = useState(roleEntity?.phone ?? '');

  // Pending-backend fields (local placeholder data for now).
  const [avatar, setAvatar] = useState(
    () => `https://i.pravatar.cc/160?u=${roleEntity?._id ?? 'vendor'}`,
  );
  const [whatsapp, setWhatsapp] = useState(roleEntity?.phone ?? '');

  const saved = useRef({ fullName, phone, avatar, whatsapp });

  if (!roleEntity || !session) return null;

  const email = roleEntity.email;
  const role = session.role; // e.g. "vendor" — not editable
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);

  const dirty =
    fullName !== saved.current.fullName ||
    phone !== saved.current.phone ||
    avatar !== saved.current.avatar ||
    whatsapp !== saved.current.whatsapp;

  const nameInvalid = fullName.trim().length > 0 && fullName.trim().length < 2;

  const handleAvatarPick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Local preview only until the upload endpoint exists.
    setAvatar(URL.createObjectURL(file));
  }, []);

  const handleSave = useCallback(async () => {
    if (nameInvalid) return;
    setError(null);
    try {
      await updateVendorProfile({
        displayName: fullName.trim(),
        phone: phone.trim(),
        // avatar / whatsapp are not yet accepted by the backend — kept local.
      });
      saved.current = { fullName, phone, avatar, whatsapp };
      toast.success('Profile updated');
    } catch (err) {
      setError(mapProfileError(err));
    }
  }, [fullName, phone, avatar, whatsapp, nameInvalid, updateVendorProfile]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
        <CardDescription>Your personal details and contact information</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div
            role="alert"
            className="p-3 text-sm bg-destructive/10 text-destructive rounded-lg border border-destructive/20"
          >
            {error}
          </div>
        )}

        {/* Avatar */}
        <div className="flex items-center gap-6">
          <div className="relative">
            <img
              src={avatar}
              alt={fullName || roleEntity.business_name}
              className="w-24 h-24 rounded-full object-cover ring-2 ring-border"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Change avatar"
              className="absolute bottom-0 right-0 p-2 rounded-full bg-primary text-primary-foreground shadow-md hover:opacity-90 transition-opacity"
            >
              <Camera className="w-4 h-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif"
              className="hidden"
              onChange={handleAvatarPick}
            />
          </div>
          <div className="space-y-1">
            <p className="font-medium">{fullName || roleEntity.business_name}</p>
            <p className="text-sm text-muted-foreground">{email}</p>
            <p className="text-xs text-muted-foreground">JPG, PNG or GIF. Max size 2MB.</p>
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
            />
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

        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={!dirty || isSubmitting || nameInvalid}
            className="gap-2"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
