import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';
import { useScrollDirection } from '@/hooks/use-scroll-direction';

interface MobilePageHeaderProps {
  title: string;
  /** When provided, a leading back button is shown. */
  onBack?: () => void;
  /** Right-aligned action icons/buttons. */
  actions?: ReactNode;
  /**
   * Search / filter row. Stays pinned under the title but collapses while the
   * user scrolls down and slides back in on scroll-up.
   */
  subheader?: ReactNode;
  className?: string;
}

/**
 * Shared mobile page header: a pinned title bar (title + optional back +
 * actions) with a reveal-on-scroll-up subheader. Intended to be rendered only
 * in the mobile branch of a page, inside a full-bleed (`-mx-6 -mt-6`) wrapper.
 *
 * ── Who owns the status-bar inset (CAPACITOR-PLAN.md → P3.3) ────────────────
 *
 * This header does. It is `sticky top-0`, so once the page is scrolled it is the
 * thing touching the top of the viewport, and `pt-safe` is what keeps its title
 * out from under the clock.
 *
 * But four dashboard pages (Overview, Analytics, Account, Settings) have no
 * header at all, so `<main>` in App.tsx carries the inset for them. Left alone
 * that would double-count here — main's padding *plus* this `pt-safe` — hence
 * `-mt-safe`, which pulls this element back up through main's padding so the
 * inset is applied exactly once, by the element that owns it. The `-mt-6` on the
 * page's own wrapper still cancels main's ordinary 1.5rem, unchanged.
 *
 * In a browser `env(safe-area-inset-top)` is 0, so both classes are inert and
 * the web layout is byte-for-byte what it was.
 */
export function MobilePageHeader({
  title,
  onBack,
  actions,
  subheader,
  className,
}: MobilePageHeaderProps) {
  const { t } = useTranslation();
  const direction = useScrollDirection();
  const subheaderHidden = direction === 'down';

  return (
    <div
      className={cn(
        'sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b shadow-sm',
        // Read together, and see the note above: take the inset off `<main>`,
        // then re-apply it here.
        '-mt-safe pt-safe',
        className,
      )}
    >
      {/* Pinned title bar */}
      <div className="flex h-14 items-center gap-1 px-4">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label={t('common.a11y.goBack')}
            className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-foreground hover:bg-accent transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <h1 className="flex-1 truncate text-xl font-bold">{title}</h1>
        {actions && <div className="flex items-center gap-1">{actions}</div>}
      </div>

      {/* Collapsible subheader (search / filters).
          Uses the grid-rows 0fr↔1fr technique so it animates the real content
          height smoothly (no max-height stutter). */}
      {subheader && (
        <div
          className={cn(
            'grid transition-[grid-template-rows,opacity] duration-300 ease-in-out',
            subheaderHidden ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100',
          )}
        >
          <div className="overflow-hidden">
            <div className="px-4 pb-3">{subheader}</div>
          </div>
        </div>
      )}
    </div>
  );
}
