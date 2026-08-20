import { Info } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * The one line that replaces a purchase action on a packaged app
 * (CAPACITOR-PLAN.md → P5.3).
 *
 * An action that silently vanishes reads as a bug — the vendor knows the button
 * was there last week and concludes the app is broken, which costs a support
 * ticket and some trust. So every place `purchasesEnabled` removes something
 * says what happened and where to go instead.
 *
 * The message is a prop rather than a key so each surface can be specific about
 * *which* action went (a plan change, a top-up, a card) without this component
 * knowing anything about the billing catalog.
 *
 * Never rendered in a browser: every call site is behind `purchasesEnabled`,
 * which is `true` there.
 */
export function PurchasesUnavailable({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  return (
    <p
      className={cn(
        'flex items-start gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground',
        className,
      )}
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </p>
  );
}
