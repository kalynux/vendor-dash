import { Link, useLocation } from 'react-router-dom';
import { Store } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { usePendingClosureRequest } from '@/lib/pending-closure-request';
import { cn } from '@/lib/utils';
import { useFormatters, useTranslation } from '@/i18n';

const CLOSURE_ROUTE = '/dashboard/account/closure';

/**
 * "An administrator asked to close your shop" — on every dashboard screen while
 * a request is waiting (ADR-A10). The request runs out after 7 days and the
 * notice can be missed, so it stays visible until the vendor answers. Hidden on
 * the closure screen itself, which says the same thing at length.
 */
export function ClosureRequestBanner({ className }: { className?: string }) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const { pathname } = useLocation();
  const request = usePendingClosureRequest();

  if (!request || pathname === CLOSURE_ROUTE) return null;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200',
        className,
      )}
    >
      <Store className="size-4 shrink-0" />
      <p className="min-w-0 flex-1">
        {t('account.closure.banner.text', { date: fmt.date(request.expiresAt) })}
      </p>
      <Button asChild size="sm" variant="outline" className="h-8 bg-background">
        <Link to={CLOSURE_ROUTE}>{t('account.closure.banner.action')}</Link>
      </Button>
    </div>
  );
}
