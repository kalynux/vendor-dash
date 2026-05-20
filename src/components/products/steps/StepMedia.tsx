import { useState } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ProductMediaUpload, type MediaOrderItem } from '@/components/products/ProductMediaUpload';
import type { WizardState } from '@/types/product.types';

interface StepMediaProps {
  mode: 'create' | 'edit';
  serverData: Partial<WizardState>;
  isSaving: boolean;
  stepError: string | null;
  onSaveComplete: (updates: Partial<WizardState> & { _mediaOrder?: MediaOrderItem[] }) => void;
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

  const [orderedItems, setOrderedItems] = useState<MediaOrderItem[]>([]);

  const newFileCount = orderedItems.filter((i) => i.kind === 'new').length;

  function handleContinue() {
    onSaveComplete({ _mediaOrder: orderedItems });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Product images</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Add up to 10 images. The first image will be used as the product thumbnail.
          Drag cards to reorder. Saved images can be removed or repositioned.
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
        onMediaChange={setOrderedItems}
        isUploading={isSaving}
        maxFiles={10}
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
            : newFileCount > 0
              ? `Upload ${newFileCount} image${newFileCount !== 1 ? 's' : ''} & Continue`
              : mode === 'create'
                ? 'Skip for now'
                : 'Continue'}
          {!isSaving && <ChevronRight className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}
