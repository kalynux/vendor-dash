import { useCallback, useState } from 'react';
import { Loader2, ChevronRight, SkipForward } from 'lucide-react';
import { toast } from 'sonner';

import { OnboardingLayout } from '@/onboarding/OnboardingLayout';
import { type Step4FormValues } from '@/onboarding/schemas/onboarding.schemas';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { PoliciesFields } from '@/components/vendor-settings/forms/PoliciesFields';
import {
    buildPolicyDefaults,
    type PolicyEnabled,
} from '@/components/vendor-settings/forms/policies.helpers';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/types/api';

export function Step4PolicySetup() {
    const { submitPolicySetup, isSubmitting, session, drafts, saveDraft } = useOnboarding();
    const [apiError, setApiError] = useState<string | null>(null);
    const [isSkipping, setIsSkipping] = useState(false);

    const roleEntity = session?.role_entity;
    const existingPolicies = roleEntity?.policies;
    const draft = drafts.policySetup;

    const defaultValues = buildPolicyDefaults(draft ?? existingPolicies);
    const defaultEnabled: PolicyEnabled = {
        return: !!(draft?.return_policy ?? existingPolicies?.return_policy),
        cancellation: !!(draft?.cancellation_policy ?? existingPolicies?.cancellation_policy),
        support: !!(draft?.support_policy ?? existingPolicies?.support_policy),
    };

    const handleSave = useCallback(
        async (values: Step4FormValues, enabled: PolicyEnabled) => {
            setApiError(null);
            saveDraft(4, values);
            try {
                await submitPolicySetup({
                    skip: false,
                    ...(enabled.return && values.return_policy ? { return_policy: values.return_policy } : {}),
                    ...(enabled.cancellation && values.cancellation_policy ? { cancellation_policy: values.cancellation_policy } : {}),
                    ...(enabled.support && values.support_policy ? { support_policy: values.support_policy } : {}),
                    version: roleEntity?.version,
                });
                toast.success('Setup complete! Welcome to your dashboard.');
            } catch (err) {
                if (err instanceof ApiError) {
                    if (err.isConcurrentModification) {
                        setApiError('Your profile was modified in another session. Please refresh and try again.');
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
        [submitPolicySetup, saveDraft, roleEntity?.version],
    );

    const handleSkip = useCallback(async () => {
        setApiError(null);
        setIsSkipping(true);
        try {
            await submitPolicySetup({ skip: true });
            toast.success('Setup complete! Welcome to your dashboard.');
        } catch (err) {
            setApiError(
                err instanceof ApiError ? err.message : 'Could not skip. Please try again.',
            );
        } finally {
            setIsSkipping(false);
        }
    }, [submitPolicySetup]);

    const ctaSlot = (
        <div className="space-y-2">
            <Button
                type="submit"
                form="step4-form"
                disabled={isSubmitting || isSkipping}
                className="w-full h-12 text-base font-semibold gap-2"
            >
                {isSubmitting && !isSkipping ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />Saving…</>
                ) : (
                    <>Save & Finish<ChevronRight className="w-4 h-4" /></>
                )}
            </Button>
            <Button
                type="button"
                variant="ghost"
                disabled={isSubmitting || isSkipping}
                onClick={handleSkip}
                className="w-full h-11 text-muted-foreground gap-2"
            >
                {isSkipping ? <Loader2 className="w-4 h-4 animate-spin" /> : <SkipForward className="w-4 h-4" />}
                Skip for now
            </Button>
        </div>
    );

    return (
        <OnboardingLayout ctaSlot={ctaSlot} stepKey={4}>
            <div className="space-y-2 mb-2">
                <h1 className="text-2xl font-bold">Policy Setup</h1>
                <p className="text-muted-foreground text-sm">
                    Define your store's return, cancellation, and support policies.
                    All sections are optional and can be updated later from your dashboard.
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

            <PoliciesFields
                formId="step4-form"
                defaultValues={defaultValues}
                defaultEnabled={defaultEnabled}
                onSubmit={handleSave}
            />
        </OnboardingLayout>
    );
}
