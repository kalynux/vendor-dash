import { useCallback, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { type Step4FormValues } from '@/onboarding/schemas/onboarding.schemas';
import { PoliciesFields } from '@/components/vendor-settings/forms/PoliciesFields';
import {
    buildPolicyDefaults,
    type PolicyEnabled,
} from '@/components/vendor-settings/forms/policies.helpers';
import { mapProfileError } from '@/components/vendor-settings/errors';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const FORM_ID = 'settings-policies-form';

export function PoliciesSettings() {
    const { session, updateVendorProfile } = useOnboarding();
    const roleEntity = session?.role_entity;
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
                toast.success('Policies updated');
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
        <Card>
            <CardHeader>
                <CardTitle>Policies</CardTitle>
                <CardDescription>
                    Your return, cancellation, and support policies. Toggle a section off to remove it.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {error && (
                    <div
                        role="alert"
                        className="p-3 text-sm bg-destructive/10 text-destructive rounded-lg border border-destructive/20"
                    >
                        {error}
                    </div>
                )}

                <PoliciesFields
                    formId={FORM_ID}
                    defaultValues={defaultValues}
                    defaultEnabled={defaultEnabled}
                    onSubmit={onSubmit}
                />

                <div className="flex justify-end border-t pt-4">
                    <Button type="submit" form={FORM_ID} disabled={saving} className="gap-2">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Changes
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
