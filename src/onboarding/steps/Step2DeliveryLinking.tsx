import { useCallback, useState } from 'react';
import { Loader2, ChevronRight, Package, Wrench } from 'lucide-react';
import { toast } from 'sonner';

import { OnboardingLayout } from '@/onboarding/OnboardingLayout';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { AgencyConnectionBrowser } from '@/components/delivery/AgencyConnectionBrowser';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTranslation, useApiError } from '@/i18n';

// ─── Types ────────────────────────────────────────────────────────────────────

type ProductType = 'physical' | 'service' | null;

// ─── Product Type Question ────────────────────────────────────────────────────

function ProductTypeQuestion({
    onPhysical,
    onService,
}: {
    onPhysical: () => void;
    onService: () => void;
}) {
    const { t } = useTranslation();
    return (
        <div className="space-y-4 mt-2">
            <button
                type="button"
                onClick={onPhysical}
                className={cn(
                    'w-full text-left rounded-xl border-2 p-5 transition-all duration-200',
                    'border-border bg-card hover:border-primary/50 hover:bg-accent/30',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
            >
                <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <Package className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">
                            {t('onboarding.deliveryLinking.physicalOption')}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {t('onboarding.deliveryLinking.physicalOptionHint')}
                        </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </div>
            </button>

            <button
                type="button"
                onClick={onService}
                className={cn(
                    'w-full text-left rounded-xl border-2 p-5 transition-all duration-200',
                    'border-border bg-card hover:border-primary/50 hover:bg-accent/30',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
            >
                <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <Wrench className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">
                            {t('onboarding.deliveryLinking.serviceOption')}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {t('onboarding.deliveryLinking.serviceOptionHint')}
                        </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </div>
            </button>
        </div>
    );
}

// ─── Service-Only Confirmation ────────────────────────────────────────────────

function ServiceOnlyConfirmation() {
    const { t } = useTranslation();
    return (
        <div className="mt-4 rounded-xl border border-border bg-muted/40 p-5">
            <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-background border border-border flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Wrench className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                    <p className="text-sm font-semibold">
                        {t('onboarding.deliveryLinking.serviceOnlyTitle')}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {t('onboarding.deliveryLinking.serviceOnlyDescription')}
                    </p>
                </div>
            </div>
        </div>
    );
}

// ─── Physical: optional connection browser ────────────────────────────────────

function PhysicalDeliveryPanel() {
    const { t } = useTranslation();
    return (
        <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-border bg-muted/40 p-4">
                <p className="text-sm font-semibold">
                    {t('onboarding.deliveryLinking.headStartTitle')}
                </p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {t('onboarding.deliveryLinking.headStartDescription')}
                </p>
            </div>
            <AgencyConnectionBrowser listHeightClass="h-[38vh] min-h-[160px]" />
        </div>
    );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Step2DeliveryLinking() {
    const { t } = useTranslation();
    const apiError = useApiError();
    const { submitDeliveryLinking, isSubmitting, session, drafts, saveDraft } = useOnboarding();

    const roleEntity = session?.role_entity;
    const draft = drafts.deliveryLinking;

    const [productType, setProductType] = useState<ProductType>(
        draft?.productType ?? (roleEntity?.default_delivery_agency_id ? 'physical' : null),
    );

    const [submitError, setSubmitError] = useState<string | null>(null);

    // ── Product type choice ───────────────────────────────────────────────────

    const handleChoosePhysical = () => {
        setProductType('physical');
        setSubmitError(null);
    };

    const handleChooseService = () => {
        setProductType('service');
        setSubmitError(null);
    };

    // ── Submission ────────────────────────────────────────────────────────────
    // Agency assignment no longer happens on this step — the backend call is now
    // identical regardless of which branch the vendor picked, so there's a single
    // handler and Continue is never gated on a selection.

    const handleContinue = useCallback(async () => {
        setSubmitError(null);
        saveDraft(2, { productType });
        try {
            await submitDeliveryLinking({});
            toast.success(t('onboarding.deliveryLinking.stepComplete'));
        } catch (err) {
            setSubmitError(apiError.resolve(err, { fallbackKey: 'onboarding.errors.continueFailed' }));
        }
    }, [productType, submitDeliveryLinking, saveDraft, t, apiError]);

    // ── CTA slot ──────────────────────────────────────────────────────────────

    let ctaSlot: React.ReactNode = null;

    if (productType === 'physical') {
        ctaSlot = (
            <div className="space-y-2">
                <Button
                    type="button"
                    onClick={handleContinue}
                    disabled={isSubmitting}
                    className="w-full h-12 text-base font-semibold gap-2"
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {t('onboarding.continuing')}
                        </>
                    ) : (
                        <>
                            {t('common.actions.continue')}
                            <ChevronRight className="w-4 h-4" />
                        </>
                    )}
                </Button>
                <button
                    type="button"
                    onClick={handleChooseService}
                    disabled={isSubmitting}
                    className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2 disabled:opacity-50"
                >
                    {t('onboarding.deliveryLinking.switchToService')}
                </button>
            </div>
        );
    } else if (productType === 'service') {
        ctaSlot = (
            <div className="space-y-2">
                <Button
                    type="button"
                    onClick={handleContinue}
                    disabled={isSubmitting}
                    className="w-full h-12 text-base font-semibold gap-2"
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {t('onboarding.continuing')}
                        </>
                    ) : (
                        <>
                            {t('common.actions.continue')}
                            <ChevronRight className="w-4 h-4" />
                        </>
                    )}
                </Button>
                <button
                    type="button"
                    onClick={handleChoosePhysical}
                    disabled={isSubmitting}
                    className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2 disabled:opacity-50"
                >
                    {t('onboarding.deliveryLinking.switchToPhysical')}
                </button>
            </div>
        );
    }

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <OnboardingLayout ctaSlot={ctaSlot} stepKey={2}>
            <div className="space-y-2 mb-6">
                <h1 className="text-2xl font-bold">{t('onboarding.deliveryLinking.heading')}</h1>
                <p className="text-muted-foreground text-sm">
                    {productType === null
                        ? t('onboarding.deliveryLinking.askProductType')
                        : productType === 'physical'
                          ? t('onboarding.deliveryLinking.physicalSubheading')
                          : t('onboarding.deliveryLinking.serviceSubheading')}
                </p>
            </div>

            {submitError && (
                <div
                    role="alert"
                    className="mb-4 p-3 text-sm bg-destructive/10 text-destructive rounded-lg border border-destructive/20"
                >
                    {submitError}
                </div>
            )}

            {/* ── Product type question ── */}
            {productType === null && (
                <ProductTypeQuestion
                    onPhysical={handleChoosePhysical}
                    onService={handleChooseService}
                />
            )}

            {/* ── Physical: optional connection browser ── */}
            {productType === 'physical' && <PhysicalDeliveryPanel />}

            {/* ── Service-only confirmation ── */}
            {productType === 'service' && <ServiceOnlyConfirmation />}
        </OnboardingLayout>
    );
}
