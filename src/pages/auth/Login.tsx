import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { useTranslation, useMessage, useApiError } from '@/i18n';
import { AuthLayout, AuthLink } from './AuthLayout';
import { PasswordField } from './PasswordField';
import { loginSchema, type LoginFormValues } from './schemas';

/**
 * Sign in.
 *
 * Routing after success is the onboarding step, not a fixed destination:
 * `role_entity.onboarding_step` is 0 for a finished vendor and 1–4 otherwise,
 * and `OnboardingGuard` enforces the same rule on every subsequent navigation.
 * Sending everyone to `/dashboard` and letting the guard bounce the unfinished
 * ones would work, but it flashes a dashboard shell they are not allowed into.
 */
export function Login() {
  const { t } = useTranslation();
  const m = useMessage();
  const apiError = useApiError();
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useOnboarding();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: '', password: '' },
  });

  async function onSubmit(values: LoginFormValues) {
    try {
      const session = await signIn(values);
      const step = session.role_entity.onboarding_step;
      if (step && step > 0) {
        navigate('/onboarding', { replace: true });
        return;
      }
      // Return the vendor to whatever sent them here, when something did — a
      // push notification deep link is the case that matters on a device.
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from ?? '/dashboard', { replace: true });
    } catch (err) {
      apiError.toast(err, { fallbackKey: 'auth.errors.loginFailed' });
    }
  }

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
        <div className="space-y-1.5">
          <Label htmlFor="identifier">
            {t('auth.login.identifierLabel')} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="identifier"
            // Not `type="email"`: this field takes a phone number too, and an
            // email keyboard hides the digits on a phone.
            type="text"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder={t('auth.login.identifierPlaceholder')}
            aria-invalid={!!errors.identifier}
            {...register('identifier')}
          />
          {errors.identifier ? (
            <p className="text-xs text-destructive">{m(errors.identifier.message)}</p>
          ) : (
            <p className="text-xs text-muted-foreground">{t('auth.login.identifierHint')}</p>
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

        <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
          {isSubmitting ? t('auth.login.submitting') : t('auth.login.submit')}
        </Button>
      </form>
    </AuthLayout>
  );
}
