import { useCallback, useMemo, useState } from 'react';
import { Eye, EyeOff, Globe, Loader2, Lock, Save, Shield } from 'lucide-react';
import { toast } from 'sonner';

import { onboardingService } from '@/services/onboarding.service';
import { mapPasswordError } from '@/components/vendor-settings/errors';
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
      toast.success(t('account.security.updated'));
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      setError(mapPasswordError(err));
    } finally {
      setSaving(false);
    }
  }, [canSubmit, current, next, t]);

  return (
    <SettingsSections>
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
              />
              <button
                type="button"
                onClick={() => setShowCurrent((s) => !s)}
                aria-label={t(showCurrent
                  ? 'account.security.hidePassword'
                  : 'account.security.showPassword')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
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
              />
              <button
                type="button"
                onClick={() => setShowNew((s) => !s)}
                aria-label={t(showNew
                  ? 'account.security.hidePassword'
                  : 'account.security.showPassword')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
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
            <Input
              id="confirm-password"
              type={showNew ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              aria-invalid={confirmMismatch}
            />
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
