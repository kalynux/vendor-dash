import { useCallback, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { type Step3FormValues } from '@/onboarding/schemas/onboarding.schemas';
import { BrandingFields } from '@/components/vendor-settings/forms/BrandingFields';
import { mapProfileError } from '@/components/vendor-settings/errors';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const FORM_ID = 'settings-addresses-form';

/**
 * Business pickup addresses. Lives under the Store tab (moved out of Branding).
 * Submits ONLY `business_addresses` so it never clobbers the stored branding
 * (PATCH /vendor/profile uses full-replace semantics per field).
 */
export function BusinessAddressSettings() {
    const { session, updateVendorProfile } = useOnboarding();
    const roleEntity = session?.role_entity;
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const onSubmit = useCallback(
        async (values: Step3FormValues) => {
            setSaving(true);
            setError(null);
            try {
                await updateVendorProfile({
                    business_addresses: (values.business_addresses ?? []).filter(
                        (a) => a.address_line1.trim().length > 0,
                    ),
                });
                toast.success('Business addresses updated');
            } catch (err) {
                setError(mapProfileError(err));
            } finally {
                setSaving(false);
            }
        },
        [updateVendorProfile],
    );

    if (!roleEntity) return null;

    const defaultValues: Step3FormValues = {
        logo_file_id: null,
        cover_image_file_id: null,
        business_addresses: (roleEntity.business_addresses ?? []).map((a) => ({
            _id: a._id,
            label: a.label ?? '',
            address_line1: a.address_line1,
            address_line2: a.address_line2 ?? '',
            city: a.city,
            state: a.state ?? '',
        })),
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Business Addresses</CardTitle>
                <CardDescription>
                    Your pickup locations. Customers won't see a pickup point until you add one.
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

                <BrandingFields
                    formId={FORM_ID}
                    defaultValues={defaultValues}
                    onSubmit={onSubmit}
                    showBranding={false}
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
