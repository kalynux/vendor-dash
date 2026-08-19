import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { authService } from '@/services/auth.service';
import { useTranslation, useMessage, useApiError } from '@/i18n';
import { AuthLayout, AuthLink } from './AuthLayout';
import { PasswordField } from './PasswordField';
import { resetSchema, type ResetFormValues } from './schemas';

/**
 * Complete a password reset.
 *
 * The token arrives in the query string, which is how the emailed link is built.
 * On a device that link is a deep link into this route — App Links / Universal
 * Links, in a later phase — so the `?token=` shape is a contract with the email
 * template and not an implementation detail to tidy away.
 *
 * `/auth/reset-password` signs nobody in by design: it sets the password and
 * stops, so this navigates to sign-in rather than into the dashboard. That is
 * also what makes the screen transport-agnostic — no session is minted, so
 * there is nothing for the auth strategy to capture.
 */
export function ResetPassword() {
  const { t } = useTranslation();
  const m = useMessage();
  const apiError = useApiError();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  async function onSubmit(values: ResetFormValues) {
    if (!token) return;
    try {
      await authService.resetPassword(token, values.password);
      toast.success(t('auth.reset.done'));
      navigate('/login', { replace: true });
    } catch (err) {
      apiError.toast(err, { fallbackKey: 'auth.errors.resetFailed' });
    }
  }

  // A link that lost its token in transit — some mail clients rewrite URLs — is
  // a dead end, and the honest answer is to say so and offer the way out rather
  // than render a form whose submit can only fail.
  if (!token) {
    return (
      <AuthLayout
        title={t('auth.reset.title')}
        footer={<AuthLink to="/login">{t('auth.forgot.backToLogin')}</AuthLink>}
      >
        <div className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">{t('auth.reset.missingToken')}</p>
          <Button
            variant="outline"
            className="h-11 w-full"
            onClick={() => navigate('/forgot-password', { replace: true })}
          >
            {t('auth.reset.requestNew')}
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t('auth.reset.title')}
      subtitle={t('auth.reset.subtitle')}
      footer={<AuthLink to="/login">{t('auth.forgot.backToLogin')}</AuthLink>}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <PasswordField
          id="password"
          label={t('auth.reset.passwordLabel')}
          hint={t('auth.register.passwordHint')}
          autoComplete="new-password"
          error={errors.password ? m(errors.password.message) : undefined}
          registration={register('password')}
        />

        <PasswordField
          id="confirmPassword"
          label={t('auth.reset.confirmLabel')}
          autoComplete="new-password"
          error={errors.confirmPassword ? m(errors.confirmPassword.message) : undefined}
          registration={register('confirmPassword')}
        />

        <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
          {isSubmitting ? t('auth.reset.submitting') : t('auth.reset.submit')}
        </Button>
      </form>
    </AuthLayout>
  );
}
