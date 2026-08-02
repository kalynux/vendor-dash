import { useCallback, useState } from 'react';

import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { type Step4FormValues } from '@/onboarding/schemas/onboarding.schemas';
import { PoliciesFields } from '@/components/vendor-settings/forms/PoliciesFields';
import {
    buildPolicyDefaults,
    type PolicyEnabled,
} from '@/components/vendor-settings/forms/policies.helpers';
import { mapProfileError } from '@/components/vendor-settings/errors';
import { UnsavedChangesBar } from '@/components/vendor-settings/UnsavedChangesBar';
import { SettingsSection } from '@/components/vendor-settings/SettingsSection';

const FORM_ID = 'settings-policies-form';

export function PoliciesSettings() {
    const { session, updateVendorProfile } = useOnboarding();
    const roleEntity = session?.role_entity;
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dirty, setDirty] = useState(false);
    // Bumped after a save or discard to remount PoliciesFields, resetting its
    // internal form + enabled toggles to the latest persisted defaults.
    const [formKey, setFormKey] = useState(0);

    const onDirtyChange = useCallback((next: boolean) => setDirty(next), []);

    const handleDiscard = useCallback(() => {
        setError(null);
        setDirty(false);
        setFormKey((k) => k + 1);
    }, []);

    const onSubmit = useCallback(
        async (values: Step4FormValues, enabled: PolicyEnabled) => {
            setSaving(true);
            setError(null);
            try {
                // Full replace of the whole policies object — send null for any
                // sub-policy that has been disabled so it is cleared.
                await updateVendorProfile({
                    policies: {
                        return_policy: enabled.return ? values.return_policy : null,
                        cancellation_policy: enabled.cancellation ? values.cancellation_policy : null,
                        support_policy: enabled.support ? values.support_policy : null,
                        documents: values.documents ?? [],
                    },
                });
                // Reset the dirty state by remounting against the freshly-saved session.
                setDirty(false);
                setFormKey((k) => k + 1);
            } catch (err) {
                setError(mapProfileError(err));
            } finally {
                setSaving(false);
            }
        },
        [updateVendorProfile],
    );

    if (!roleEntity) return null;

    const existingPolicies = roleEntity.policies;
    const defaultValues = buildPolicyDefaults(existingPolicies);
    const defaultEnabled: PolicyEnabled = {
        return: !!existingPolicies?.return_policy,
        cancellation: !!existingPolicies?.cancellation_policy,
        support: !!existingPolicies?.support_policy,
    };

    return (
        <>
            <SettingsSection
                title="Policies"
                info={
                    <div className="space-y-2">
                        <p>
                            The rules customers see on your storefront and that support falls back on
                            when there&apos;s a dispute. Every field below has its own info icon
                            explaining what it changes.
                        </p>
                        <p>
                            Switching a whole policy off deletes it — your store then shows no policy
                            for that area, which customers read as &ldquo;not offered&rdquo;.
                        </p>
                    </div>
                }
                contentClassName="space-y-6"
            >
                    {error && (
                        <div
                            role="alert"
                            className="p-3 text-sm bg-destructive/10 text-destructive rounded-lg border border-destructive/20"
                        >
                            {error}
                        </div>
                    )}

                    <PoliciesFields
                        key={formKey}
                        formId={FORM_ID}
                        defaultValues={defaultValues}
                        defaultEnabled={defaultEnabled}
                        onSubmit={onSubmit}
                        onDirtyChange={onDirtyChange}
                    />
            </SettingsSection>

            <UnsavedChangesBar
                visible={dirty || saving}
                saving={saving}
                onDiscard={handleDiscard}
                formId={FORM_ID}
            />
        </>
    );
}
