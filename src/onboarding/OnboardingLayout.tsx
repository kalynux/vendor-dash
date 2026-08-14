import { type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppLogo } from '@/components/layout/AppLogo';
import { Button } from '@/components/ui/button';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { useTranslation, type TranslationKey } from '@/i18n';
import type { VendorOnboardingStep } from '@/types/api';

// ─── Step metadata ────────────────────────────────────────────────────────────

const STEPS: {
    step: Exclude<VendorOnboardingStep, 0>;
    labelKey: TranslationKey;
    sublabelKey: TranslationKey;
}[] = [
        { step: 1, labelKey: 'onboarding.steps.basicSetup', sublabelKey: 'onboarding.stepSublabels.basicSetup' },
        { step: 2, labelKey: 'onboarding.steps.deliveryLinking', sublabelKey: 'onboarding.stepSublabels.deliveryLinking' },
        { step: 3, labelKey: 'onboarding.steps.branding', sublabelKey: 'onboarding.stepSublabels.branding' },
        { step: 4, labelKey: 'onboarding.steps.policySetup', sublabelKey: 'onboarding.stepSublabels.policySetup' },
    ];

// ─── Progress indicator ───────────────────────────────────────────────────────

function StepProgress({
    viewing,
    current,
    onStepClick,
}: {
    viewing: Exclude<VendorOnboardingStep, 0>;
    current: Exclude<VendorOnboardingStep, 0>;
    onStepClick: (step: VendorOnboardingStep) => void;
}) {
    const { t } = useTranslation();
    const totalSteps = STEPS.length;
    const progressPct = ((viewing - 1) / (totalSteps - 1)) * 100;

    return (
        <div className="w-full max-w-lg mx-auto px-4 pt-6 pb-2">
            {/* Step label row */}
            <div className="flex items-center justify-between mb-3 text-sm">
                <span className="font-semibold text-foreground">
                    {t('onboarding.stepLabel', { current: viewing, total: totalSteps })}
                </span>
                <span className="text-muted-foreground">
                    {STEPS[viewing - 1] ? t(STEPS[viewing - 1].labelKey) : ''}
                </span>
            </div>

            {/* Track */}
            <div className="relative h-1.5 bg-muted rounded-full overflow-hidden">
                <motion.div
                    className="absolute inset-y-0 left-0 bg-primary rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPct + (1 / totalSteps) * 100}%` }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                />
            </div>

            {/* Step dots — completed steps are clickable for back-navigation */}
            <div className="flex justify-between mt-3">
                {STEPS.map(({ step, labelKey }) => {
                    const label = t(labelKey);
                    const isComplete = step < current;
                    const isActive = step === viewing;
                    const isClickable = step !== viewing && step <= current;

                    return (
                        <div key={step} className="flex flex-col items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => isClickable && onStepClick(step)}
                                disabled={!isClickable}
                                aria-label={isClickable ? t('onboarding.layout.goBackTo', { step: label }) : label}
                                className={cn(
                                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors duration-300',
                                    isComplete && 'bg-primary text-primary-foreground',
                                    isActive && 'bg-primary text-primary-foreground ring-4 ring-primary/20',
                                    !isComplete && !isActive && 'bg-muted text-muted-foreground',
                                    isClickable && 'cursor-pointer hover:opacity-80',
                                    !isClickable && 'cursor-default',
                                )}
                            >
                                {isComplete ? (
                                    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                                        <path
                                            d="M3 8l3.5 3.5L13 5"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </svg>
                                ) : (
                                    step
                                )}
                            </button>
                            <span
                                className={cn(
                                    'text-[10px] font-medium text-center leading-tight max-w-[56px]',
                                    isActive ? 'text-foreground' : 'text-muted-foreground',
                                )}
                            >
                                {label}
                            </span>
                        </div>
                    );
                })}
            </div>
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
    /** Used to key the AnimatePresence transition between steps. */
    stepKey: VendorOnboardingStep;
}

export function OnboardingLayout({ children, ctaSlot, stepKey }: OnboardingLayoutProps) {
    const { t } = useTranslation();
    const { session, logout, viewingStep, currentStep, goBack, jumpToStep } = useOnboarding();
    // The business name moved to the Store, which isn't fetched during onboarding
    // (the store shell mounts after it). `business_name` may still ride along on
    // `/auth/me`'s role_entity; the placeholder covers it when it doesn't.
    const businessName =
        session?.role_entity.display_name || session?.role_entity.business_name || 'Your Store';

    const showBack = viewingStep !== null && viewingStep > 1;

    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* ── Header ── */}
            <header className="h-16 border-b bg-card flex items-center justify-between px-4 md:px-8 flex-shrink-0">
                <div className="flex items-center gap-3">
                    {/* Back button */}
                    {showBack && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={goBack}
                            aria-label={t('onboarding.layout.goBack')}
                            className="text-muted-foreground -ml-2"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </Button>
                    )}

                    <div className="flex items-center gap-2">
                        <AppLogo className="w-8 h-8" />
                        <div className="flex flex-col leading-tight">
                            <span className="font-bold text-sm leading-none">{t('onboarding.layout.brand')}</span>
                            <span className="text-[10px] text-muted-foreground leading-none truncate max-w-[120px]">
                                {businessName}
                            </span>
                        </div>
                    </div>
                </div>

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={logout}
                    className="text-muted-foreground gap-1.5"
                >
                    <LogOut className="w-4 h-4" />
                    <span className="hidden sm:inline">{t('onboarding.layout.signOut')}</span>
                </Button>
            </header>

            {/* ── Progress ── */}
            {viewingStep !== null && viewingStep !== 0 && currentStep !== null && currentStep !== 0 && (
                <nav aria-label={t('onboarding.layout.progress')}>
                    <StepProgress
                        viewing={viewingStep as Exclude<VendorOnboardingStep, 0>}
                        current={currentStep as Exclude<VendorOnboardingStep, 0>}
                        onStepClick={jumpToStep}
                    />
                </nav>
            )}

            {/* ── Scrollable content ── */}
            <main className="flex-1 overflow-y-auto">
                <div className="w-full max-w-lg mx-auto px-4 py-6 md:py-10">
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
            {ctaSlot && (
                <div className="md:hidden border-t bg-background px-4 py-4 flex-shrink-0 safe-area-pb">
                    {ctaSlot}
                </div>
            )}
        </div>
    );
}
