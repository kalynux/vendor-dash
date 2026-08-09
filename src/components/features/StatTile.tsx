import type { ReactNode } from 'react';
import { type LucideIcon } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatTileProps {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  /** Chip background + icon colour. Defaults to the primary accent. */
  accentClassName?: string;
  className?: string;
}

/**
 * Compact KPI tile for the summary row above a list surface (Inventory,
 * Notifications, …). These are glanceable context rather than the page's
 * content, so the tile stays deliberately low-profile — roughly 58px tall
 * instead of the ~100px a `p-6` card costs — and the label is demoted to
 * `text-xs` so the number still leads the hierarchy.
 *
 * The padding is `px-3 py-2.5`: tight enough that three of these never push the
 * list itself below the fold, which is the whole point of a summary row.
 */
export function StatTile({ label, value, icon: Icon, accentClassName, className }: StatTileProps) {
  return (
    <Card className={className}>
      <CardContent className="flex items-center justify-between gap-2.5 px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-0.5 text-lg font-semibold leading-tight tabular-nums">{value}</p>
        </div>
        <div
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
            accentClassName ?? 'bg-primary/10 text-primary',
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      </CardContent>
    </Card>
  );
}
