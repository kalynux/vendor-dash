import { Package, FileDigit } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ApiProductType } from '@/types/product.types';

interface StepTypeSelectProps {
  selectedType: ApiProductType | null;
  onSelect: (type: ApiProductType) => void;
  disabled?: boolean;
}

const PRODUCT_TYPES: {
  type: ApiProductType;
  label: string;
  description: string;
  icon: React.ElementType;
  examples: string;
}[] = [
  {
    type: 'physical',
    label: 'Physical Product',
    description: 'A tangible product that gets shipped to the customer.',
    icon: Package,
    examples: 'Clothing, electronics, furniture, accessories',
  },
  {
    type: 'digital',
    label: 'Digital Product',
    description: 'A downloadable file or software license delivered electronically.',
    icon: FileDigit,
    examples: 'Software, e-books, music, templates, courses',
  },
];

export function StepTypeSelect({ selectedType, onSelect, disabled = false }: StepTypeSelectProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Choose product type</h2>
        <p className="text-sm text-muted-foreground mt-1">
          The type determines which fields and steps are required. This cannot be changed after creation.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {PRODUCT_TYPES.map(({ type, label, description, icon: Icon, examples }) => {
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
                <p className="font-semibold text-sm">{label}</p>
                <p className="text-sm text-muted-foreground">{description}</p>
                <p className="text-xs text-muted-foreground/70 mt-2">{examples}</p>
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
