import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';

interface SubPageHeaderProps {
  /** The parent nav section, e.g. "Account". Rendered muted. */
  parent: string;
  /** The submenu actually open, e.g. "Profile". */
  current: string;
  /** One line describing *this* submenu — not the parent section. */
  description?: ReactNode;
  /** Optional leading icon block, matching the icon-led headers elsewhere. */
  icon?: ReactNode;
  className?: string;
}

/**
 * Page header for a route that lives under a nav submenu.
 *
 * Reads as a trail — "Account › Profile" — so the heading names the surface you
 * are actually on instead of only its section. Deliberately *not* links: the
 * parent has no page of its own (it redirects to its first child), so a
 * clickable crumb would either no-op or bounce you somewhere you didn't ask
 * for. It is one `h1` so screen readers announce the full path.
 */
export function SubPageHeader({
  parent,
  current,
  description,
  icon,
  className,
}: SubPageHeaderProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      {icon}
      <div className="min-w-0">
        <h1 className="flex flex-wrap items-center gap-x-1.5 text-2xl font-bold tracking-tight">
          <span className="text-muted-foreground">{parent}</span>
          <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted-foreground/60" />
          <span>{current}</span>
        </h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
    </div>
  );
}
