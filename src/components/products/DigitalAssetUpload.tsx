import { useRef, useState } from 'react';
import { Upload, Trash2, FileText, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useFormatters, useTranslation } from '@/i18n';

interface CurrentAsset {
  assetId: string;
  filename: string;
  size: number;
  mimeType: string;
}

interface DigitalAssetUploadProps {
  currentAsset: CurrentAsset | null;
  onFileSelect: (file: File) => void;
  onRemove: () => void;
  isUploading?: boolean;
  disabled?: boolean;
}

// Allowed MIME types per API spec
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/octet-stream',
  'video/mp4',
  'video/quicktime',
  'audio/mpeg',
  'audio/wav',
  'audio/mp3',
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/epub+zip',
]);

const MAX_SIZE_BYTES = 500 * 1024 * 1024; // 500MB

export function DigitalAssetUpload({
  currentAsset,
  onFileSelect,
  onRemove,
  isUploading = false,
  disabled = false,
}: DigitalAssetUploadProps) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  function validate(file: File): string | null {
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return t('products.asset.typeNotAllowed', { type: file.type });
    }
    if (file.size > MAX_SIZE_BYTES) {
      return t('products.asset.tooLarge', { size: fmt.fileSize(file.size) });
    }
    return null;
  }

  function handleFile(file: File) {
    const err = validate(file);
    if (err) {
      setValidationError(err);
      return;
    }
    setValidationError(null);
    onFileSelect(file);
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled || isUploading) return;
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  if (currentAsset) {
    // Drawn like a filled-in field — the file IS this field's value.
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-md border border-input py-2 pl-3 pr-1.5">
          <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{currentAsset.filename}</p>
            <p className="truncate text-sm text-muted-foreground">
              {fmt.fileSize(currentAsset.size)} · {currentAsset.mimeType}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={disabled || isUploading}
            >
              {t('products.asset.replace')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onRemove}
              disabled={disabled || isUploading}
              aria-label={t('common.actions.remove')}
              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>

        {/* A rejected replacement used to vanish without a word here. */}
        {validationError && (
          <div className="flex items-start gap-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => !disabled && !isUploading && inputRef.current?.click()}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-md border border-dashed px-4 py-6 text-center transition-colors',
          isDragging ? 'border-primary bg-primary/5' : 'border-input hover:border-primary/50 hover:bg-muted/40',
          (disabled || isUploading) && 'pointer-events-none cursor-not-allowed opacity-50',
        )}
      >
        {isUploading ? (
          <>
            <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">{t('products.asset.uploading')}</p>
          </>
        ) : (
          <>
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {t(isDragging ? 'products.asset.dropHere' : 'products.asset.dragOrClick')}
              </p>
              <p className="text-sm text-muted-foreground">
                {t('products.asset.supported')}
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" className="pointer-events-none gap-1.5">
              <Upload className="size-4" />
              {t('products.asset.selectFile')}
            </Button>
          </>
        )}
      </div>

      {validationError && (
        <div className="flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
    </div>
  );
}
