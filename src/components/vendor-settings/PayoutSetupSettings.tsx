import { useCallback, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { type Step1FormValues } from '@/onboarding/schemas/onboarding.schemas';
import { BasicSetupFields } from '@/components/vendor-settings/forms/BasicSetupFields';
import { emptyMobileMoneyEntry } from '@/components/vendor-settings/forms/basicSetup.helpers';
import { mapProfileError } from '@/components/vendor-settings/errors';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const FORM_ID = 'settings-payout-form';

export function PayoutSetupSettings() {
    const { session, updateVendorProfile } = useOnboarding();
    const roleEntity = session?.role_entity;
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const onSubmit = useCallback(
        async (values: Step1FormValues) => {
            setSaving(true);
            setError(null);
            try {
                // Country/timezone now live in the Store tab — only payout methods
                // are managed here.
                await updateVendorProfile({ payout_details: values.payout_details });
                toast.success('Payout setup updated');
            } catch (err) {
                setError(mapProfileError(err));
            } finally {
                setSaving(false);
            }
        },
        [updateVendorProfile],
    );

    if (!roleEntity) return null;

    // Country/timezone are kept in defaultValues (hidden) so step1Schema stays
    // satisfied; they are not editable here.
    const defaultValues: Step1FormValues = {
        country: roleEntity.country ?? '',
        timezone: roleEntity.timezone ?? '',
        payout_details: roleEntity.payout_details?.length
            ? (roleEntity.payout_details as Step1FormValues['payout_details'])
            : [emptyMobileMoneyEntry()],
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Payout Setup</CardTitle>
                <CardDescription>
                    How you get paid. Add up to 3 payout methods — the first is used by default.
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

                <BasicSetupFields
                    formId={FORM_ID}
                    defaultValues={defaultValues}
                    onSubmit={onSubmit}
                    showRegion={false}
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
