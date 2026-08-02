import { useCallback, useMemo, useState } from 'react';
import { Eye, EyeOff, Globe, Loader2, Lock, Save, Shield } from 'lucide-react';
import { toast } from 'sonner';

import { onboardingService } from '@/services/onboarding.service';
import { mapProfileError } from '@/components/vendor-settings/errors';
import { Button } from '@/components/ui/button';
import {
  SettingsSection,
  SettingsSections,
} from '@/components/vendor-settings/SettingsSection';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';

// Mirror the backend password policy (see api-doc/me/password.md).
function passwordIssue(pw: string): string | null {
  if (pw.length < 8) return 'At least 8 characters';
  if (!/[A-Z]/.test(pw)) return 'At least one uppercase letter';
  if (!/[a-z]/.test(pw)) return 'At least one lowercase letter';
  if (!/[0-9]/.test(pw)) return 'At least one number';
  if (!/[^A-Za-z0-9]/.test(pw)) return 'At least one special character';
  return null;
}

export function SecuritySettings() {
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const newIssue = useMemo(() => (next ? passwordIssue(next) : null), [next]);
  const confirmMismatch = confirm.length > 0 && confirm !== next;
  const canSubmit =
    current.length > 0 && next.length > 0 && !newIssue && !confirmMismatch && !saving;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      await onboardingService.changePassword({ oldPassword: current, newPassword: next });
      toast.success('Password updated. Use your new password next time you log in.');
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      setError(mapProfileError(err));
    } finally {
      setSaving(false);
    }
  }, [canSubmit, current, next]);

  return (
    <SettingsSections>
      {/* Password change */}
      <SettingsSection
        title="Change Password"
        icon={Lock}
        info="Use a password you don't use anywhere else. Changing it doesn't sign you out of this device, but you'll need the new one next time you log in."
        contentClassName="space-y-4 max-w-md"
      >
          {error && (
            <div
              role="alert"
              className="p-3 text-sm bg-destructive/10 text-destructive rounded-lg border border-destructive/20"
            >
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="current-password">Current Password</Label>
            <div className="relative">
              <Input
                id="current-password"
                type={showCurrent ? 'text' : 'password'}
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((s) => !s)}
                aria-label={showCurrent ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNew ? 'text' : 'password'}
                value={next}
                onChange={(e) => setNext(e.target.value)}
                autoComplete="new-password"
                aria-invalid={!!newIssue}
              />
              <button
                type="button"
                onClick={() => setShowNew((s) => !s)}
                aria-label={showNew ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className={newIssue ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
              {newIssue
                ? newIssue
                : '8+ chars with upper & lower case, a number, and a special character.'}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <Input
              id="confirm-password"
              type={showNew ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              aria-invalid={confirmMismatch}
            />
            {confirmMismatch && (
              <p className="text-xs text-destructive">Passwords don't match.</p>
            )}
          </div>

          <div className="pt-2">
            <Button onClick={handleSubmit} disabled={!canSubmit} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Update Password
            </Button>
          </div>
      </SettingsSection>

      {/* Not-yet-implemented security features, greyed out. */}
      <SettingsSection
        className="opacity-60"
        icon={Shield}
        title={
          <span className="flex items-center gap-2">
            Two-Factor Authentication
            <Badge variant="outline">Coming soon</Badge>
          </span>
        }
        info="A second step at login — a code from your phone on top of your password. Not available yet."
      >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Not available yet — this will be enabled in a future update.
            </p>
            <Switch disabled aria-label="Enable two-factor authentication" />
          </div>
      </SettingsSection>

      <SettingsSection
        className="opacity-60"
        icon={Globe}
        title={
          <span className="flex items-center gap-2">
            Active Sessions
            <Badge variant="outline">Coming soon</Badge>
          </span>
        }
        info="Review the devices signed in to your account and sign them out remotely. Not available yet."
      >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Not available yet — this will be enabled in a future update.
            </p>
            <Button variant="outline" size="sm" disabled>
              Revoke
            </Button>
          </div>
      </SettingsSection>
    </SettingsSections>
  );
}
