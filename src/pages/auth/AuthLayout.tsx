import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { AppLogo } from '@/components/layout/AppLogo';
import { LanguageSwitcher, useTranslation } from '@/i18n';
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
 *
 * ⚠ **The card is centred with `my-auto`, never `justify-center`.** They look
 * identical right up until the content is taller than the viewport — which the
 * six-field registration form is on any phone — and then they differ in the way
 * that matters: `justify-center` overflows a flex container *equally at both
 * ends*, so the top of the form is pushed above the container's own padding, out
 * from under the safe-area inset and behind the status bar, where no amount of
 * scrolling can reach it. Auto margins only consume *positive* free space, so
 * the card centres when it fits and falls back to the padding edge when it does
 * not. This is the fix for the sign-up header colliding with the clock.
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
        // No `justify-center` — see the note above. The card centres itself.
        'flex flex-col items-center',
        'px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(0.75rem+env(safe-area-inset-top))]',
      )}
    >
      {/*
        Top right, above everything else on the screen, and on all four auth
        screens because they share this shell.

        This is the first thing a vendor sees after installing the app, and if
        they do not read English it is the only control on the screen they can
        act on — so it is deliberately *not* tucked into the card with the form
        it exists to make readable. Aligned to the card's own right edge rather
        than the viewport's, so it reads as part of the same column on a tablet.
      */}
      <div className="flex w-full max-w-sm justify-end">
        <LanguageSwitcher className="-mr-2" />
      </div>

      <div className="my-auto w-full max-w-sm space-y-6 pt-2">
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
