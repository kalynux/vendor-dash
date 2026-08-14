import { forwardRef } from 'react';
import { toggleVariants } from '@/components/ui/toggle';
import { cn } from '@/lib/utils';

interface ToolbarButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name, also shown as the native tooltip. */
  label: string;
  /** Renders the pressed state and sets `aria-pressed`. */
  active?: boolean;
}

/**
 * One toolbar control.
 *
 * A native `<button>` carrying the house `toggleVariants` styling rather than
 * the Radix `Toggle` primitive. Two reasons, both about the selection:
 *
 * - `onMouseDown` must be prevented, always. Clicking a toolbar button would
 *   otherwise move focus out of the `contenteditable` and collapse the
 *   selection, so "select a word, click B" would bold nothing.
 * - The pressed state is not this component's to own. It is read from the
 *   document (`queryCommandState`) on every selection change, so a controlled
 *   `aria-pressed` is the honest representation and a Radix toggle's internal
 *   state would only ever be fighting it.
 */
export const ToolbarButton = forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  ({ label, active, className, children, onMouseDown, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      data-state={active ? 'on' : 'off'}
      onMouseDown={(event) => {
        event.preventDefault();
        onMouseDown?.(event);
      }}
      className={cn(
        toggleVariants({ size: 'sm' }),
        // 36px hit target on touch, tighter on pointer devices where the toolbar
        // has to fit alongside a preview.
        'h-9 min-w-9 sm:h-8 sm:min-w-8',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
);

ToolbarButton.displayName = 'ToolbarButton';
