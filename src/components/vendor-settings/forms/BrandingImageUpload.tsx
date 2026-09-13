import { useCallback, useRef, useState } from 'react';
import { Loader2, Upload, X, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { uploadMediaWithProgress } from '@/services/files.service';
import { getUploadErrorMessage } from '@/lib/uploadErrors';
import { UploadSourceSheet } from '@/components/common/UploadSourceSheet';
import { nativeMediaAvailable } from '@/platform/media';
import { useTranslation } from '@/i18n';
import type { ApiFile } from '@/types/file.types';

export interface BrandingImageUploadProps {
    label: string;
    hint?: string;
    fileId: string | null | undefined;
    /** Currently-persisted image url (from `branding.logo?.url` / `coverImage?.url`). */
    previewUrl: string | null;
    /** Fires with the new file id (or `null` on remove) and the full uploaded file,
     *  so the caller can build an accurate optimistic `Branding` read-shape object. */
    onChange: (fileId: string | null, file: ApiFile | null) => void;
    aspect?: 'square' | 'wide';
}

/** Single-image upload control bound to a branding file-id field (logo or cover). */
export function BrandingImageUpload({
    label,
    hint,
    fileId,
    previewUrl,
    onChange,
    aspect = 'square',
}: BrandingImageUploadProps) {
    const { t } = useTranslation();
    const [uploading, setUploading] = useState(false);
    const [localPreview, setLocalPreview] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    // Native only — nothing on the web ever opens it (CAPACITOR-PLAN.md → P4.3).
    const [sourceOpen, setSourceOpen] = useState(false);

    const displayUrl = localPreview ?? previewUrl;
    const hasImage = !!fileId && !!displayUrl;

    /** One image, whatever the source: the hidden input, the camera, or the library. */
    const handleFiles = useCallback(
        async (files: File[]) => {
            const file = files[0];
            if (!file) return;
            setError(null);
            setUploading(true);
            try {
                const [uploaded] = await uploadMediaWithProgress([file]);
                setLocalPreview(URL.createObjectURL(file));
                onChange(uploaded.id, uploaded);
            } catch (err) {
                // Per-file violation reasons ("… is too large", "… failed the
                // security scan") rather than one generic sentence — this was
                // the only upload call site not going through the helper.
                setError(getUploadErrorMessage(err, [file]));
            } finally {
                setUploading(false);
            }
        },
        [onChange],
    );

    const handleInputChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void handleFiles([file]);
        },
        [handleFiles],
    );

    // On a device the Change/Upload button opens the source sheet (camera /
    // library / files); on the web it is the same click on the same hidden
    // input it always was.
    const requestUpload = useCallback(() => {
        if (nativeMediaAvailable) setSourceOpen(true);
        else inputRef.current?.click();
    }, []);

    const handleRemove = useCallback(() => {
        setLocalPreview(null);
        onChange(null, null);
    }, [onChange]);

    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            <div className="flex items-center gap-3">
                <div
                    className={cn(
                        'rounded-lg border bg-muted flex items-center justify-center overflow-hidden flex-shrink-0',
                        aspect === 'square' ? 'w-16 h-16' : 'w-24 h-14',
                    )}
                >
                    {displayUrl ? (
                        <img src={displayUrl} alt={label} className="w-full h-full object-cover" />
                    ) : (
                        <ImageIcon className="w-5 h-5 text-muted-foreground" />
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <input
                        ref={inputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleInputChange}
                    />
                    <UploadSourceSheet
                        open={sourceOpen}
                        onOpenChange={setSourceOpen}
                        onPicked={handleFiles}
                        onBrowseFiles={() => inputRef.current?.click()}
                        // A logo or a cover is one image, and never a video —
                        // the slot holds exactly one file id.
                        multiple={false}
                        allowVideo={false}
                    />
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploading}
                        onClick={requestUpload}
                        className="h-8 gap-1.5 text-xs"
                    >
                        {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                        {hasImage ? t('common.actions.change') : t('common.actions.upload')}
                    </Button>
                    {hasImage && (
                        <button
                            type="button"
                            onClick={handleRemove}
                            aria-label={t('settings.branding.removeImage', { label })}
                            className="text-muted-foreground hover:text-destructive transition-colors tap-target"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
            {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
            {error && (
                <p className="text-sm text-destructive" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
}
