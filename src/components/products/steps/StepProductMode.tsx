import { Zap, Package, FileDigit } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useTranslation, type TranslationKey } from '@/i18n';

/**
 * What the vendor picked on step 0. 'simple' hands off to the one-shot quick-add
 * editor; the other two continue into the standard wizard as the product type.
 */
export type ProductCreationChoice = 'simple' | 'physical' | 'digital';

interface StepProductModeProps {
  onSelect: (choice: ProductCreationChoice) => void;
  disabled?: boolean;
}

const CHOICES: {
  choice: ProductCreationChoice;
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
  icon: React.ElementType;
  examplesKey: TranslationKey;
  recommended?: boolean;
}[] = [
  {
    choice: 'simple',
    labelKey: 'products.mode.simple',
    descriptionKey: 'products.mode.simpleDescription',
    icon: Zap,
    examplesKey: 'products.mode.simpleExamples',
    recommended: true,
  },
  {
    choice: 'physical',
    labelKey: 'products.mode.physical',
    descriptionKey: 'products.mode.physicalDescription',
    icon: Package,
    examplesKey: 'products.mode.physicalExamples',
  },
  {
    choice: 'digital',
    labelKey: 'products.mode.digital',
    descriptionKey: 'products.mode.digitalDescription',
    icon: FileDigit,
    examplesKey: 'products.mode.digitalExamples',
  },
];

export function StepProductMode({ onSelect, disabled = false }: StepProductModeProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{t('products.mode.title')}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t('products.mode.description')}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {CHOICES.map(({ choice, labelKey, descriptionKey, icon: Icon, examplesKey, recommended }) => (
          <button
            key={choice}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(choice)}
            className={cn(
              'flex flex-col gap-4 p-5 rounded-xl border-2 text-left transition-all',
              recommended
                ? 'border-primary/40 hover:border-primary hover:bg-primary/5'
                : 'border-border hover:border-primary/40 hover:bg-muted/40',
              disabled && 'opacity-50 cursor-not-allowed',
            )}
          >
            <div
              className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center',
                recommended
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              <Icon className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-sm">{t(labelKey)}</p>
                {recommended && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {t('products.mode.recommended')}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{t(descriptionKey)}</p>
              <p className="text-xs text-muted-foreground/70 mt-2">{t(examplesKey)}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
