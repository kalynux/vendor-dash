import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * A table row, as a card.
 *
 * ── Why a shared shape rather than bespoke markup per table ──────────────────
 *
 * A table teaches its columns once, in a header, and every row after that is
 * read positionally. Drop the header — which is what happens on a phone, where
 * five columns cannot fit — and each row has to re-teach itself. So each row
 * becomes a card that names its own values, and the *only* thing that keeps a
 * screen of those readable is that they all name them the same way: same label
 * type, same alignment, same order of prominence.
 *
 * Doing that per table is how three tables end up with three conventions. Hence
 * one component, and call sites that supply data rather than layout.
 *
 * The card is deliberately not a `<table>` with `display: block` rows. That
 * keeps a table's semantics for a thing that no longer looks or behaves like
 * one, and a screen reader announcing "row 4 of 20, column 3" for a card is
 * worse than the list it actually is.
 */

/** The list the cards sit in. Hairline-separated, matching the settings pages. */
export function DataCardList({
  className,
  children,
  ...props
}: React.ComponentProps<'ul'>) {
  return (
    <ul className={cn('divide-y', className)} {...props}>
      {children}
    </ul>
  );
}

export interface DataCardField {
  label: ReactNode;
  value: ReactNode;
}

export function DataCard({
  title,
  subtitle,
  /** Top-right — a status pill, a badge, an amount. */
  trailing,
  /**
   * The columns that were not the title. Rendered as label-over-value pairs so
   * each number carries its own header, which is the thing the table header was
   * doing.
   */
  fields,
  /** Free-form row under the fields — a progress bar, an inline warning. */
  footer,
  /**
   * Makes the whole card the tap target. Anything a row could do from a menu
   * should open from here instead: on a phone the card is a comfortable target
   * and a 32px kebab is not.
   */
  onClick,
  /** Accessible name for the tap target. Required when `onClick` is set. */
  actionLabel,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  fields?: DataCardField[];
  footer?: ReactNode;
  onClick?: () => void;
  actionLabel?: string;
  className?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{title}</div>
          {subtitle && (
            <div className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</div>
          )}
        </div>
        {trailing && <div className="shrink-0">{trailing}</div>}
        {onClick && (
          <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
      </div>

      {fields && fields.length > 0 && (
        // Two columns, because three is where a label starts wrapping on the
        // narrowest phone this app supports.
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
          {fields.map((f, i) => (
            <div key={i} className="min-w-0">
              <dt className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">
                {f.label}
              </dt>
              <dd className="mt-0.5 truncate text-sm tabular-nums">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {footer && <div className="mt-3">{footer}</div>}
    </>
  );

  return (
    <li className={cn('p-4', className)}>
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          aria-label={actionLabel}
          className="-m-2 block w-full rounded-lg p-2 text-left transition-colors active:bg-accent/50"
        >
          {body}
        </button>
      ) : (
        body
      )}
    </li>
  );
}
