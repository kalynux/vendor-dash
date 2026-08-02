import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { type Step3FormValues } from '@/onboarding/schemas/onboarding.schemas';
import { BrandingFields } from '@/components/vendor-settings/forms/BrandingFields';
import { mapProfileError } from '@/components/vendor-settings/errors';
import { UnsavedChangesBar } from '@/components/vendor-settings/UnsavedChangesBar';
import { SettingsSection } from '@/components/vendor-settings/SettingsSection';

const FORM_ID = 'settings-addresses-form';

/**
 * Business pickup addresses — its own Account tab. These are the vendor's
 * physical store locations / pickup points; they live on the vendor profile
 * (not the store), so this submits ONLY `business_addresses` and never clobbers
 * other profile fields (PATCH /vendor/profile uses full-replace semantics per field).
 */
export function BusinessAddressSettings() {
    const { session, updateVendorProfile } = useOnboarding();
    const roleEntity = session?.role_entity;
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dirty, setDirty] = useState(false);
    // Bumped after a save or discard to remount BrandingFields, resetting its
    // internal form to the latest persisted defaults.
    const [formKey, setFormKey] = useState(0);

    const onDirtyChange = useCallback((next: boolean) => setDirty(next), []);

    const handleDiscard = useCallback(() => {
        setError(null);
        setDirty(false);
        setFormKey((k) => k + 1);
    }, []);

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
            geo: a.geo ?? null,
        })),
    };

    return (
        <>
            <SettingsSection
                title="Business Addresses"
                info={
                    <div className="space-y-2">
                        <p>
                            Your physical pickup locations. Customers won&apos;t see a pickup point on your
                            products until you add at least one.
                        </p>
                        <p>
                            Every new or edited address has to be picked from the search box so we can pin
                            it on the map, and it must sit inside your registered country.
                        </p>
                        <p>
                            Removing an address that a product still uses as its pickup point will block
                            the save until you reassign that product.
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

                <BrandingFields
                    key={formKey}
                    formId={FORM_ID}
                    defaultValues={defaultValues}
                    onSubmit={onSubmit}
                    onDirtyChange={onDirtyChange}
                    showBranding={false}
                    showAddressesHeading={false}
                    addressCountryBias={roleEntity.country}
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
