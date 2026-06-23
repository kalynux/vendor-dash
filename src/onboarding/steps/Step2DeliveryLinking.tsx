import { useState, useCallback } from 'react';
import { Loader2, ChevronRight, Package, Wrench } from 'lucide-react';
import { toast } from 'sonner';

import { OnboardingLayout } from '@/onboarding/OnboardingLayout';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { AgencyBrowser } from '@/components/vendor-settings/delivery/AgencyBrowser';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/types/api';
import { cn } from '@/lib/utils';

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
                        <p className="font-semibold text-sm">Yes, I sell physical products</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            I need a delivery agency to ship orders to customers.
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
                        <p className="font-semibold text-sm">No, I only offer services</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            My business is service-based — no physical shipping needed.
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
    return (
        <div className="mt-4 rounded-xl border border-border bg-muted/40 p-5">
            <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-background border border-border flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Wrench className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                    <p className="text-sm font-semibold">Service-only vendor</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        No delivery agency needed. This step will be skipped and you can proceed
                        to the next one. You can always link a delivery agency later from Settings.
                    </p>
                </div>
            </div>
        </div>
    );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Step2DeliveryLinking() {
    const { submitDeliveryLinking, isSubmitting, session, drafts, saveDraft } = useOnboarding();

    const roleEntity = session?.role_entity;
    const draft = drafts.deliveryLinking;

    const existingAgencyId =
        draft?.default_delivery_agency_id ?? roleEntity?.default_delivery_agency_id ?? null;

    const [productType, setProductType] = useState<ProductType>(
        existingAgencyId ? 'physical' : null,
    );

    const [selectedId, setSelectedId] = useState<string | null>(existingAgencyId);

    const [submitError, setSubmitError] = useState<string | null>(null);
    const [isSkipping, setIsSkipping] = useState(false);

    // ── Product type choice ───────────────────────────────────────────────────

    const handleChoosePhysical = () => {
        setProductType('physical');
        setSubmitError(null);
    };

    const handleChooseService = () => {
        setProductType('service');
        setSelectedId(null);
        setSubmitError(null);
    };

    // ── Submission ────────────────────────────────────────────────────────────

    const handleSubmitAgency = useCallback(async () => {
        if (!selectedId) return;
        setSubmitError(null);
        saveDraft(2, { default_delivery_agency_id: selectedId });
        try {
            await submitDeliveryLinking({ default_delivery_agency_id: selectedId });
            toast.success('Delivery agency linked!');
        } catch (err) {
            setSubmitError(
                err instanceof ApiError
                    ? err.isServer
                        ? 'A server error occurred. Please try again.'
                        : err.message
                    : 'Submission failed. Please try again.',
            );
        }
    }, [selectedId, submitDeliveryLinking, saveDraft]);

    const handleSkip = useCallback(async () => {
        setSubmitError(null);
        setIsSkipping(true);
        try {
            await submitDeliveryLinking({ skip: true });
            toast.success('Step skipped.');
        } catch (err) {
            setSubmitError(
                err instanceof ApiError ? err.message : 'Could not continue. Please try again.',
            );
        } finally {
            setIsSkipping(false);
        }
    }, [submitDeliveryLinking]);

    // ── CTA slot ──────────────────────────────────────────────────────────────

    let ctaSlot: React.ReactNode = null;

    if (productType === 'physical') {
        ctaSlot = (
            <div className="space-y-2">
                <Button
                    type="button"
                    onClick={handleSubmitAgency}
                    disabled={!selectedId || isSubmitting || isSkipping}
                    className="w-full h-12 text-base font-semibold gap-2"
                >
                    {isSubmitting && !isSkipping ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Linking…
                        </>
                    ) : (
                        <>
                            Continue
                            <ChevronRight className="w-4 h-4" />
                        </>
                    )}
                </Button>
                <button
                    type="button"
                    onClick={handleChooseService}
                    disabled={isSubmitting || isSkipping}
                    className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2 disabled:opacity-50"
                >
                    I only sell services — skip this step
                </button>
            </div>
        );
    } else if (productType === 'service') {
        ctaSlot = (
            <div className="space-y-2">
                <Button
                    type="button"
                    onClick={handleSkip}
                    disabled={isSubmitting || isSkipping}
                    className="w-full h-12 text-base font-semibold gap-2"
                >
                    {isSkipping ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Continuing…
                        </>
                    ) : (
                        <>
                            Continue
                            <ChevronRight className="w-4 h-4" />
                        </>
                    )}
                </Button>
                <button
                    type="button"
                    onClick={handleChoosePhysical}
                    disabled={isSubmitting || isSkipping}
                    className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2 disabled:opacity-50"
                >
                    Actually, I do sell physical products
                </button>
            </div>
        );
    }

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <OnboardingLayout ctaSlot={ctaSlot} stepKey={2}>
            <div className="space-y-2 mb-6">
                <h1 className="text-2xl font-bold">Delivery Linking</h1>
                <p className="text-muted-foreground text-sm">
                    {productType === null
                        ? 'Do you sell physical products that need to be shipped?'
                        : productType === 'physical'
                          ? 'Select the delivery agency that will handle your orders.'
                          : 'No delivery needed for your business.'}
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

            {/* ── Physical: agency browser ── */}
            {productType === 'physical' && (
                <AgencyBrowser selectedId={selectedId} onSelect={setSelectedId} />
            )}

            {/* ── Service-only confirmation ── */}
            {productType === 'service' && <ServiceOnlyConfirmation />}
        </OnboardingLayout>
    );
}
