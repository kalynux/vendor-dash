import { useState } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ProductMediaUpload } from '@/components/products/ProductMediaUpload';
import { useTranslation } from '@/i18n';
import { SERVICE_IMAGE_LIMIT } from '@/components/services/service.constants';
import type { ApiFileDetail } from '@/types/product.types';

interface StepServiceImagesProps {
  mode?: 'create' | 'edit';
  existingFiles: ApiFileDetail[];
  isSaving: boolean;
  stepError: string | null;
  /** Persists the ordered file ids and advances. */
  onSaveComplete: (fileIds: string[]) => void;
  onBack: () => void;
}

export function StepServiceImages({
  mode = 'create',
  existingFiles,
  isSaving,
  stepError,
  onSaveComplete,
  onBack,
}: StepServiceImagesProps) {
  const { t } = useTranslation();
  const [orderedIds, setOrderedIds] = useState<string[]>([]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{t('services.images.title')}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t('services.images.description', { limit: SERVICE_IMAGE_LIMIT })}
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
        maxFiles={SERVICE_IMAGE_LIMIT}
      />

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button type="button" variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ChevronLeft className="w-4 h-4" />
          {t('common.actions.back')}
        </Button>
        <Button onClick={() => onSaveComplete(orderedIds)} disabled={isSaving} className="gap-1.5">
          {isSaving
            ? t('common.actions.saving')
            : orderedIds.length > 0
              ? t('services.wizard.saveAndContinue')
              : mode === 'create'
                ? t('services.wizard.skipForNow')
                : t('common.actions.continue')}
          {!isSaving && <ChevronRight className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}
