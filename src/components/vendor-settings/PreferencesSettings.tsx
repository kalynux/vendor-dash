import { useCallback, useEffect, useState } from 'react';
import { Loader2, Save, Send, Clock, Moon, Sun } from 'lucide-react';
import { toast } from 'sonner';

import { onboardingService } from '@/services/onboarding.service';
import { mapProfileError } from '@/components/vendor-settings/errors';
import { useUIStore } from '@/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const MIN_CANCEL_DAYS = 1;
const MAX_CANCEL_DAYS = 90;

export function PreferencesSettings() {
  const { theme, setTheme } = useUIStore();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-redirect orders to agency.
  const [autoRedirect, setAutoRedirect] = useState(false);
  const [threshold, setThreshold] = useState('');
  // Auto-cancel unpaid orders.
  const [cancelDays, setCancelDays] = useState('');

  // Last-saved snapshot, for dirty checking.
  const [saved, setSaved] = useState({ autoRedirect: false, threshold: '', cancelDays: '' });

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    Promise.all([
      onboardingService.getAutoRedirectOrders(),
      onboardingService.getAutoCancelUnpaidDays(),
    ])
      .then(([redirect, cancel]) => {
        if (!active) return;
        const redirectEnabled = redirect.data.autoRedirectOrdersToAgency;
        const thresholdStr =
          redirect.data.autoRedirectThresholdAmount != null
            ? String(redirect.data.autoRedirectThresholdAmount)
            : '';
        const daysStr = String(cancel.data.autoCancelUnpaidDays);
        setAutoRedirect(redirectEnabled);
        setThreshold(thresholdStr);
        setCancelDays(daysStr);
        setSaved({ autoRedirect: redirectEnabled, threshold: thresholdStr, cancelDays: daysStr });
      })
      .catch((err) => {
        if (active) setLoadError(mapProfileError(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const redirectDirty = autoRedirect !== saved.autoRedirect || threshold !== saved.threshold;
  const cancelDirty = cancelDays !== saved.cancelDays;
  const dirty = redirectDirty || cancelDirty;

  const daysNum = Number(cancelDays);
  const daysInvalid =
    cancelDays.trim() === '' ||
    !Number.isInteger(daysNum) ||
    daysNum < MIN_CANCEL_DAYS ||
    daysNum > MAX_CANCEL_DAYS;

  const thresholdNum = Number(threshold);
  const thresholdInvalid =
    threshold.trim() !== '' && (Number.isNaN(thresholdNum) || thresholdNum < 0);

  const handleSave = useCallback(async () => {
    if (daysInvalid || thresholdInvalid) return;
    setSaving(true);
    setError(null);
    try {
      let nextRedirect = autoRedirect;
      let nextThreshold = threshold;
      let nextDays = cancelDays;
      if (redirectDirty) {
        const res = await onboardingService.updateAutoRedirectOrders({
          enabled: autoRedirect,
          thresholdAmount: threshold.trim() === '' ? null : thresholdNum,
        });
        nextRedirect = res.data.autoRedirectOrdersToAgency;
        nextThreshold =
          res.data.autoRedirectThresholdAmount != null
            ? String(res.data.autoRedirectThresholdAmount)
            : '';
      }
      if (cancelDirty) {
        const res = await onboardingService.updateAutoCancelUnpaidDays({ days: daysNum });
        nextDays = String(res.data.autoCancelUnpaidDays);
      }
      setAutoRedirect(nextRedirect);
      setThreshold(nextThreshold);
      setCancelDays(nextDays);
      setSaved({ autoRedirect: nextRedirect, threshold: nextThreshold, cancelDays: nextDays });
      toast.success('Preferences saved');
    } catch (err) {
      setError(mapProfileError(err));
    } finally {
      setSaving(false);
    }
  }, [
    autoRedirect, threshold, thresholdNum, thresholdInvalid,
    cancelDays, daysNum, daysInvalid, redirectDirty, cancelDirty,
  ]);

  const appearanceCard = (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>Choose how the dashboard looks to you.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted text-muted-foreground flex-shrink-0">
              {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </div>
            <div>
              <p className="font-medium">Theme</p>
              <p className="text-sm text-muted-foreground">Choose your preferred theme</p>
            </div>
          </div>
          <Select
            value={theme}
            onValueChange={(v) => setTheme(v as 'light' | 'dark' | 'system')}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {appearanceCard}
        <Card>
          <CardContent className="space-y-4 pt-6">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {appearanceCard}
      <Card>
      <CardHeader>
        <CardTitle>Order Automation</CardTitle>
        <CardDescription>
          Automate order handling to reduce manual dispatch and clean up unpaid orders.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {(error || loadError) && (
          <div
            role="alert"
            className="p-3 text-sm bg-destructive/10 text-destructive rounded-lg border border-destructive/20"
          >
            {error ?? loadError}
          </div>
        )}

        {/* Auto-redirect orders to agency */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-lg bg-muted text-muted-foreground flex-shrink-0">
                <Send className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="font-medium">Auto-dispatch paid orders</p>
                <p className="text-sm text-muted-foreground">
                  Automatically advance a paid physical order to the agency in charge.
                </p>
              </div>
            </div>
            <Switch
              checked={autoRedirect}
              onCheckedChange={setAutoRedirect}
              aria-label="Auto-dispatch paid orders"
            />
          </div>

          <div className="space-y-1.5 pl-12">
            <Label htmlFor="auto-redirect-threshold">Maximum order total (optional)</Label>
            <Input
              id="auto-redirect-threshold"
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="No cap"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              disabled={!autoRedirect}
              aria-invalid={thresholdInvalid}
            />
            <p className="text-xs text-muted-foreground">
              Orders above this total stay pending for manual dispatch. Leave empty for no cap.
            </p>
          </div>
        </div>

        {/* Auto-cancel unpaid orders */}
        <div className="space-y-1.5 border-t pt-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-muted text-muted-foreground flex-shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="font-medium">Auto-cancel unpaid orders</p>
              <p className="text-sm text-muted-foreground">
                Cancel orders left unpaid after this many days.
              </p>
            </div>
          </div>
          <div className="pl-12 space-y-1.5">
            <Label htmlFor="auto-cancel-days">Days before cancel</Label>
            <Input
              id="auto-cancel-days"
              type="number"
              inputMode="numeric"
              min={MIN_CANCEL_DAYS}
              max={MAX_CANCEL_DAYS}
              value={cancelDays}
              onChange={(e) => setCancelDays(e.target.value)}
              aria-invalid={daysInvalid}
              className="max-w-[8rem]"
            />
            <p className="text-xs text-muted-foreground">
              Between {MIN_CANCEL_DAYS} and {MAX_CANCEL_DAYS} days.
            </p>
          </div>
        </div>

        <div className="flex justify-end border-t pt-4">
          <Button
            type="button"
            onClick={handleSave}
            disabled={!dirty || saving || daysInvalid || thresholdInvalid}
            className="gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </Button>
        </div>
      </CardContent>
      </Card>
    </div>
  );
}
