import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { UseFormRegisterReturn } from 'react-hook-form';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/i18n';

/**
 * A password input with a reveal toggle.
 *
 * The toggle is not a nicety on a phone: an on-screen keyboard mistypes far more
 * often than a physical one, and without a way to check, a vendor's only signal
 * is a failed sign-in. `autoComplete` is passed through rather than fixed —
 * `current-password` and `new-password` mean different things to a password
 * manager, and getting them the wrong way round is how a manager offers to
 * overwrite a working credential.
 */
export function PasswordField({
  id,
  label,
  placeholder,
  hint,
  error,
  autoComplete,
  registration,
}: {
  id: string;
  label: string;
  placeholder?: string;
  hint?: string;
  /** Already resolved to prose by the caller's `useMessage()`. */
  error?: string;
  autoComplete: 'current-password' | 'new-password';
  registration: UseFormRegisterReturn;
}) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label} <span className="text-destructive">*</span>
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? 'text' : 'password'}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="pr-11"
          aria-invalid={!!error}
          {...registration}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          // Labelled rather than titled: a title is invisible to touch, and this
          // control has no text of its own.
          aria-label={visible ? t('auth.login.hidePassword') : t('auth.login.showPassword')}
          aria-pressed={visible}
          className="absolute right-0 top-0 flex h-full w-11 items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
