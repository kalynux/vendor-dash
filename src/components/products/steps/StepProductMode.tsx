import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SettingsSection, SettingsSections } from '@/components/vendor-settings/SettingsSection';
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
  recommended?: boolean;
}[] = [
  {
    choice: 'simple',
    labelKey: 'products.mode.simple',
    descriptionKey: 'products.mode.simpleDescription',
    recommended: true,
  },
  {
    choice: 'physical',
    labelKey: 'products.mode.physical',
    descriptionKey: 'products.mode.physicalDescription',
  },
  {
    choice: 'digital',
    labelKey: 'products.mode.digital',
    descriptionKey: 'products.mode.digitalDescription',
  },
];

/**
 * Step 0 — a plain list of three rows. Picking one moves on straight away, so
 * the rows carry a chevron rather than a selected state.
 */
export function StepProductMode({ onSelect, disabled = false }: StepProductModeProps) {
  const { t } = useTranslation();
  return (
    <SettingsSections>
      <SettingsSection title={t('products.mode.title')} info={t('products.mode.description')}>
        <ul className="-my-3 divide-y divide-border">
          {CHOICES.map(({ choice, labelKey, descriptionKey, recommended }) => (
            <li key={choice}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onSelect(choice)}
                className={cn(
                  'group flex w-full items-center gap-3 py-4 text-left',
                  'rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                )}
              >
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-medium group-hover:text-primary">{t(labelKey)}</span>
                    {recommended && (
                      <span className="text-xs font-medium text-primary">
                        {t('products.mode.recommended')}
                      </span>
                    )}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {t(descriptionKey)}
                  </span>
                </span>
                <ChevronRight
                  className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </button>
            </li>
          ))}
        </ul>
      </SettingsSection>
    </SettingsSections>
  );
}
