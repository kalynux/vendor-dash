import { Zap, Package, FileDigit } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

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
  label: string;
  description: string;
  icon: React.ElementType;
  examples: string;
  recommended?: boolean;
}[] = [
  {
    choice: 'simple',
    label: 'Quick add',
    description: 'One page, one price, one stock count. Publishes as soon as it is ready.',
    icon: Zap,
    examples: 'A single pair of shoes, one book, one bag',
    recommended: true,
  },
  {
    choice: 'physical',
    label: 'Physical with variants',
    description: 'Sizes, colours and per-variant stock, images and pricing.',
    icon: Package,
    examples: 'A t-shirt in 4 sizes × 3 colours',
  },
  {
    choice: 'digital',
    label: 'Digital product',
    description: 'Downloadable files with per-format pricing and download limits.',
    icon: FileDigit,
    examples: 'Software, e-books, music, templates, courses',
  },
];

export function StepProductMode({ onSelect, disabled = false }: StepProductModeProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">What are you adding?</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Quick add covers most products. Pick one of the others if you need variants or
          downloadable files — this cannot be changed after creation.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {CHOICES.map(({ choice, label, description, icon: Icon, examples, recommended }) => (
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
                <p className="font-semibold text-sm">{label}</p>
                {recommended && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    Recommended
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{description}</p>
              <p className="text-xs text-muted-foreground/70 mt-2">{examples}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
