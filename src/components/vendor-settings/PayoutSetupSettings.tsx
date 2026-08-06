import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { type Step1FormValues } from '@/onboarding/schemas/onboarding.schemas';
import { BasicSetupFields } from '@/components/vendor-settings/forms/BasicSetupFields';
import { emptyMobileMoneyEntry } from '@/components/vendor-settings/forms/basicSetup.helpers';
import { mapProfileError } from '@/components/vendor-settings/errors';
import { UnsavedChangesBar } from '@/components/vendor-settings/UnsavedChangesBar';
import { SettingsSection } from '@/components/vendor-settings/SettingsSection';
import { useTranslation } from '@/i18n';

const FORM_ID = 'settings-payout-form';

export function PayoutSetupSettings() {
    const { t } = useTranslation();
    const { session, updateVendorProfile } = useOnboarding();
    const roleEntity = session?.role_entity;
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dirty, setDirty] = useState(false);
    // Bumped after a save or discard to remount BasicSetupFields, resetting its
    // internal form to the latest persisted defaults.
    const [formKey, setFormKey] = useState(0);

    const onDirtyChange = useCallback((next: boolean) => setDirty(next), []);

    const handleDiscard = useCallback(() => {
        setError(null);
        setDirty(false);
        setFormKey((k) => k + 1);
    }, []);

    const onSubmit = useCallback(
        async (values: Step1FormValues) => {
            setSaving(true);
            setError(null);
            try {
                // Country/timezone now live in the Store tab — only payout methods
                // are managed here.
                await updateVendorProfile({ payout_details: values.payout_details });
                toast.success(t('settings.payout.saved'));
                // Reset the dirty state by remounting against the freshly-saved session.
                setDirty(false);
                setFormKey((k) => k + 1);
            } catch (err) {
                setError(mapProfileError(err));
            } finally {
                setSaving(false);
            }
        },
        [updateVendorProfile, t],
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
        // A plain wrapper, not a fragment: on the Payout tab this sits inside a
        // `SettingsSections` whose `divide-y` would otherwise draw a hairline
        // across the top of the floating bar.
        <div>
            <SettingsSection
                title={t('settings.payout.paymentMethodsTitle')}
                info={
                    <div className="space-y-2">
                        <p>{t('settings.payout.paymentMethodsInfo1')}</p>
                        <p>{t('settings.payout.paymentMethodsInfo2')}</p>
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

                <BasicSetupFields
                    key={formKey}
                    formId={FORM_ID}
                    defaultValues={defaultValues}
                    onSubmit={onSubmit}
                    onDirtyChange={onDirtyChange}
                    showRegion={false}
                    showMethodsHeading={false}
                />
            </SettingsSection>

            <UnsavedChangesBar
                visible={dirty || saving}
                saving={saving}
                onDiscard={handleDiscard}
                formId={FORM_ID}
            />
        </div>
    );
}
