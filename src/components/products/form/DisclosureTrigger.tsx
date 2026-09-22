import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

import { CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

/**
 * A full-width text row that opens a `Collapsible` — "More options" and the like.
 * Deliberately not a button-looking button: an outlined control with a gear on it
 * reads as an action, when all this does is show a few more fields.
 */
export function DisclosureTrigger({
  open,
  children,
  className,
}: {
  open: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <CollapsibleTrigger asChild>
      <button
        type="button"
        className={cn(
          'flex min-h-11 w-full items-center justify-between gap-3 text-left text-sm font-medium',
          'rounded-sm transition-colors hover:text-foreground/80',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          className,
        )}
      >
        <span className="min-w-0">{children}</span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>
    </CollapsibleTrigger>
  );
}
