import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Save, Image as ImageIcon, X, ExternalLink, Lock, Store as StoreIcon } from 'lucide-react';
import { toast } from 'sonner';

import { useStoreStore } from '@/store';
import { updateStore, updateStoreStatus } from '@/services/store.service';
import { resolveFileUrl } from '@/services/files.service';
import { MediaPicker } from '@/components/features/MediaPicker';
import { mapProfileError } from '@/components/vendor-settings/errors';
import { ApiError } from '@/types/api';
import type { ApiFile } from '@/types/file.types';
import type { StoreUpdatePayload, VendorStore } from '@/types/store.types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';

// The editable string fields, in payload key order. `name` is required (2–100);
// the rest are nullable. slug + country are immutable (rendered read-only).
type EditableKey =
  | 'name'
  | 'description'
  | 'address'
  | 'city'
  | 'supportEmail'
  | 'supportPhone'
  | 'supportWhatsapp';

interface FormState {
  name: string;
  description: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  address: string;
  city: string;
  supportEmail: string;
  supportPhone: string;
  supportWhatsapp: string;
}

function toForm(s: VendorStore): FormState {
  return {
    name: s.name ?? '',
    description: s.description ?? '',
    logoUrl: s.logoUrl,
    bannerUrl: s.bannerUrl,
    address: s.address ?? '',
    city: s.city ?? '',
    supportEmail: s.supportEmail ?? '',
    supportPhone: s.supportPhone ?? '',
    supportWhatsapp: s.supportWhatsapp ?? '',
  };
}

/** Normalize an editable text value: trim, and treat an empty string as `null`. */
function norm(v: string): string | null {
  const t = v.trim();
  return t === '' ? null : t;
}

/**
 * Build the PATCH payload from the diff between the edited form and the stored
 * store, always including `version`. Only changed fields are sent (partial
 * update). `name` is sent as-is (required); every other field is null-normalized.
 */
function buildPayload(form: FormState, store: VendorStore): StoreUpdatePayload {
  const payload: StoreUpdatePayload = { version: store.version };

  if (form.name.trim() !== (store.name ?? '')) payload.name = form.name.trim();

  const stringFields: Exclude<EditableKey, 'name'>[] = [
    'description',
    'address',
    'city',
    'supportEmail',
    'supportPhone',
    'supportWhatsapp',
  ];
  for (const key of stringFields) {
    const next = norm(form[key]);
    if (next !== (store[key] ?? null)) payload[key] = next;
  }

  if (form.logoUrl !== store.logoUrl) payload.logoUrl = form.logoUrl;
  if (form.bannerUrl !== store.bannerUrl) payload.bannerUrl = form.bannerUrl;

  return payload;
}

export function StorefrontSettings() {
  const { store, isLoading, fetchStore, applyStore } = useStoreStore();

  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState<'logo' | 'banner' | null>(null);
  const [togglingVacation, setTogglingVacation] = useState(false);
  const [fetchAttempted, setFetchAttempted] = useState(false);

  // Load the store if it wasn't already fetched by the dashboard shell.
  useEffect(() => {
    if (!store && !isLoading && !fetchAttempted) {
      fetchStore()
      setFetchAttempted(true);
    }
  }, [store, isLoading, fetchStore, fetchAttempted]);

  // (Re)seed the form whenever the underlying store changes (initial load / save).
  useEffect(() => {
    if (store) setForm(toForm(store));
  }, [store]);

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }, []);

  const dirty = useMemo(() => {
    if (!store || !form) return false;
    return Object.keys(buildPayload(form, store)).length > 1; // more than just `version`
  }, [store, form]);

  const handleSave = useCallback(async () => {
    if (!store || !form) return;
    if (form.name.trim().length < 2) {
      setError('Store name must be at least 2 characters.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await updateStore(buildPayload(form, store));
      applyStore(updated);
      toast.success('Storefront updated');
    } catch (err) {
      if (err instanceof ApiError && err.isConflict) {
        // Optimistic-locking clash — refresh so the vendor edits the latest.
        toast.error('Storefront was updated elsewhere. Refreshed — please re-apply your changes.');
        await fetchStore();
      } else {
        setError(mapProfileError(err));
      }
    } finally {
      setSaving(false);
    }
  }, [store, form, applyStore, fetchStore]);

  const handleVacationToggle = useCallback(
    async (nextOpen: boolean) => {
      if (!store) return;
      setTogglingVacation(true);
      try {
        const updated = await updateStoreStatus({ isOpen: nextOpen, version: store.version });
        applyStore(updated);
        toast.success(nextOpen ? 'Store reopened' : 'Vacation mode enabled — store is now closed');
      } catch (err) {
        if (err instanceof ApiError && err.isConflict) {
          toast.error('Storefront was updated elsewhere. Please try again.');
          await fetchStore();
        } else {
          toast.error(mapProfileError(err));
        }
      } finally {
        setTogglingVacation(false);
      }
    },
    [store, applyStore, fetchStore],
  );

  const onPickImage = useCallback(
    (files: ApiFile[]) => {
      const file = files[0];
      if (file && picker) set(picker === 'logo' ? 'logoUrl' : 'bannerUrl', resolveFileUrl(file));
      setPicker(null);
    },
    [picker, set],
  );

  if (isLoading && !store) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Storefront</CardTitle>
          <CardDescription>Your public store identity and support contacts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!store || !form) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Storefront</CardTitle>
          <CardDescription>Your public store identity and support contacts.</CardDescription>
        </CardHeader>
        <CardContent>
          <div role="alert" className="p-3 text-sm bg-destructive/10 text-destructive rounded-lg border border-destructive/20">
            Could not load your storefront.
          </div>
          <Button variant="outline" className="mt-3" onClick={fetchStore}>Try again</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Vacation mode */}
      <Card>
        <CardHeader>
          <CardTitle>Store status</CardTitle>
          <CardDescription>
            Temporarily close your storefront without deleting anything. Customers see a closed notice while on vacation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`p-2 rounded-lg flex-shrink-0 ${store.isOpen ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                <StoreIcon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{store.isOpen ? 'Open for business' : 'On vacation'}</p>
                  <Badge variant="secondary" className={store.isOpen ? 'text-emerald-600' : 'text-amber-600'}>
                    {store.isOpen ? 'Open' : 'Closed'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {store.isOpen ? 'Your store is visible and accepting orders.' : 'New orders are paused until you reopen.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {togglingVacation && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              <Switch
                checked={store.isOpen}
                disabled={togglingVacation}
                onCheckedChange={handleVacationToggle}
                aria-label="Store open for business"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Storefront profile */}
      <Card>
        <CardHeader>
          <CardTitle>Storefront</CardTitle>
          <CardDescription>Your public store identity — what customers see on your storefront page.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div role="alert" className="p-3 text-sm bg-destructive/10 text-destructive rounded-lg border border-destructive/20">
              {error}
            </div>
          )}

          {/* Read-only identity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-muted-foreground">
                <Lock className="w-3 h-3" /> Store URL (read-only)
              </Label>
              <a
                href={store.publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline break-all"
              >
                {store.publicUrl}
                <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
              </a>
              <p className="text-xs text-muted-foreground">
                The slug (<code className="font-mono">{store.slug}</code>) can't be changed — contact support if you need a new URL.
              </p>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-muted-foreground">
                <Lock className="w-3 h-3" /> Country (read-only)
              </Label>
              <p className="text-sm">{store.country}</p>
              <p className="text-xs text-muted-foreground">Locked for tax and shipping compliance.</p>
            </div>
          </div>

          {/* Logo + banner */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ImageField
              label="Logo"
              url={form.logoUrl}
              onChoose={() => setPicker('logo')}
              onClear={() => set('logoUrl', null)}
              aspect="aspect-square w-24"
            />
            <ImageField
              label="Banner"
              url={form.bannerUrl}
              onChoose={() => setPicker('banner')}
              onClear={() => set('bannerUrl', null)}
              aspect="aspect-[3/1] w-full"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="store-name">Store name</Label>
            <Input
              id="store-name"
              value={form.name}
              maxLength={100}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Your store's display name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="store-description">Description</Label>
            <Textarea
              id="store-description"
              value={form.description}
              maxLength={1000}
              rows={4}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Tell customers what your store is about"
            />
            <p className="text-xs text-muted-foreground text-right">{form.description.length}/1000</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="store-address">Address</Label>
              <Input id="store-address" value={form.address} maxLength={200} onChange={(e) => set('address', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="store-city">City</Label>
              <Input id="store-city" value={form.city} maxLength={100} onChange={(e) => set('city', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="store-email">Support email</Label>
              <Input id="store-email" type="email" value={form.supportEmail} onChange={(e) => set('supportEmail', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="store-phone">Support phone</Label>
              <Input id="store-phone" value={form.supportPhone} onChange={(e) => set('supportPhone', e.target.value)} placeholder="+2376…" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="store-wa">Support WhatsApp</Label>
              <Input id="store-wa" value={form.supportWhatsapp} onChange={(e) => set('supportWhatsapp', e.target.value)} placeholder="+2376…" />
            </div>
          </div>

          <div className="flex justify-end border-t pt-4">
            <Button onClick={handleSave} disabled={!dirty || saving} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>

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

// ─── Image field (logo / banner) ──────────────────────────────────────────────

function ImageField({
  label,
  url,
  onChoose,
  onClear,
  aspect,
}: {
  label: string;
  url: string | null;
  onChoose: () => void;
  onClear: () => void;
  aspect: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        <div className={`relative overflow-hidden rounded-lg border bg-muted flex items-center justify-center ${aspect}`}>
          {url ? (
            <img src={url} alt={label} className="h-full w-full object-cover" crossOrigin="use-credentials" />
          ) : (
            <ImageIcon className="w-6 h-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Button type="button" variant="outline" size="sm" onClick={onChoose}>
            {url ? 'Change' : 'Choose image'}
          </Button>
          {url && (
            <Button type="button" variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive gap-1" onClick={onClear}>
              <X className="w-3.5 h-3.5" /> Remove
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
