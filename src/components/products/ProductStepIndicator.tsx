import { Fragment } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslation, type TranslationKey } from '@/i18n';

interface StepDefinition {
  id: string;
  labelKey: TranslationKey;
  /** No longer drawn — the steps are numbered. Still accepted so existing step lists type-check. */
  icon?: React.ElementType;
}

interface ProductStepIndicatorProps {
  steps: StepDefinition[];
  currentStep: string;
  completedSteps: string[];
  onStepClick?: (stepId: string) => void;
}

/**
 * Where the vendor is in a create / edit wizard.
 *
 * On a phone it is one quiet line — "Step 2 of 5 · Basic info" — over a thin
 * progress bar. The full five-up stepper used to squeeze into 358px with 10px
 * labels and cost a whole card at the top of every step. When there is somewhere
 * to jump to (a step already done, or every step in edit mode) the line opens a
 * menu of the steps, so nothing the old stepper could do is lost.
 *
 * From `md` up there is room for the stepper itself: numbered, plain, no card.
 *
 * A step is reachable exactly when it is completed — the same rule the old
 * buttons had, so the wizards behave as before.
 */
export function ProductStepIndicator({
  steps,
  currentStep,
  completedSteps,
  onStepClick,
}: ProductStepIndicatorProps) {
  const { t } = useTranslation();

  const currentIndex = Math.max(
    0,
    steps.findIndex((s) => s.id === currentStep),
  );
  const current = steps[currentIndex];
  const canJump =
    !!onStepClick && steps.some((s) => s.id !== currentStep && completedSteps.includes(s.id));
  const progress = steps.length > 0 ? ((currentIndex + 1) / steps.length) * 100 : 0;

  const summary = (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="shrink-0 text-muted-foreground">
        {t('onboarding.stepLabel', { current: currentIndex + 1, total: steps.length })}
      </span>
      <span aria-hidden className="text-muted-foreground">
        ·
      </span>
      <span className="truncate font-medium text-foreground">
        {current ? t(current.labelKey) : null}
      </span>
    </span>
  );

  return (
    <div>
      {/* ── Phones: one line + a progress bar ─────────────────────────────── */}
      <div className="md:hidden">
        {canJump ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="tap-target flex w-full items-center justify-between gap-2 rounded-sm text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-4 focus-visible:ring-offset-background"
              >
                {summary}
                <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {steps.map((step, index) => {
                const isActive = step.id === currentStep;
                const isCompleted = completedSteps.includes(step.id);
                return (
                  <DropdownMenuItem
                    key={step.id}
                    disabled={!isCompleted && !isActive}
                    onSelect={() => {
                      if (isCompleted) onStepClick?.(step.id);
                    }}
                    className={cn(isActive && 'bg-accent/60')}
                  >
                    <span className="w-5 shrink-0 tabular-nums text-muted-foreground">
                      {index + 1}
                    </span>
                    <span className={cn('flex-1', isActive && 'font-medium')}>
                      {t(step.labelKey)}
                    </span>
                    {isCompleted && !isActive && (
                      <Check className="size-4 shrink-0 text-primary" aria-hidden />
                    )}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <p className="text-sm">{summary}</p>
        )}
        <div
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-valuenow={currentIndex + 1}
          className="mt-3 h-1 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* ── md and up: the numbered stepper ───────────────────────────────── */}
      {/* `-mx-1.5` takes back the buttons' own padding, so the first circle lines
          up with the content edge below it. */}
      <ol className="hidden items-center md:-mx-1.5 md:flex">
        {steps.map((step, index) => {
          const isActive = step.id === currentStep;
          const isCompleted = completedSteps.includes(step.id);
          const isClickable = isCompleted && !!onStepClick;

          return (
            <Fragment key={step.id}>
              <li className="shrink-0">
                <button
                  type="button"
                  onClick={() => isClickable && onStepClick(step.id)}
                  disabled={!isClickable && !isActive}
                  aria-current={isActive ? 'step' : undefined}
                  className={cn(
                    'flex items-center gap-2 whitespace-nowrap rounded-md px-1.5 py-1 text-sm transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isActive && 'font-medium text-foreground',
                    isCompleted && !isActive && 'text-foreground hover:bg-muted',
                    !isActive && !isCompleted && 'text-muted-foreground',
                    isClickable ? 'cursor-pointer' : 'cursor-default',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium tabular-nums',
                      isActive && 'bg-primary text-primary-foreground',
                      isCompleted && !isActive && 'bg-primary/10 text-primary',
                      !isActive && !isCompleted && 'border border-border',
                    )}
                  >
                    {isCompleted && !isActive ? <Check className="size-3.5" /> : index + 1}
                  </span>
                  {t(step.labelKey)}
                </button>
              </li>

              {index < steps.length - 1 && (
                <li
                  aria-hidden
                  className={cn(
                    'mx-2 h-px min-w-4 flex-1',
                    isCompleted ? 'bg-primary/40' : 'bg-border',
                  )}
                />
              )}
            </Fragment>
          );
        })}
      </ol>
    </div>
  );
}
