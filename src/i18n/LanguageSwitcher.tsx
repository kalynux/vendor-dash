import { Check, Languages } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

import { LOCALES, SELECTABLE_LOCALES, markLocaleManual, type Locale } from './config';
import { useI18n } from './I18nContext';

/**
 * The language picker that has to work before anyone is signed in.
 *
 * ── Why it is not the Profile picker ─────────────────────────────────────────
 *
 * Account → Localization already switches the dashboard's language, but it is
 * behind a sign-in and four onboarding steps. A vendor who downloads the app and
 * does not read English cannot reach it — they have to understand the sign-up
 * form first, which is the exact thing they cannot do. So the switch has to sit
 * on the first screen, and it has to work with no session at all.
 *
 * ── What it writes ───────────────────────────────────────────────────────────
 *
 * `setLocale` (this session + localStorage, so a relaunch does not lose it) and
 * `markLocaleManual` — which is what keeps `SessionLocaleSync` from replacing
 * the choice with a brand-new account's default `en` the instant sign-in
 * succeeds. See the note on `LOCALE_MANUAL_KEY`.
 *
 * Only `SELECTABLE_LOCALES` are offered, so a vendor can never pick a language
 * whose catalog is still a stub and would render as English anyway.
 */
export function LanguageSwitcher({
    className,
    /** `icon` drops the label, for headers that are tight on width. */
    variant = 'labelled',
}: {
    className?: string;
    variant?: 'labelled' | 'icon';
}) {
    const { locale, setLocale, t } = useI18n();

    function choose(next: Locale) {
        if (next === locale) return;
        // Marked before it is applied: `SessionLocaleSync` may react to the
        // re-render, and it has to see the pick already flagged as deliberate.
        markLocaleManual(next);
        setLocale(next);
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    // A real label whatever the variant: the trigger is an icon
                    // for a *language* the reader may not share, so the icon
                    // alone is not a name.
                    aria-label={t('common.language.change')}
                    className={cn('gap-1.5 text-muted-foreground', className)}
                >
                    <Languages className="size-4 shrink-0" aria-hidden />
                    {variant === 'labelled' && (
                        <span className="text-sm font-medium">{LOCALES[locale].nativeLabel}</span>
                    )}
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="min-w-40">
                {SELECTABLE_LOCALES.map((code) => (
                    <DropdownMenuItem
                        key={code}
                        onSelect={() => choose(code)}
                        className="justify-between gap-3"
                    >
                        {/* The name in its own language, never translated —
                            "Français" is what a French speaker scans for, and
                            "French" is not. */}
                        <span dir={LOCALES[code].dir}>{LOCALES[code].nativeLabel}</span>
                        {code === locale && <Check className="size-4 text-primary" aria-hidden />}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
