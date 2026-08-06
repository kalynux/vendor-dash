import { cn } from '@/lib/utils';
import { useTranslation, type TranslationKey } from '@/i18n';

export type PlatformHealth = 'online' | 'degraded' | 'offline';

/**
 * Platform health signal for the sidebar footer.
 *
 * STUB: always reports "online" for now. Swap the body for a real source later
 * (e.g. `navigator.onLine` + an API health ping) — this is the single seam.
 */
function usePlatformStatus(): PlatformHealth {
  // TODO: wire a real health source (navigator.onLine / periodic /health ping).
  return 'online';
}

const STATUS_META: Record<
  PlatformHealth,
  { dot: string; labelKey: TranslationKey }
> = {
  online: { dot: 'bg-emerald-500', labelKey: 'nav.platformStatus.online' },
  degraded: { dot: 'bg-amber-500', labelKey: 'nav.platformStatus.degraded' },
  offline: { dot: 'bg-red-500', labelKey: 'nav.platformStatus.offline' },
};

interface PlatformStatusProps {
  /** Hide the text label (collapsed sidebar) and show only the dot. */
  compact?: boolean;
  className?: string;
}

export function PlatformStatus({ compact, className }: PlatformStatusProps) {
  const { t } = useTranslation();
  const status = usePlatformStatus();
  const meta = STATUS_META[status];
  const label = t(meta.labelKey);

  return (
    <div
      className={cn('flex items-center gap-2', compact && 'justify-center', className)}
      title={label}
    >
      <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
        {status === 'online' && (
          <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-60', meta.dot)} />
        )}
        <span className={cn('relative inline-flex h-2.5 w-2.5 rounded-full', meta.dot)} />
      </span>
      {!compact && (
        <span className="truncate text-xs text-muted-foreground">{label}</span>
      )}
    </div>
  );
}
