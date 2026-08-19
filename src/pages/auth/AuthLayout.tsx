import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { AppLogo } from '@/components/layout/AppLogo';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

/**
 * The shell every in-app auth screen sits in.
 *
 * Deliberately plain. These are the only screens in this app that had no mobile
 * design to inherit, so rather than invent one they reuse what the onboarding
 * flow already established — a centred card on a soft ground, the platform mark
 * above it, `space-y` rhythm and the same control heights. Anyone arriving from
 * onboarding should not be able to tell the two apart.
 *
 * The safe-area padding matters on a device: without it the card sits under the
 * notch on a phone and under the home indicator on the way back up. Off native
 * `env(safe-area-inset-*)` resolves to 0, so the web build is unchanged.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** The "no account? / already have one?" line under the card. */
  footer?: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        'min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-background dark:to-muted/30',
        'flex flex-col items-center justify-center',
        'px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1.5rem+env(safe-area-inset-top))]',
      )}
    >
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Link to="/login" aria-label={t('auth.brand.name')}>
            <AppLogo alt="" className="size-14" />
          </Link>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            {subtitle && (
              <p className="text-sm text-muted-foreground text-balance">{subtitle}</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">{children}</div>

        {footer && (
          <p className="text-center text-sm text-muted-foreground">{footer}</p>
        )}
      </div>
    </div>
  );
}

/**
 * A text link styled as the inline call-to-action under a form. Extracted only
 * because all four screens need exactly one, and they should not drift.
 */
export function AuthLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
    >
      {children}
    </Link>
  );
}
