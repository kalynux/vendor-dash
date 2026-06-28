import { useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { COUNTRIES, TIMEZONES } from '@/components/vendor-settings/forms/basicSetup.helpers';
import { mapProfileError } from '@/components/vendor-settings/errors';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * Country + Timezone for the store, bound to the vendor profile.
 * Moved here from "Basic Setup" (now "Payout Setup") so regional settings live
 * alongside the rest of the store configuration.
 */
export function StoreRegionFields() {
  const { session, updateVendorProfile } = useOnboarding();
  const roleEntity = session?.role_entity;

  const [country, setCountry] = useState(roleEntity?.country ?? '');
  const [timezone, setTimezone] = useState(roleEntity?.timezone ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!roleEntity) return null;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateVendorProfile({ country, timezone });
      toast.success('Regional settings updated');
    } catch (err) {
      setError(mapProfileError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Regional Settings</CardTitle>
        <CardDescription>Your operating country and timezone.</CardDescription>
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="store-country">Country</Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger id="store-country">
                <SelectValue placeholder="Select your country" />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="store-timezone">Timezone</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger id="store-timezone">
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
        </div>

        <div className="flex justify-end border-t pt-4">
          <Button onClick={handleSave} disabled={saving || !country || !timezone} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
