import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { RefreshButton } from '@/components/common/RefreshButton';
import { MobilePageHeader, type MobileHeaderAction } from '@/components/layout/MobilePageHeader';
import { useIsMobile } from '@/hooks/use-mobile';

/**
 * The frame of the provider's two list pages (Listings, Leads).
 *
 * Phone first: the shared sticky header with the refresh icon left of the
 * title, actions in the header, and the content flush to a 16px gutter with no
 * card around it. From `md` the same content sits under a plain title row and
 * gains its card edge (`ProviderList` below).
 */
export function ProviderPage({
  title,
  description,
  onRefresh,
  actions = [],
  children,
}: {
  title: string;
  description: string;
  onRefresh?: () => unknown;
  actions?: MobileHeaderAction[];
  children: ReactNode;
}) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="-mx-6 -mt-6 animate-fade-in">
        <MobilePageHeader title={title} description={description} onRefresh={onRefresh} actions={actions} />
        <div className="space-y-4 px-4 pb-24 pt-4">{children}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {onRefresh && <RefreshButton onRefresh={onRefresh} />}
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        {actions.length > 0 && (
          <div className="flex shrink-0 items-center gap-2">
            {actions.map((a) => (
              <Button key={a.id} onClick={a.onClick} disabled={a.disabled || a.busy} className="gap-1.5">
                <a.icon className="h-4 w-4" />
                {a.label}
              </Button>
            ))}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

/** Rows separated by hairlines; a card only from `md` up. Never a box on a phone. */
export function ProviderList({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-4 divide-y border-y md:mx-0 md:overflow-hidden md:rounded-xl md:border md:bg-card">
      {children}
    </div>
  );
}

/** An empty or failed list: one sentence, at most one way forward. */
export function ProviderEmpty({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <p className="font-medium">{title}</p>
      {body && <p className="max-w-sm text-sm text-muted-foreground">{body}</p>}
      {action && <div className="mt-3 w-full max-w-xs md:w-auto">{action}</div>}
    </div>
  );
}
