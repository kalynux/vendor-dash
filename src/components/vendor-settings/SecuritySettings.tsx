import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Fingerprint, Globe, Loader2, Lock, Save, Shield } from 'lucide-react';
import { toast } from 'sonner';

import { authService } from '@/services/auth.service';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import {
  biometricLoginStatus,
  disableBiometricLogin,
  updateBiometricPassword,
  type BiometricLoginStatus,
} from '@/platform/auth/biometricLogin';
import { mapPasswordError } from '@/components/vendor-settings/errors';
import { ContactDetailsSection } from '@/components/vendor-settings/ContactDetailsSection';
import { Button } from '@/components/ui/button';
import {
  SettingsSection,
  SettingsSections,
} from '@/components/vendor-settings/SettingsSection';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useMessage, useTranslation, type TranslationKey } from '@/i18n';

// Mirror the backend password policy (see api-doc/me/password.md). Returns a
// catalog key so the rule that failed reads in the vendor's language.
function passwordIssue(pw: string): TranslationKey | null {
  if (pw.length < 8) return 'account.security.rules.length';
  if (!/[A-Z]/.test(pw)) return 'account.security.rules.uppercase';
  if (!/[a-z]/.test(pw)) return 'account.security.rules.lowercase';
  if (!/[0-9]/.test(pw)) return 'account.security.rules.number';
  if (!/[^A-Za-z0-9]/.test(pw)) return 'account.security.rules.special';
  return null;
}

export function SecuritySettings() {
  const { t } = useTranslation();
  const m = useMessage();
  const { logout } = useOnboarding();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // `null` until the device has answered. The panel below renders nothing in
  // the meantime rather than flashing "off", which would be a lie on a phone
  // that has the feature switched on.
  const [biometry, setBiometry] = useState<BiometricLoginStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    void biometricLoginStatus().then((status) => {
      if (!cancelled) setBiometry(status);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const turnOffBiometric = useCallback(async () => {
    await disableBiometricLogin();
    setBiometry((prev) => (prev ? { ...prev, enabled: false, identifier: null } : prev));
    toast.success(t('account.security.biometricTurnedOff'));
  }, [t]);

  const newIssue = useMemo(() => (next ? passwordIssue(next) : null), [next]);
  const confirmMismatch = confirm.length > 0 && confirm !== next;
  const canSubmit =
    current.length > 0 && next.length > 0 && !newIssue && !confirmMismatch && !saving;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      // On the phone app this also signs straight back in with the new password —
      // the change revokes this device's own session there. See the service.
      const outcome = await authService.changePassword({ oldPassword: current, newPassword: next });
      // Re-key the stored fingerprint credential in the same breath. The old
      // password was just revoked server-side, so without this the vendor's next
      // fingerprint sign-in 401s and silently turns the feature off — and they
      // would have no way to connect that to the password they just changed.
      // A no-op when the feature is not on.
      await updateBiometricPassword(next);
      if (outcome === 'sign-in-again') {
        // The password DID change, but this device has no session left. Say so
        // and sign out now, rather than let the next tap do it without a word.
        toast.info(t('account.security.updatedSignInAgain'));
        await logout();
        return;
      }
      toast.success(t('account.security.updated'));
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      setError(mapPasswordError(err));
    } finally {
      setSaving(false);
    }
  }, [canSubmit, current, next, t, logout]);

  return (
    <SettingsSections>
      {/*
        Sign-in identifiers first: they are what you authenticate WITH, so they
        belong beside the password rather than on Profile — where that tab's own
        editable Phone writes the vendor ROLE profile, a different record with a
        different endpoint.
      */}
      <ContactDetailsSection />

      {/* Password change */}
      <SettingsSection
        title={t('account.security.passwordTitle')}
        icon={Lock}
        info={t('account.security.passwordInfo')}
        contentClassName="space-y-4 max-w-md"
      >
          {error && (
            <div
              role="alert"
              className="p-3 text-sm bg-destructive/10 text-destructive rounded-lg border border-destructive/20"
            >
              {m(error)}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="current-password">{t('account.security.currentPassword')}</Label>
            <div className="relative">
              <Input
                id="current-password"
                type={showCurrent ? 'text' : 'password'}
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                autoComplete="current-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((s) => !s)}
                aria-label={t(showCurrent
                  ? 'account.security.hidePassword'
                  : 'account.security.showPassword')}
                aria-pressed={showCurrent}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground tap-target"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">{t('account.security.newPassword')}</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNew ? 'text' : 'password'}
                value={next}
                onChange={(e) => setNext(e.target.value)}
                autoComplete="new-password"
                aria-invalid={!!newIssue}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNew((s) => !s)}
                aria-label={t(showNew
                  ? 'account.security.hidePassword'
                  : 'account.security.showPassword')}
                aria-pressed={showNew}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground tap-target"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className={newIssue ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
              {t(newIssue ?? 'account.security.passwordHint')}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">{t('account.security.confirmPassword')}</Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirm ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                aria-invalid={confirmMismatch}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((s) => !s)}
                aria-label={t(showConfirm
                  ? 'account.security.hidePassword'
                  : 'account.security.showPassword')}
                aria-pressed={showConfirm}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground tap-target"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirmMismatch && (
              <p className="text-xs text-destructive">{t('account.security.passwordsDontMatch')}</p>
            )}
          </div>

          <div className="pt-2">
            <Button onClick={handleSubmit} disabled={!canSubmit} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {t('account.security.updatePassword')}
            </Button>
          </div>
      </SettingsSection>

      {/*
        Fingerprint sign-in. Rendered only where it is real: `supported` is false
        on the web and on any device with no enrolled biometry, and a panel about
        a fingerprint reader that isn't there is worse than no panel.

        There is no "turn on" control here on purpose — see the note on
        `account.security.biometricInfo`. Turning it on needs the password, and
        the sign-in screen is the one place that already has it.
      */}
      {biometry?.supported && (
        <SettingsSection
          icon={Fingerprint}
          title={t('account.security.biometricTitle')}
          info={t('account.security.biometricInfo')}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              {biometry.enabled ? (
                <>
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {t('account.security.biometricOn')}
                    <Badge variant="outline" className="text-success border-success/40">
                      {biometry.identifier}
                    </Badge>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t('account.security.biometricOnDesc')}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t('account.security.biometricOffDesc')}
                </p>
              )}
            </div>

            {biometry.enabled && (
              <Button variant="outline" onClick={turnOffBiometric} className="shrink-0">
                {t('account.security.biometricTurnOff')}
              </Button>
            )}
          </div>
        </SettingsSection>
      )}

      {/* Not-yet-implemented security features, greyed out. */}
      <SettingsSection
        className="opacity-60"
        icon={Shield}
        title={
          <span className="flex items-center gap-2">
            {t('account.security.twoFactorTitle')}
            <Badge variant="outline">{t('common.states.comingSoon')}</Badge>
          </span>
        }
        info={t('account.security.twoFactorInfo')}
      >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {t('account.security.notAvailableYet')}
            </p>
            <Switch disabled aria-label={t('account.security.twoFactorToggle')} />
          </div>
      </SettingsSection>

      {/*
        Not a "coming soon" panel. Sign-in tokens are stateless by design, so
        there is no device list to render and never will be — changing the
        password is the revocation, and it is already live. Saying so is more
        useful than a disabled Revoke button promising a screen that isn't
        coming.
      */}
      <SettingsSection
        icon={Globe}
        title={t('account.security.sessionsTitle')}
        info={t('account.security.sessionsInfo')}
      >
          <p className="text-sm text-muted-foreground">
            {t('account.security.sessionsHowTo')}
          </p>
      </SettingsSection>
    </SettingsSections>
  );
}
