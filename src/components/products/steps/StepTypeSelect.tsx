import { cn } from '@/lib/utils';
import { SettingsSection, SettingsSections } from '@/components/vendor-settings/SettingsSection';
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
}[] = [
  {
    type: 'physical',
    labelKey: 'products.typeSelect.physical',
    descriptionKey: 'products.typeSelect.physicalDescription',
  },
  {
    type: 'digital',
    labelKey: 'products.typeSelect.digital',
    descriptionKey: 'products.typeSelect.digitalDescription',
  },
];

/** A plain radio list: title and one line per type, the chosen one marked. */
export function StepTypeSelect({ selectedType, onSelect, disabled = false }: StepTypeSelectProps) {
  const { t } = useTranslation();
  return (
    <SettingsSections>
      <SettingsSection
        title={t('products.typeSelect.title')}
        info={t('products.typeSelect.description')}
      >
        <ul role="radiogroup" className="-my-3 divide-y divide-border">
          {PRODUCT_TYPES.map(({ type, labelKey, descriptionKey }) => {
            const isSelected = selectedType === type;
            return (
              <li key={type}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  disabled={disabled}
                  onClick={() => onSelect(type)}
                  className={cn(
                    'flex w-full items-center gap-3 py-4 text-left',
                    'rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    'disabled:cursor-not-allowed',
                    // A locked choice still has to show which one it is, so only
                    // the rows that were NOT chosen fade.
                    disabled && !isSelected && 'opacity-50',
                  )}
                >
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="block font-medium">{t(labelKey)}</span>
                    <span className="block text-sm text-muted-foreground">
                      {t(descriptionKey)}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      'flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                      isSelected ? 'border-primary' : 'border-border',
                    )}
                  >
                    {isSelected && <span className="size-2.5 rounded-full bg-primary" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </SettingsSection>
    </SettingsSections>
  );
}
