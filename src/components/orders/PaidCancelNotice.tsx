import type { ReactNode } from 'react';

/**
 * The warning inside the cancel dialogs when the order is already paid.
 *
 * Cancelling a paid order does NOT refund the customer: since 2026-10-05 the
 * server pauses the vendor's earnings for it and opens a refund ticket for our
 * team (FRONTEND-CHANGELOG-earnings-hold-and-pauses § 3). The vendor has to
 * read that before they type the confirm word.
 */
export function PaidCancelNotice({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
      {children}
    </p>
  );
}
