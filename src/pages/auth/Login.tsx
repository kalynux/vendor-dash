import { useCallback, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useLocation } from 'react-router-dom';
import { Fingerprint, Loader2, ScanFace } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PhoneInput } from '@/components/phone';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { useTranslation, useMessage, useApiError, type TranslationKey } from '@/i18n';
import { ApiError, type AuthMeVendorResponse } from '@/types/api';
import { BiometryType } from '@/platform/biometrics';
import {
  biometricLoginStatus,
  disableBiometricLogin,
  enableBiometricLogin,
  unlockBiometricLogin,
  type BiometricLoginStatus,
} from '@/platform/auth/biometricLogin';
import { AuthLayout, AuthLink } from './AuthLayout';
import { PasswordField } from './PasswordField';
import { LOGIN_MODES, loginModeFor, loginSchema, type LoginFormValues, type LoginMode } from './schemas';

/**
 * What to call the thing the vendor is about to press their finger (or face) to.
 *
 * Named per platform rather than as a generic "biometrics" because the prompt
 * the OS puts on screen is named: a vendor told to "use biometrics" and then
 * shown a dialog headed "Face ID" has to work out that they are the same thing.
 */
const BIOMETRY_LABELS: Record<BiometryType, TranslationKey> = {
  [BiometryType.none]: 'auth.biometric.method.generic',
  [BiometryType.touchId]: 'auth.biometric.method.touchId',
  [BiometryType.faceId]: 'auth.biometric.method.faceId',
  [BiometryType.fingerprintAuthentication]: 'auth.biometric.method.fingerprint',
  [BiometryType.faceAuthentication]: 'auth.biometric.method.face',
  [BiometryType.irisAuthentication]: 'auth.biometric.method.iris',
};

function isFaceBiometry(type: BiometryType): boolean {
  return type === BiometryType.faceId || type === BiometryType.faceAuthentication;
}

/**
 * Sign in.
 *
 * ── Phone / Email tabs ───────────────────────────────────────────────────────
 *
 * The backend takes one `identifier` either way, so the tabs buy exactly one
 * thing — and it is the thing that matters most on a handset: the phone tab can
 * render a **country selector**, which a combined field cannot, because it would
 * have to know it was holding a phone number before it could offer one. Vendors
 * type their number the way they say it out loud ("6 50 …"), and without a
 * selector that is not a valid identifier.
 *
 * Phone leads, because it is the identifier every vendor has: registration
 * requires a phone and leaves email optional. Switching tabs clears the field
 * rather than carrying the text across — an email left sitting in a field with
 * `+237` glued to its front is worse than an empty one.
 *
 * Routing after success is the onboarding step, not a fixed destination:
 * `role_entity.onboarding_step` is 0 for a finished vendor and 1–4 otherwise,
 * and `OnboardingGuard` enforces the same rule on every subsequent navigation.
 * Sending everyone to `/dashboard` and letting the guard bounce the unfinished
 * ones would work, but it flashes a dashboard shell they are not allowed into.
 *
 * ── Fingerprint sign-in ──────────────────────────────────────────────────────
 *
 * Two surfaces, both of which are absent unless the device actually has enrolled
 * biometry (`biometricLoginStatus`, which answers "no" on the web):
 *
 *   - a **button at the foot of the page** once a credential is stored — the
 *     fast path, and the reason the feature exists;
 *   - a **checkbox on the form** when it is not — offered *here*, on the one
 *     screen where the password is in hand, because a credential can only be
 *     stored after it has been proven to work.
 *
 * The button is last on the page, not first. It is a *shortcut past* the form,
 * so it belongs after the thing it is a shortcut past — and on a handset that is
 * also where the thumb already is, under the submit button rather than up by the
 * heading. Putting it on top pushed the phone/email tabs and the password field
 * down the screen for the one case where the vendor's fingerprint had just been
 * rejected and the form was the only way in.
 *
 * The prompt is never raised automatically on mount. A vendor opening the app to
 * sign in as someone else — a shared phone, a staff handover — would have to
 * dismiss an unasked-for dialog first, and an unexplained system prompt on
 * launch reads as something having gone wrong.
 */
export function Login() {
  const { t } = useTranslation();
  const m = useMessage();
  const apiError = useApiError();
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useOnboarding();

  const [biometry, setBiometry] = useState<BiometricLoginStatus | null>(null);
  /** Which tab is open. Mirrored into the form so the resolver can see it. */
  const [mode, setMode] = useState<LoginMode>('phone');
  const [unlocking, setUnlocking] = useState(false);
  /** Opt-in on this sign-in. Only meaningful while `biometry.enabled` is false. */
  const [rememberBiometry, setRememberBiometry] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    setFocus,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { mode: 'phone', identifier: '', password: '' },
  });

  /**
   * Move to a tab, taking the form with it.
   *
   * `mode` is form state as well as component state because the resolver reads
   * it — the same string is a valid identifier on one tab and not on the other.
   * The field is cleared rather than carried across, and the stale error with
   * it: a message about a phone number has no business surviving onto the email
   * tab.
   */
  const switchMode = useCallback(
    (next: LoginMode) => {
      setMode(next);
      setValue('mode', next);
      setValue('identifier', '');
      clearErrors('identifier');
    },
    [clearErrors, setValue],
  );

  useEffect(() => {
    let cancelled = false;
    void biometricLoginStatus().then((status) => {
      if (cancelled) return;
      setBiometry(status);
      // Open on the tab that matches the credential this phone already holds,
      // so a vendor enrolled with an email is not dropped onto the phone tab.
      if (status.identifier) switchMode(loginModeFor(status.identifier));
    });
    return () => {
      cancelled = true;
    };
  }, [switchMode]);

  const goAfterSignIn = useCallback(
    (session: AuthMeVendorResponse) => {
      const step = session.role_entity.onboarding_step;
      if (step && step > 0) {
        navigate('/onboarding', { replace: true });
        return;
      }
      // Return the vendor to whatever sent them here, when something did — a
      // push notification deep link is the case that matters on a device.
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from ?? '/dashboard', { replace: true });
    },
    [location.state, navigate],
  );

  const method = t(BIOMETRY_LABELS[biometry?.type ?? BiometryType.none]);
  const offerBiometricButton = !!biometry?.supported && biometry.enabled;
  const offerBiometricOptIn = !!biometry?.supported && !biometry.enabled;

  /** The three strings the OS dialog itself renders. */
  function promptCopy(reasonKey: 'auth.biometric.unlockReason' | 'auth.biometric.enableReason') {
    return {
      reason: t(reasonKey, { method }),
      title: t('auth.biometric.promptTitle'),
      cancelTitle: t('common.actions.cancel'),
    };
  }

  async function onSubmit(values: LoginFormValues) {
    // `mode` is form state, not wire state — the API takes one `identifier`
    // whichever tab produced it, and the keystore stores the same pair. Built
    // explicitly rather than by rest-spread so a future form field cannot leak
    // into either by accident.
    const credential = { identifier: values.identifier, password: values.password };

    try {
      const session = await signIn(credential);

      // A *different* account just signed in on this phone. The biometric gate
      // proves "someone enrolled on this device", not "the person who saved
      // this credential" — so on a handset with more than one finger enrolled,
      // leaving the previous vendor's credential behind would let whoever holds
      // the phone next open an account that is not theirs. It goes.
      if (biometry?.enabled && biometry.identifier && biometry.identifier !== credential.identifier) {
        await disableBiometricLogin();
        setBiometry((prev) => (prev ? { ...prev, enabled: false, identifier: null } : prev));
      }

      // Only after the server has accepted it. Storing an unverified password
      // would leave a vendor unable to tell a wrong password from a broken
      // fingerprint reader on every future launch.
      if (rememberBiometry && biometry?.supported) {
        const result = await enableBiometricLogin(credential, promptCopy('auth.biometric.enableReason'));
        if (result.ok) toast.success(t('auth.biometric.enabled', { method }));
        else if (!result.cancelled) toast.error(t('auth.biometric.enableFailed'));
      }

      goAfterSignIn(session);
    } catch (err) {
      apiError.toast(err, { fallbackKey: 'auth.errors.loginFailed' });
    }
  }

  async function onBiometricSignIn() {
    setUnlocking(true);
    try {
      const unlock = await unlockBiometricLogin(promptCopy('auth.biometric.unlockReason'));

      if (!unlock.ok) {
        // A cancelled prompt says nothing: the vendor closed it deliberately and
        // the password form is right there.
        if (unlock.disabled) {
          setBiometry((prev) => (prev ? { ...prev, enabled: false, identifier: null } : prev));
          toast.error(t('auth.biometric.noLongerAvailable'));
        }
        return;
      }

      try {
        const session = await signIn(unlock.credential);
        goAfterSignIn(session);
      } catch (err) {
        // The stored password is stale — changed on another device, most
        // likely, which revokes it. Re-prompting a thumb against a dead
        // credential is a loop, so the feature turns itself off and says why.
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          await disableBiometricLogin();
          setBiometry((prev) => (prev ? { ...prev, enabled: false, identifier: null } : prev));
          // Half the form is still known — carry it over so the vendor only has
          // to type the part that actually changed. The tab has to follow it:
          // an email dropped into the phone field would fail validation for a
          // reason that has nothing to do with why they are back here.
          const stale = loginModeFor(unlock.credential.identifier);
          setMode(stale);
          setValue('mode', stale);
          setValue('identifier', unlock.credential.identifier);
          setFocus('password');
          toast.error(t('auth.biometric.rejected'));
          return;
        }
        apiError.toast(err, { fallbackKey: 'auth.errors.loginFailed' });
      }
    } finally {
      setUnlocking(false);
    }
  }

  const BiometryIcon = isFaceBiometry(biometry?.type ?? BiometryType.none)
    ? ScanFace
    : Fingerprint;
  const busy = isSubmitting || unlocking;

  return (
    <AuthLayout
      title={t('auth.login.title')}
      subtitle={t('auth.login.subtitle')}
      footer={
        <>
          {t('auth.login.noAccount')}{' '}
          <AuthLink to="/register">{t('auth.login.createAccount')}</AuthLink>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* The two ways in. `Tabs` rather than a hand-rolled toggle so the pair
            is a real radio group to a screen reader and arrow keys move between
            them — and so it looks like every other tab strip in the app. There
            is no `TabsContent`: the panels would differ by one control and the
            password field below is common to both, so the field slot is
            switched inline instead of duplicating the rest of the form. */}
        <Tabs value={mode} onValueChange={(v) => switchMode(v as LoginMode)}>
          <TabsList className="grid w-full grid-cols-2">
            {LOGIN_MODES.map((value) => (
              <TabsTrigger key={value} value={value} className="h-9">
                {t(value === 'phone' ? 'auth.login.tabs.phone' : 'auth.login.tabs.email')}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="space-y-1.5">
          <Label htmlFor="identifier">
            {t(mode === 'phone' ? 'auth.login.phoneLabel' : 'auth.login.emailLabel')}{' '}
            <span className="text-destructive">*</span>
          </Label>

          {mode === 'phone' ? (
            // Controlled, and keyed on the mode so switching tabs remounts it
            // with a clean country/typed-text pair rather than re-deriving one
            // from the email that was just cleared.
            <Controller
              name="identifier"
              control={control}
              render={({ field }) => (
                <PhoneInput
                  key="phone"
                  id="identifier"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  className="h-11"
                  required
                  // One message line, owned by the resolver — the field's own
                  // is suppressed so the two can't contradict each other.
                  hideError
                  invalid={!!errors.identifier}
                />
              )}
            />
          ) : (
            <Input
              key="email"
              id="identifier"
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder={t('auth.login.emailPlaceholder')}
              className="h-11"
              aria-invalid={!!errors.identifier}
              {...register('identifier')}
            />
          )}

          {errors.identifier ? (
            <p className="text-xs text-destructive">{m(errors.identifier.message)}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t(mode === 'phone' ? 'auth.login.phoneHint' : 'auth.login.emailHint')}
            </p>
          )}
        </div>

        <PasswordField
          id="password"
          label={t('auth.login.passwordLabel')}
          placeholder={t('auth.login.passwordPlaceholder')}
          autoComplete="current-password"
          error={errors.password ? m(errors.password.message) : undefined}
          registration={register('password')}
        />

        <div className="flex justify-end">
          <AuthLink to="/forgot-password">{t('auth.login.forgot')}</AuthLink>
        </div>

        {offerBiometricOptIn && (
          <div className="flex items-start gap-3 rounded-xl border bg-muted/40 p-3">
            <Checkbox
              id="remember-biometry"
              checked={rememberBiometry}
              onCheckedChange={(checked) => setRememberBiometry(checked === true)}
              className="mt-0.5"
            />
            <div className="space-y-0.5">
              <Label htmlFor="remember-biometry" className="cursor-pointer font-medium">
                {t('auth.biometric.optInLabel', { method })}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t('auth.biometric.optInHint')}
              </p>
            </div>
          </div>
        )}

        <Button type="submit" className="h-11 w-full" disabled={busy}>
          {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
          {isSubmitting ? t('auth.login.submitting') : t('auth.login.submit')}
        </Button>
      </form>

      {offerBiometricButton && (
        <div className="mt-5 space-y-3">
          {/* Not a heading — a divider, so the two ways in read as alternatives
              rather than as two halves of one form. */}
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              {t('auth.biometric.orDivider')}
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button
            type="button"
            variant="outline"
            className="h-12 w-full justify-center gap-2 border-primary/30 text-base font-semibold text-primary hover:bg-primary/5 hover:text-primary"
            onClick={onBiometricSignIn}
            disabled={busy}
          >
            {unlocking ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <BiometryIcon className="size-5" aria-hidden />
            )}
            {t('auth.biometric.signInWith', { method })}
          </Button>

          {biometry?.identifier && (
            <p className="text-center text-xs text-muted-foreground">
              {t('auth.biometric.asAccount', { identifier: biometry.identifier })}
            </p>
          )}
        </div>
      )}
    </AuthLayout>
  );
}
