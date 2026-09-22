import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, ChevronLeft, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppLogo } from '@/components/layout/AppLogo';
import { Button } from '@/components/ui/button';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { useKeyboardOpen } from '@/platform/shell/keyboard';
import { LanguageSwitcher, useTranslation, type TranslationKey } from '@/i18n';
import type { VendorOnboardingStep } from '@/types/api';

// ─── Step metadata ────────────────────────────────────────────────────────────

type ActiveStep = Exclude<VendorOnboardingStep, 0>;

const STEPS: {
    step: ActiveStep;
    labelKey: TranslationKey;
    sublabelKey: TranslationKey;
}[] = [
        { step: 1, labelKey: 'onboarding.steps.basicSetup', sublabelKey: 'onboarding.stepSublabels.basicSetup' },
        { step: 2, labelKey: 'onboarding.steps.deliveryLinking', sublabelKey: 'onboarding.stepSublabels.deliveryLinking' },
        { step: 3, labelKey: 'onboarding.steps.branding', sublabelKey: 'onboarding.stepSublabels.branding' },
        { step: 4, labelKey: 'onboarding.steps.policySetup', sublabelKey: 'onboarding.stepSublabels.policySetup' },
    ];

// ─── Progress indicator ───────────────────────────────────────────────────────

/**
 * "Step 2 of 4 · Delivery" over a row of numbered dots joined by a line.
 *
 * One compact stepper at every width. It replaced a progress bar *and* a dot
 * row: together they cost a phone ~230px above every form, the bar's fill never
 * lined up with the dots, and the dot labels were squeezed to 56px, so "Basic
 * Setup" alone broke onto two lines. The labels under the dots now appear from
 * `md` up only — on a phone the text row above already names the current step.
 */
function StepProgress({
    viewing,
    current,
    onStepClick,
}: {
    viewing: ActiveStep;
    current: ActiveStep;
    onStepClick: (step: VendorOnboardingStep) => void;
}) {
    const { t } = useTranslation();
    const totalSteps = STEPS.length;

    return (
        <div className="w-full max-w-lg mx-auto px-4 pt-4 md:pt-6">
            <div className="flex items-baseline justify-between gap-3 mb-3 text-sm">
                <span className="font-semibold text-foreground">
                    {t('onboarding.stepLabel', { current: viewing, total: totalSteps })}
                </span>
                <span className="truncate text-muted-foreground">
                    {t(STEPS[viewing - 1].labelKey)}
                </span>
            </div>

            <ol className="flex items-center md:pb-6">
                {STEPS.map(({ step, labelKey }, index) => {
                    const label = t(labelKey);
                    const isComplete = step < current && step !== viewing;
                    const isActive = step === viewing;
                    // Completed steps are revisitable; a step can be revisited
                    // from a later one *or* returned to from an earlier one.
                    const isClickable = step !== viewing && step <= current;
                    const edge = index === 0 ? 'start' : index === STEPS.length - 1 ? 'end' : 'middle';

                    return (
                        // Each step after the first carries the line leading into it.
                        <li key={step} className={cn('flex items-center', index > 0 && 'flex-1')}>
                            {index > 0 && (
                                <span
                                    aria-hidden
                                    className={cn(
                                        'h-0.5 flex-1 mx-1.5 rounded-full transition-colors duration-300',
                                        step <= viewing ? 'bg-primary' : step <= current ? 'bg-primary/35' : 'bg-muted',
                                    )}
                                />
                            )}
                            <div className="relative flex shrink-0 flex-col items-center">
                                <button
                                    type="button"
                                    onClick={() => isClickable && onStepClick(step)}
                                    disabled={!isClickable}
                                    aria-current={isActive ? 'step' : undefined}
                                    aria-label={isClickable ? t('onboarding.layout.goBackTo', { step: label }) : label}
                                    className={cn(
                                        'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors duration-300 tap-target',
                                        isActive && 'bg-primary text-primary-foreground ring-4 ring-primary/20',
                                        isComplete && 'bg-primary/15 text-primary',
                                        !isComplete && !isActive && 'bg-muted text-muted-foreground',
                                        isClickable ? 'cursor-pointer hover:opacity-80' : 'cursor-default',
                                    )}
                                >
                                    {isComplete ? <Check className="w-4 h-4" strokeWidth={2.5} /> : step}
                                </button>
                                {/* Anchored to the dot, and to the row's edge for the
                                    first and last, so a long label never overhangs. */}
                                <span
                                    className={cn(
                                        'hidden md:block absolute top-full mt-1.5 whitespace-nowrap text-[11px] font-medium leading-tight',
                                        edge === 'start' && 'left-0',
                                        edge === 'end' && 'right-0',
                                        edge === 'middle' && 'left-1/2 -translate-x-1/2',
                                        isActive ? 'text-foreground' : 'text-muted-foreground',
                                    )}
                                >
                                    {label}
                                </span>
                            </div>
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

interface OnboardingLayoutProps {
    children: ReactNode;
    /**
     * Content to render in the sticky CTA bar at the bottom.
     * Typically the submit button or skip + submit buttons.
     */
    ctaSlot?: ReactNode;
    /**
     * The step this screen renders. Also what the progress row and the back
     * arrow read — not the store's `viewingStep`, which only moves when the
     * store navigates, so a browser back, an Android back press or a typed URL
     * left the header saying "Step 4 of 4" over the step-1 form.
     */
    stepKey: ActiveStep;
}

export function OnboardingLayout({ children, ctaSlot, stepKey }: OnboardingLayoutProps) {
    const { t } = useTranslation();
    const { session, logout, currentStep, jumpToStep } = useOnboarding();
    // A fixed bar would ride up on top of the keyboard and cover the field
    // being typed in — same rule as every other bottom bar in the app.
    const keyboardOpen = useKeyboardOpen();
    // The business name moved to the Store, which isn't fetched during onboarding
    // (the store shell mounts after it). `business_name` may still ride along on
    // `/auth/me`'s role_entity; the placeholder covers it when it doesn't.
    const businessName =
        session?.role_entity.display_name || session?.role_entity.business_name || 'Your Store';

    const showBack = stepKey > 1;

    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* ── Header ── */}
            {/* This layout lives outside the dashboard shell, so nothing above
                it pads for the status bar. On a device the header is the first
                thing under the clock, so it carries the inset itself — and its
                height grows by the same amount rather than the 4rem row being
                squeezed into it. `env(...)` is 0 in a browser (P3.3). */}
            <header className="h-[calc(4rem+env(safe-area-inset-top))] pt-safe border-b bg-card flex items-center justify-between px-4 md:px-8 flex-shrink-0">
                <div className="flex min-w-0 items-center gap-3">
                    {/* Back button */}
                    {showBack && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => jumpToStep((stepKey - 1) as ActiveStep)}
                            aria-label={t('onboarding.layout.goBack')}
                            className="text-muted-foreground -ml-2"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </Button>
                    )}

                    <div className="flex min-w-0 items-center gap-2">
                        <AppLogo className="w-8 h-8 shrink-0" />
                        <div className="flex min-w-0 flex-col leading-tight">
                            <span className="font-bold text-sm leading-none">{t('onboarding.layout.brand')}</span>
                            <span className="text-[11px] text-muted-foreground leading-tight truncate max-w-[160px]">
                                {businessName}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-0.5">
                    {/* Onboarding is four screens of forms a vendor has to
                        understand before they can finish signing up, and the
                        Profile picker that would let them change language sits
                        *behind* it. Icon-only: the header is already carrying a
                        brand, a business name and a sign-out at 4rem. */}
                    <LanguageSwitcher variant="icon" />
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={logout}
                        aria-label={t('onboarding.layout.signOut')}
                        className="text-muted-foreground gap-1.5"
                    >
                        <LogOut className="w-4 h-4" />
                        <span className="hidden sm:inline">{t('onboarding.layout.signOut')}</span>
                    </Button>
                </div>
            </header>

            {/* ── Progress ── */}
            {currentStep !== null && currentStep !== 0 && (
                <nav aria-label={t('onboarding.layout.progress')}>
                    <StepProgress
                        viewing={stepKey}
                        current={currentStep as ActiveStep}
                        onStepClick={jumpToStep}
                    />
                </nav>
            )}

            {/* ── Content ── */}
            {/* No `overflow` here: the document is what scrolls, and a scroll box
                on <main> would clip the address-search results near the bottom
                of the page into a scroll area of their own. */}
            <main className="flex-1">
                <div className="w-full max-w-lg mx-auto px-4 pt-6 pb-8 md:pt-8 md:pb-10">
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                            key={stepKey}
                            initial={{ opacity: 0, y: 14 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.25, ease: 'easeOut' }}
                        >
                            {children}
                        </motion.div>
                    </AnimatePresence>
                </div>
                {/* Desktop CTA inside scroll area */}
                {ctaSlot && (
                    <div className="hidden md:block w-full max-w-lg mx-auto px-4 pb-10">
                        {ctaSlot}
                    </div>
                )}
            </main>

            {/* ── Sticky mobile CTA ── */}
            {/* Sticky, so Continue is reachable without scrolling to the end of a
                long step, and padded for the gesture bar (the old
                `safe-area-pb` class was never defined anywhere). */}
            {ctaSlot && !keyboardOpen && (
                <div className="md:hidden sticky bottom-0 z-20 border-t bg-background px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex-shrink-0">
                    {ctaSlot}
                </div>
            )}
        </div>
    );
}
