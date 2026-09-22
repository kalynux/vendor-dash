import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PhoneInput } from '@/components/phone';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { useTranslation, useMessage, useApiError } from '@/i18n';
import { AuthLayout, AuthLink } from './AuthLayout';
import { PasswordField } from './PasswordField';
import { registerSchema, type RegisterFormValues } from './schemas';

/**
 * Create a vendor account.
 *
 * There is no post-registration screen to build: the backend lands a new vendor
 * on `onboarding_step === 1`, so this hands straight over to the onboarding flow
 * that already exists. Everything that flow asks for — country, timezone, payout
 * details, branding, policies — is deliberately *not* asked here.
 */
export function Register() {
  const { t } = useTranslation();
  const m = useMessage();
  const apiError = useApiError();
  const navigate = useNavigate();
  const { signUp } = useOnboarding();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      business_name: '',
      phone: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  async function onSubmit(values: RegisterFormValues) {
    try {
      await signUp({
        name: values.name,
        business_name: values.business_name,
        phone: values.phone,
        // Omitted rather than sent empty: the field is optional, and `''` is a
        // value the backend would have to decide what to do with.
        ...(values.email ? { email: values.email } : {}),
        password: values.password,
      });
      navigate('/onboarding', { replace: true });
    } catch (err) {
      // `register` rewords AUTH_PHONE_TAKEN / AUTH_EMAIL_TAKEN into "sign in
      // and add the Vendor role" — see errors.contexts.register.
      apiError.toast(err, { fallbackKey: 'auth.errors.registerFailed', context: 'register' });
    }
  }

  return (
    <AuthLayout
      title={t('auth.register.title')}
      subtitle={t('auth.register.subtitle')}
      footer={
        <>
          {t('auth.register.haveAccount')}{' '}
          <AuthLink to="/login">{t('auth.register.signIn')}</AuthLink>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="name">
            {t('auth.register.nameLabel')} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            autoComplete="name"
            placeholder={t('auth.register.namePlaceholder')}
            aria-invalid={!!errors.name}
            {...register('name')}
          />
          {errors.name && <p className="text-xs text-destructive">{m(errors.name.message)}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="business_name">
            {t('auth.register.businessLabel')} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="business_name"
            autoComplete="organization"
            placeholder={t('auth.register.businessPlaceholder')}
            aria-invalid={!!errors.business_name}
            {...register('business_name')}
          />
          {errors.business_name ? (
            <p className="text-xs text-destructive">{m(errors.business_name.message)}</p>
          ) : (
            <p className="text-xs text-muted-foreground">{t('auth.register.businessHint')}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone">
            {t('auth.register.phoneLabel')} <span className="text-destructive">*</span>
          </Label>
          {/* Controlled: `PhoneInput` owns a country selector alongside the
              number and emits E.164, which is not something `register()` can
              express. There is no profile country to default to yet — nobody
              has an account — so it falls back to the platform default. */}
          <Controller
            control={control}
            name="phone"
            render={({ field }) => (
              <PhoneInput
                id="phone"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                required
              />
            )}
          />
          {errors.phone && <p className="text-xs text-destructive">{m(errors.phone.message)}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">{t('auth.register.emailLabel')}</Label>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder={t('auth.register.emailPlaceholder')}
            aria-invalid={!!errors.email}
            {...register('email')}
          />
          {errors.email ? (
            <p className="text-xs text-destructive">{m(errors.email.message)}</p>
          ) : (
            <p className="text-xs text-muted-foreground">{t('auth.register.emailHint')}</p>
          )}
        </div>

        <PasswordField
          id="password"
          label={t('auth.register.passwordLabel')}
          hint={t('auth.register.passwordHint')}
          autoComplete="new-password"
          error={errors.password ? m(errors.password.message) : undefined}
          registration={register('password')}
        />

        <PasswordField
          id="confirmPassword"
          label={t('auth.register.confirmLabel')}
          autoComplete="new-password"
          error={errors.confirmPassword ? m(errors.confirmPassword.message) : undefined}
          registration={register('confirmPassword')}
        />

        <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
          {isSubmitting ? t('auth.register.submitting') : t('auth.register.submit')}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          {t('auth.register.terms')}
        </p>
      </form>
    </AuthLayout>
  );
}
