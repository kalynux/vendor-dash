import { useCallback, useState } from 'react';
import { Loader2, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

import { OnboardingLayout } from '@/onboarding/OnboardingLayout';
import { type Step1FormValues } from '@/onboarding/schemas/onboarding.schemas';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { BasicSetupFields } from '@/components/vendor-settings/forms/BasicSetupFields';
import { emptyMobileMoneyEntry } from '@/components/vendor-settings/forms/basicSetup.helpers';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/types/api';

export function Step1BasicSetup() {
    const { submitBasicSetup, isSubmitting, session, drafts, saveDraft } = useOnboarding();
    const [apiError, setApiError] = useState<string | null>(null);

    const roleEntity = session?.role_entity;
    const draft = drafts.basicSetup;

    // Pre-population priority: draft → session role_entity → empty defaults
    const defaultPayoutDetails = (): Step1FormValues['payout_details'] => {
        if (draft?.payout_details?.length) return draft.payout_details;
        if (roleEntity?.payout_details?.length) {
            return roleEntity.payout_details as Step1FormValues['payout_details'];
        }
        return [emptyMobileMoneyEntry()];
    };

    const defaultValues: Step1FormValues = {
        country: draft?.country ?? roleEntity?.country ?? '',
        timezone: draft?.timezone ?? roleEntity?.timezone ?? '',
        payout_details: defaultPayoutDetails(),
    };

    const onSubmit = useCallback(
        async (values: Step1FormValues) => {
            setApiError(null);
            // Save draft before API call for back-navigation pre-population
            saveDraft(1, values);
            try {
                await submitBasicSetup({
                    country: values.country,
                    timezone: values.timezone,
                    payout_details: values.payout_details,
                    version: roleEntity?.version,
                });
                toast.success('Basic setup saved!');
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
        [submitBasicSetup, saveDraft, roleEntity?.version],
    );

    const ctaSlot = (
        <Button
            type="submit"
            form="step1-form"
            disabled={isSubmitting}
            className="w-full h-12 text-base font-semibold gap-2"
        >
            {isSubmitting ? (
                <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving…
                </>
            ) : (
                <>
                    Continue
                    <ChevronRight className="w-4 h-4" />
                </>
            )}
        </Button>
    );

    return (
        <OnboardingLayout ctaSlot={ctaSlot} stepKey={1}>
            <div className="space-y-2 mb-8">
                <h1 className="text-2xl font-bold">Basic Setup</h1>
                <p className="text-muted-foreground text-sm">
                    Tell us where you operate and how you'd like to receive payouts.
                </p>
            </div>

            {apiError && (
                <div
                    role="alert"
                    className="mb-6 p-3 text-sm bg-destructive/10 text-destructive rounded-lg border border-destructive/20"
                >
                    {apiError}
                </div>
            )}

            <BasicSetupFields formId="step1-form" defaultValues={defaultValues} onSubmit={onSubmit} />
        </OnboardingLayout>
    );
}
