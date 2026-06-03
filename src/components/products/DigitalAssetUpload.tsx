import { useRef, useState } from 'react';
import { FileDigit, Upload, Trash2, RefreshCw, FileText, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DigitalAssetUpload({
  currentAsset,
  onFileSelect,
  onRemove,
  isUploading = false,
  disabled = false,
}: DigitalAssetUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  function validate(file: File): string | null {
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return `File type "${file.type}" is not allowed. Supported: PDF, ZIP, MP4, MP3, images, Word, Excel.`;
    }
    if (file.size > MAX_SIZE_BYTES) {
      return `File too large (${formatBytes(file.size)}). Maximum is 500MB.`;
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
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-muted/40">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <FileText className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{currentAsset.filename}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatBytes(currentAsset.size)} · {currentAsset.mimeType}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={disabled || isUploading}
              className="gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Replace
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRemove}
              disabled={disabled || isUploading}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

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
          'border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all',
          isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/50',
          (disabled || isUploading) && 'opacity-50 cursor-not-allowed pointer-events-none',
        )}
      >
        {isUploading ? (
          <>
            <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="text-sm font-medium text-muted-foreground">Uploading asset…</p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
              <FileDigit className="w-8 h-8 text-muted-foreground" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-medium">
                {isDragging ? 'Drop your file here' : 'Drag & drop or click to upload'}
              </p>
              <p className="text-xs text-muted-foreground">
                PDF, ZIP, MP4, MP3, images, Word, Excel · max 500MB
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" className="gap-2 pointer-events-none">
              <Upload className="w-3.5 h-3.5" />
              Select File
            </Button>
          </>
        )}
      </div>

      {validationError && (
        <div className="flex items-start gap-2 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
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
