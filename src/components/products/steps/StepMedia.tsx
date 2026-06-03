import { useState } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ProductMediaUpload } from '@/components/products/ProductMediaUpload';
import { PRODUCT_IMAGE_LIMIT } from '@/components/products/media.constants';
import type { WizardState } from '@/types/product.types';

interface StepMediaProps {
  mode: 'create' | 'edit';
  serverData: Partial<WizardState>;
  isSaving: boolean;
  stepError: string | null;
  onSaveComplete: (updates: Partial<WizardState> & { _mediaFileIds?: string[] }) => void;
  onBack: () => void;
}

export function StepMedia({
  mode,
  serverData,
  isSaving,
  stepError,
  onSaveComplete,
  onBack,
}: StepMediaProps) {
  const existingFiles =
    serverData.serverProduct && 'files' in serverData.serverProduct
      ? serverData.serverProduct.files
      : [];

  const maxFiles = PRODUCT_IMAGE_LIMIT[serverData.productType ?? 'physical'];

  const [orderedIds, setOrderedIds] = useState<string[]>([]);

  function handleContinue() {
    onSaveComplete({ _mediaFileIds: orderedIds });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Product images</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {maxFiles === 1
            ? 'Add a cover image for this product.'
            : `Add up to ${maxFiles} images. The first image will be used as the product thumbnail. Drag cards to reorder.`}{' '}
          Images come from your media library — upload new ones right inside the picker.
        </p>
      </div>

      {stepError && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{stepError}</AlertDescription>
        </Alert>
      )}

      <ProductMediaUpload
        existingFiles={existingFiles}
        onMediaChange={setOrderedIds}
        isUploading={isSaving}
        maxFiles={maxFiles}
      />

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button type="button" variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ChevronLeft className="w-4 h-4" />
          Back
        </Button>
        <Button onClick={handleContinue} disabled={isSaving} className="gap-1.5">
          {isSaving
            ? 'Saving…'
            : orderedIds.length > 0
              ? 'Save & Continue'
              : mode === 'create'
                ? 'Skip for now'
                : 'Continue'}
          {!isSaving && <ChevronRight className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}
