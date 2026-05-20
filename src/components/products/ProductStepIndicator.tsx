import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StepDefinition {
  id: string;
  label: string;
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
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-hide">
      {steps.map((step, index) => {
        const isActive = step.id === currentStep;
        const isCompleted = completedSteps.includes(step.id);
        const isClickable = isCompleted && !!onStepClick;
        const Icon = step.icon;

        return (
          <div key={step.id} className="flex items-center shrink-0">
            <button
              onClick={() => isClickable && onStepClick(step.id)}
              disabled={!isClickable && !isActive}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
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
              <span className="hidden sm:inline">{step.label}</span>
            </button>

            {index < steps.length - 1 && (
              <div
                className={cn(
                  'w-6 h-px mx-1 shrink-0',
                  isCompleted ? 'bg-primary' : 'bg-border',
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
