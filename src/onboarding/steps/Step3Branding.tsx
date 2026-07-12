import { useCallback, useState } from 'react';
import { Loader2, ChevronRight, SkipForward } from 'lucide-react';
import { toast } from 'sonner';

import { OnboardingLayout } from '@/onboarding/OnboardingLayout';
import { type Step3FormValues } from '@/onboarding/schemas/onboarding.schemas';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { BrandingFields } from '@/components/vendor-settings/forms/BrandingFields';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/types/api';

export function Step3Branding() {
    const { submitBranding, isSubmitting, session, drafts, saveDraft } = useOnboarding();
    const [apiError, setApiError] = useState<string | null>(null);
    const [isSkipping, setIsSkipping] = useState(false);

    const roleEntity = session?.role_entity;
    const draft = drafts.branding;

    // Pre-population priority: draft → session role_entity → empty defaults
    const defaultAddresses = (): Step3FormValues['business_addresses'] => {
        if (draft?.business_addresses?.length) return draft.business_addresses;
        if (roleEntity?.business_addresses?.length) {
            return roleEntity.business_addresses.map((a) => ({
                _id: a._id,
                label: a.label ?? '',
                address_line1: a.address_line1,
                address_line2: a.address_line2 ?? '',
                city: a.city,
                state: a.state ?? '',
            }));
        }
        return [];
    };

    const defaultValues: Step3FormValues = {
        logo_file_id: draft?.logo_file_id ?? roleEntity?.branding?.logo?.id ?? null,
        cover_image_file_id: draft?.cover_image_file_id ?? roleEntity?.branding?.coverImage?.id ?? null,
        business_addresses: defaultAddresses(),
    };

    const handleSave = useCallback(
        async (values: Step3FormValues) => {
            setApiError(null);
            // Save draft before API call
            saveDraft(3, values);
            try {
                await submitBranding({
                    skip: false,
                    branding: {
                        logo_file_id: values.logo_file_id ?? null,
                        cover_image_file_id: values.cover_image_file_id ?? null,
                    },
                    business_addresses: values.business_addresses?.filter(
                        (a) => a.address_line1.trim().length > 0,
                    ),
                    version: roleEntity?.version,
                });
                toast.success('Profile complete! Welcome aboard 🎉');
            } catch (err) {
                if (err instanceof ApiError) {
                    if (err.isConcurrentModification) {
                        setApiError(
                            'Your profile was modified in another session. Please refresh and try again.',
                        );
                    } else if (err.isValidation && err.details?.length) {
                        setApiError(err.details[0].message);
                    } else if (err.isServer) {
                        setApiError('A server error occurred. Please try again.');
                    } else {
                        setApiError(err.message);
                    }
                }
            }
        },
        [submitBranding, saveDraft, roleEntity?.version],
    );

    const handleSkip = useCallback(async () => {
        setApiError(null);
        setIsSkipping(true);
        try {
            await submitBranding({ skip: true });
            toast.success('Setup complete! Welcome to the dashboard 🎉');
        } catch (err) {
            setApiError(
                err instanceof ApiError ? err.message : 'Could not skip. Please try again.',
            );
        } finally {
            setIsSkipping(false);
        }
    }, [submitBranding]);

    const ctaSlot = (
        <div className="space-y-2">
            <Button
                type="submit"
                form="step3-form"
                disabled={isSubmitting || isSkipping}
                className="w-full h-12 text-base font-semibold gap-2"
            >
                {isSubmitting && !isSkipping ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving…
                    </>
                ) : (
                    <>
                        Save & Finish
                        <ChevronRight className="w-4 h-4" />
                    </>
                )}
            </Button>
            <Button
                type="button"
                variant="ghost"
                disabled={isSubmitting || isSkipping}
                onClick={handleSkip}
                className="w-full h-11 text-muted-foreground gap-2"
            >
                {isSkipping ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <SkipForward className="w-4 h-4" />
                )}
                Skip for now
            </Button>
        </div>
    );

    return (
        <OnboardingLayout ctaSlot={ctaSlot} stepKey={3}>
            <div className="space-y-2 mb-2">
                <h1 className="text-2xl font-bold">Branding & Addresses</h1>
                <p className="text-muted-foreground text-sm">
                    Optional — add your logo and store address to give customers a
                    better experience. You can always do this later.
                </p>
            </div>

            <div className="inline-flex items-center gap-1.5 bg-muted text-muted-foreground text-xs px-2.5 py-1 rounded-full mb-6">
                <SkipForward className="w-3 h-3" />
                This step is optional
            </div>

            {apiError && (
                <div
                    role="alert"
                    className="mb-6 p-3 text-sm bg-destructive/10 text-destructive rounded-lg border border-destructive/20"
                >
                    {apiError}
                </div>
            )}

            <BrandingFields
                formId="step3-form"
                defaultValues={defaultValues}
                onSubmit={handleSave}
                logoPreviewUrl={roleEntity?.branding?.logo?.url ?? null}
                coverPreviewUrl={roleEntity?.branding?.coverImage?.url ?? null}
            />
        </OnboardingLayout>
    );
}
