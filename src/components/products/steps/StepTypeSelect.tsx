import { Package, FileDigit } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation, type TranslationKey } from '@/i18n';
import type { ApiProductType } from '@/types/product.types';

interface StepTypeSelectProps {
  selectedType: ApiProductType | null;
  onSelect: (type: ApiProductType) => void;
  disabled?: boolean;
}

const PRODUCT_TYPES: {
  type: ApiProductType;
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
  icon: React.ElementType;
  examplesKey: TranslationKey;
}[] = [
  {
    type: 'physical',
    labelKey: 'products.typeSelect.physical',
    descriptionKey: 'products.typeSelect.physicalDescription',
    icon: Package,
    examplesKey: 'products.typeSelect.physicalExamples',
  },
  {
    type: 'digital',
    labelKey: 'products.typeSelect.digital',
    descriptionKey: 'products.typeSelect.digitalDescription',
    icon: FileDigit,
    examplesKey: 'products.typeSelect.digitalExamples',
  },
];

export function StepTypeSelect({ selectedType, onSelect, disabled = false }: StepTypeSelectProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{t('products.typeSelect.title')}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t('products.typeSelect.description')}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {PRODUCT_TYPES.map(({ type, labelKey, descriptionKey, icon: Icon, examplesKey }) => {
          const isSelected = selectedType === type;
          return (
            <button
              key={type}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(type)}
              className={cn(
                'flex flex-col gap-4 p-5 rounded-xl border-2 text-left transition-all',
                isSelected
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border hover:border-primary/40 hover:bg-muted/40',
                disabled && 'opacity-50 cursor-not-allowed',
              )}
            >
              <div
                className={cn(
                  'w-12 h-12 rounded-xl flex items-center justify-center',
                  isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                )}
              >
                <Icon className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-sm">{t(labelKey)}</p>
                <p className="text-sm text-muted-foreground">{t(descriptionKey)}</p>
                <p className="text-xs text-muted-foreground/70 mt-2">{t(examplesKey)}</p>
              </div>
              <div
                className={cn(
                  'mt-auto w-4 h-4 rounded-full border-2 self-end transition-colors',
                  isSelected ? 'border-primary bg-primary' : 'border-border',
                )}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
