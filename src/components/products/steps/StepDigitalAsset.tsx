import { useState } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { DigitalAssetUpload } from '@/components/products/DigitalAssetUpload';
import type { WizardState, DigitalAssetUploadData } from '@/types/product.types';

interface StepDigitalAssetProps {
  mode: 'create' | 'edit';
  productId: string;
  serverData: Partial<WizardState>;
  isSaving: boolean;
  stepError: string | null;
  onSaveComplete: (updates: Partial<WizardState> & { _pendingAssetFile?: File | null }) => void;
  onBack: () => void;
}

export function StepDigitalAsset({
  mode,
  serverData,
  isSaving,
  stepError,
  onSaveComplete,
  onBack,
}: StepDigitalAssetProps) {
  const digitalConfig = serverData.serverProduct?.digitalConfig;

  // Build currentAsset from server product if available
  const existingAsset: DigitalAssetUploadData | null = digitalConfig?.asset?.id
    ? {
      assetId: digitalConfig.asset.id,
      filename: digitalConfig.asset.originalName ?? digitalConfig.asset.key,
      size: digitalConfig.asset.size,
      mimeType: digitalConfig.asset.mimeType,
    }
    : null;

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [removed, setRemoved] = useState(false);

  // Displayed asset: pending file takes priority, then existing server asset
  const displayAsset = pendingFile
    ? { assetId: '', filename: pendingFile.name, size: pendingFile.size, mimeType: pendingFile.type }
    : removed
      ? null
      : existingAsset;

  function handleFileSelect(file: File) {
    setPendingFile(file);
    setRemoved(false);
  }

  function handleRemove() {
    setPendingFile(null);
    setRemoved(true);
  }

  function handleContinue() {
    if (pendingFile) {
      onSaveComplete({ _pendingAssetFile: pendingFile });
    } else if (removed) {
      onSaveComplete({ _pendingAssetFile: null });
    } else {
      onSaveComplete({});
    }
  }

  const hasAsset = !!displayAsset;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Digital asset</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Upload the file customers will receive after purchase. Max 500MB.
        </p>
      </div>

      {stepError && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{stepError}</AlertDescription>
        </Alert>
      )}

      <DigitalAssetUpload
        currentAsset={displayAsset}
        onFileSelect={handleFileSelect}
        onRemove={handleRemove}
        isUploading={isSaving}
      />

      {!hasAsset && mode === 'create' && (
        <p className="text-xs text-muted-foreground">
          You must upload an asset before publishing. You can skip this step and upload later.
        </p>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button type="button" variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ChevronLeft className="w-4 h-4" />
          Back
        </Button>
        <Button onClick={handleContinue} disabled={isSaving} className="gap-1.5">
          {isSaving
            ? 'Uploading…'
            : pendingFile
              ? 'Upload & Continue'
              : mode === 'create' && !hasAsset
                ? 'Skip for now'
                : 'Continue'}
          {!isSaving && <ChevronRight className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}
