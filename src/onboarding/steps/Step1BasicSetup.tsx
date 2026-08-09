import { useCallback, useState } from 'react';
import { Loader2, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

import { OnboardingLayout } from '@/onboarding/OnboardingLayout';
import { type Step1FormValues } from '@/onboarding/schemas/onboarding.schemas';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { BasicSetupFields } from '@/components/vendor-settings/forms/BasicSetupFields';
import { Button } from '@/components/ui/button';
import { useTranslation, useApiError } from '@/i18n';

export function Step1BasicSetup() {
    const { t } = useTranslation();
    const errors = useApiError();
    const { submitBasicSetup, isSubmitting, session, drafts, saveDraft } = useOnboarding();
    const [apiError, setApiError] = useState<string | null>(null);

    const roleEntity = session?.role_entity;
    const draft = drafts.basicSetup;

    // Pre-population priority: draft → session role_entity → nothing.
    // Nothing means an empty list, not a blank entry: the methods editor has an
    // empty state of its own, and a half-built row would only read as broken.
    const defaultPayoutDetails = (): Step1FormValues['payout_details'] => {
        if (draft?.payout_details?.length) return draft.payout_details;
        if (roleEntity?.payout_details?.length) {
            return roleEntity.payout_details as Step1FormValues['payout_details'];
        }
        return [];
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
                toast.success(t('onboarding.basicSetup.saved'));
            } catch (err) {
                setApiError(errors.resolve(err, { fallbackKey: 'onboarding.errors.saveFailed' }));
            }
        },
        [submitBasicSetup, saveDraft, roleEntity?.version, t, errors],
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
                    {t('common.actions.saving')}
                </>
            ) : (
                <>
                    {t('common.actions.continue')}
                    <ChevronRight className="w-4 h-4" />
                </>
            )}
        </Button>
    );

    return (
        <OnboardingLayout ctaSlot={ctaSlot} stepKey={1}>
            <div className="space-y-2 mb-8">
                <h1 className="text-2xl font-bold">{t('onboarding.basicSetup.heading')}</h1>
                <p className="text-muted-foreground text-sm">
                    {t('onboarding.basicSetup.subheading')}
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
