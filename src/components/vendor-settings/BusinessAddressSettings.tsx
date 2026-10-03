import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { type Step3FormValues } from '@/onboarding/schemas/onboarding.schemas';
import { BrandingFields } from '@/components/vendor-settings/forms/BrandingFields';
import {
    regionProblemFrom,
    sendableAddresses,
    type AddressRegionProblem,
} from '@/components/vendor-settings/forms/address-region';
import { mapProfileError } from '@/components/vendor-settings/errors';
import { UnsavedChangesBar } from '@/components/vendor-settings/UnsavedChangesBar';
import { SettingsSection } from '@/components/vendor-settings/SettingsSection';
import { useTranslation } from '@/i18n';

const FORM_ID = 'settings-addresses-form';

/**
 * Business pickup addresses — its own Account tab. These are the vendor's
 * physical store locations / pickup points; they live on the vendor profile
 * (not the store), so this submits ONLY `business_addresses` and never clobbers
 * other profile fields (PATCH /vendor/profile uses full-replace semantics per field).
 */
export function BusinessAddressSettings() {
    const { t } = useTranslation();
    const { session, updateVendorProfile } = useOnboarding();
    const roleEntity = session?.role_entity;
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dirty, setDirty] = useState(false);
    const [regionProblem, setRegionProblem] = useState<AddressRegionProblem | null>(null);
    // Bumped after a save or discard to remount BrandingFields, resetting its
    // internal form to the latest persisted defaults.
    const [formKey, setFormKey] = useState(0);

    const onDirtyChange = useCallback((next: boolean) => setDirty(next), []);

    const handleDiscard = useCallback(() => {
        setError(null);
        setRegionProblem(null);
        setDirty(false);
        setFormKey((k) => k + 1);
    }, []);

    const onSubmit = useCallback(
        async (values: Step3FormValues) => {
            setSaving(true);
            setError(null);
            setRegionProblem(null);
            // Full replace: every row goes back, untouched ones with their `_id`
            // and `geo` exactly as loaded, so the server sees them as unchanged.
            const sent = sendableAddresses(values.business_addresses);
            try {
                await updateVendorProfile({ business_addresses: sent.addresses });
                toast.success(t('settings.addresses.saved'));
                // Reset the dirty state by remounting against the freshly-saved session.
                setDirty(false);
                setFormKey((k) => k + 1);
            } catch (err) {
                // ADDRESS_REGION_INVALID: the form keeps the vendor's edits and
                // shows a region picker on the refused row.
                setRegionProblem(regionProblemFrom(err, sent));
                setError(mapProfileError(err));
            } finally {
                setSaving(false);
            }
        },
        [updateVendorProfile, t],
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
                title={t('settings.addresses.title')}
                info={
                    <div className="space-y-2">
                        <p>{t('settings.addresses.info1')}</p>
                        <p>{t('settings.addresses.info2')}</p>
                        <p>{t('settings.addresses.info3')}</p>
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
                    regionProblem={regionProblem}
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
