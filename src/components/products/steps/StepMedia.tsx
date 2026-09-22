import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SettingsSection, SettingsSections } from '@/components/vendor-settings/SettingsSection';
import { ProductMediaUpload } from '@/components/products/ProductMediaUpload';
import { PRODUCT_IMAGE_LIMIT } from '@/components/products/media.constants';
import { useTranslation } from '@/i18n';
import type { WizardState } from '@/types/product.types';
import { StepActions, StepError } from './StepLayout';

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
  const { t } = useTranslation();
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
    <div>
      <StepError error={stepError} />

      <SettingsSections>
        {/* No visible description: the empty photo control already says how
            many images and which one is the thumbnail, and a second copy of that
            sentence right above it was the "too much to read" this page is
            rid of. The drag-to-reorder and library notes live in the info icon. */}
        <SettingsSection
          title={t('products.media.title')}
          info={
            <>
              <span className="block">
                {maxFiles === 1
                  ? t('products.media.stepDescriptionSingle')
                  : t('products.fields.photosHint', { max: maxFiles })}
              </span>
              <span className="mt-2 block">{t('products.media.stepLibraryNote')}</span>
            </>
          }
        >
          <ProductMediaUpload
            existingFiles={existingFiles}
            onMediaChange={setOrderedIds}
            isUploading={isSaving}
            maxFiles={maxFiles}
          />
        </SettingsSection>
      </SettingsSections>

      <StepActions onBack={onBack}>
        <Button type="button" onClick={handleContinue} disabled={isSaving} className="gap-1.5">
          {isSaving
            ? t('common.actions.saving')
            : orderedIds.length > 0
              ? t('products.wizard.saveAndContinue')
              : t(mode === 'create' ? 'products.media.skipForNow' : 'common.actions.continue')}
          {!isSaving && <ChevronRight className="size-4" />}
        </Button>
      </StepActions>
    </div>
  );
}
