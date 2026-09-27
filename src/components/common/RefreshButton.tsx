import { useRef, useState } from 'react';
import { RotateCw } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { apiErrorMessage, useTranslation } from '@/i18n';

/**
 * Keeps the icon turning at least this long. A refresh that comes back in 80ms
 * would otherwise flick the spinner on and off too fast to see, and the vendor
 * is left wondering whether the tap did anything.
 */
const MIN_SPIN_MS = 600;

interface RefreshButtonProps {
  /**
   * Re-pulls the page's data. Return the promise when there is one, so the icon
   * spins for as long as the work actually takes; a rejection is shown as a
   * toast. Pages that refresh by bumping a token return nothing and get the
   * minimum spin.
   */
  onRefresh: () => unknown;
  className?: string;
}

/**
 * The "reload this page" icon that sits left of the title on pages whose data
 * changes while the vendor is looking at it — orders coming in, stock moving,
 * an agency answering a request.
 *
 * It refreshes in place: pages wire it to a quiet refetch that swaps the rows
 * without a skeleton, so the list doesn't blank and jump under the thumb.
 */
export function RefreshButton({ onRefresh, className }: RefreshButtonProps) {
  const { t } = useTranslation();
  const [spinning, setSpinning] = useState(false);
  // A ref, not the state: two taps in the same frame both read `spinning` as false.
  const running = useRef(false);

  const handleClick = async () => {
    if (running.current) return;
    running.current = true;
    setSpinning(true);
    const minSpin = new Promise((resolve) => setTimeout(resolve, MIN_SPIN_MS));
    try {
      await Promise.all([onRefresh(), minSpin]);
    } catch (err) {
      toast.error(apiErrorMessage(err, { fallbackKey: 'common.states.errorDescription' }));
    } finally {
      running.current = false;
      setSpinning(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={t('common.actions.refresh')}
      title={t('common.actions.refresh')}
      aria-busy={spinning}
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground tap-target',
        className,
      )}
    >
      <RotateCw className={cn('h-[18px] w-[18px]', spinning && 'animate-spin')} />
    </button>
  );
}
