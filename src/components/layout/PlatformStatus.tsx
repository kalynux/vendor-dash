import { cn } from '@/lib/utils';
import { useTranslation, type TranslationKey } from '@/i18n';
import { useIsOnline } from '@/platform/network';

export type PlatformHealth = 'online' | 'degraded' | 'offline';

/**
 * Platform health signal for the sidebar footer and the mobile "More" drawer.
 *
 * Sourced from the device's connectivity (CAPACITOR-PLAN.md → P3.4): the OS's
 * own network state on a device, `navigator.onLine` in a browser. It used to
 * return a hardcoded `'online'`, which is the worst possible answer — a green
 * "All systems operational" dot on a phone in airplane mode. That was a bug on
 * the web too, which is why this fix ships to both builds.
 *
 * `'degraded'` is still unreachable. It is kept because it is the honest label
 * for "connected, but the API is not answering", and nothing here measures that
 * yet — that needs a health ping, which is its own decision about how often to
 * spend a request saying nothing is wrong. Adding the state to the union costs
 * nothing; guessing at it would cost trust.
 */
function usePlatformStatus(): PlatformHealth {
  return useIsOnline() ? 'online' : 'offline';
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
