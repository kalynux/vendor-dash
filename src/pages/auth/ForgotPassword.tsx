import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, MailCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authService } from '@/services/auth.service';
import { useTranslation, useMessage, useApiError } from '@/i18n';
import { AuthLayout, AuthLink } from './AuthLayout';
import { forgotSchema, type ForgotFormValues } from './schemas';

/**
 * Request a password-reset link.
 *
 * `/auth/forgot-password` is in the base namespace and mints no session, so this
 * screen is transport-agnostic — it calls the same endpoint from a browser and
 * from a device, and needs nothing from the auth strategy.
 *
 * The confirmation deliberately does not say whether the account exists. The
 * backend answers the same way either way, and a screen that distinguished them
 * would turn this form into a way to test whether a given phone number is
 * registered.
 */
export function ForgotPassword() {
  const { t } = useTranslation();
  const m = useMessage();
  const apiError = useApiError();
  const [sentTo, setSentTo] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotFormValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { identifier: '' },
  });

  async function onSubmit(values: ForgotFormValues) {
    try {
      await authService.forgotPassword(values.identifier);
      setSentTo(values.identifier);
    } catch (err) {
      apiError.toast(err, { fallbackKey: 'auth.errors.forgotFailed' });
    }
  }

  if (sentTo) {
    return (
      <AuthLayout
        title={t('auth.forgot.sentTitle')}
        footer={<AuthLink to="/login">{t('auth.forgot.backToLogin')}</AuthLink>}
      >
        <div className="space-y-4 text-center">
          <MailCheck className="mx-auto size-10 text-primary" aria-hidden />
          <p className="text-sm text-muted-foreground text-balance">
            {t('auth.forgot.sentBody', { identifier: sentTo })}
          </p>
          <Button variant="outline" className="h-11 w-full" onClick={() => setSentTo(null)}>
            {t('auth.forgot.resend')}
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t('auth.forgot.title')}
      subtitle={t('auth.forgot.subtitle')}
      footer={<AuthLink to="/login">{t('auth.forgot.backToLogin')}</AuthLink>}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="identifier">
            {t('auth.forgot.identifierLabel')} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="identifier"
            type="text"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={!!errors.identifier}
            {...register('identifier')}
          />
          {errors.identifier && (
            <p className="text-xs text-destructive">{m(errors.identifier.message)}</p>
          )}
        </div>

        <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
          {isSubmitting ? t('auth.forgot.submitting') : t('auth.forgot.submit')}
        </Button>
      </form>
    </AuthLayout>
  );
}
