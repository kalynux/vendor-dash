import { useCallback, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { type Step3FormValues } from '@/onboarding/schemas/onboarding.schemas';
import { BrandingFields } from '@/components/vendor-settings/forms/BrandingFields';
import { mapProfileError } from '@/components/vendor-settings/errors';
import { resolveFileUrl } from '@/services/files.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { Branding, BrandingFileRef } from '@/types/api';
import type { ApiFile } from '@/types/file.types';

const FORM_ID = 'settings-branding-form';

export function BrandingSettings() {
    const { session, updateVendorProfile } = useOnboarding();
    const roleEntity = session?.role_entity;
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Tracks the latest uploaded/removed file for each slot so we can hand the store
    // an accurate optimistic `Branding` (read shape) — the PATCH response doesn't
    // echo back populated file objects.
    const [logoFile, setLogoFile] = useState<BrandingFileRef | null>(roleEntity?.branding?.logo ?? null);
    const [coverFile, setCoverFile] = useState<BrandingFileRef | null>(roleEntity?.branding?.coverImage ?? null);

    const handleBrandingFileChange = useCallback((which: 'logo' | 'cover', file: ApiFile | null) => {
        const ref: BrandingFileRef | null = file
            ? {
                  id: file.id,
                  key: file.key,
                  url: resolveFileUrl(file),
                  mimeType: file.mimeType,
                  size: file.size,
                  originalName: file.originalName,
              }
            : null;
        if (which === 'logo') setLogoFile(ref);
        else setCoverFile(ref);
    }, []);

    const onSubmit = useCallback(
        async (values: Step3FormValues) => {
            setSaving(true);
            setError(null);
            try {
                const brandingPreview: Branding = { logo: logoFile, coverImage: coverFile };
                await updateVendorProfile({
                    branding: {
                        logo_file_id: values.logo_file_id ?? null,
                        cover_image_file_id: values.cover_image_file_id ?? null,
                    },
                    brandingPreview,
                });
                toast.success('Branding updated');
            } catch (err) {
                setError(mapProfileError(err));
            } finally {
                setSaving(false);
            }
        },
        [updateVendorProfile, logoFile, coverFile],
    );

    if (!roleEntity) return null;

    const defaultValues: Step3FormValues = {
        logo_file_id: roleEntity.branding?.logo?.id ?? null,
        cover_image_file_id: roleEntity.branding?.coverImage?.id ?? null,
        // Addresses are managed under the Store tab now; keep empty here so the
        // branding-only save never touches them (full-replace semantics).
        business_addresses: [],
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Branding</CardTitle>
                <CardDescription>
                    Your store logo and cover image.
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
                    showAddresses={false}
                    logoPreviewUrl={roleEntity.branding?.logo?.url ?? null}
                    coverPreviewUrl={roleEntity.branding?.coverImage?.url ?? null}
                    onBrandingFileChange={handleBrandingFileChange}
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
