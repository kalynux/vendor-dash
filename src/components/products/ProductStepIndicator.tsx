import { Fragment } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation, type TranslationKey } from '@/i18n';

interface StepDefinition {
  id: string;
  labelKey: TranslationKey;
  icon: React.ElementType;
}

interface ProductStepIndicatorProps {
  steps: StepDefinition[];
  currentStep: string;
  completedSteps: string[];
  onStepClick?: (stepId: string) => void;
}

export function ProductStepIndicator({
  steps,
  currentStep,
  completedSteps,
  onStepClick,
}: ProductStepIndicatorProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-start justify-between sm:items-center sm:justify-start w-full gap-1 overflow-x-auto pb-1 scrollbar-hide">
      {steps.map((step, index) => {
        const isActive = step.id === currentStep;
        const isCompleted = completedSteps.includes(step.id);
        const isClickable = isCompleted && !!onStepClick;
        const Icon = step.icon;

        return (
          <Fragment key={step.id}>
            <button
              onClick={() => isClickable && onStepClick(step.id)}
              disabled={!isClickable && !isActive}
              className={cn(
                'flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-1 py-1.5 sm:px-3 sm:py-2 rounded-lg text-[10px] sm:text-sm font-medium transition-all whitespace-normal sm:whitespace-nowrap shrink-0',
                isActive && 'bg-primary text-primary-foreground shadow-sm',
                isCompleted && !isActive && 'text-primary hover:bg-primary/10',
                !isActive && !isCompleted && 'text-muted-foreground',
                isClickable && 'cursor-pointer',
                !isClickable && !isActive && 'cursor-default',
              )}
            >
              <div
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0',
                  isActive && 'bg-primary-foreground text-primary',
                  isCompleted && !isActive && 'bg-primary text-primary-foreground',
                  !isActive && !isCompleted && 'bg-muted text-muted-foreground',
                )}
              >
                {isCompleted && !isActive ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Icon className={cn('w-3.5 h-3.5', isActive && 'text-primary')} />
                )}
              </div>
              <span className="block sm:inline text-center sm:text-left leading-tight">{t(step.labelKey)}</span>
            </button>

            {index < steps.length - 1 && (
              <div
                className={cn(
                  'flex-1 sm:flex-none sm:w-6 h-px mx-1 shrink-0 mt-[18px] sm:mt-0',
                  isCompleted ? 'bg-primary' : 'bg-border',
                )}
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

