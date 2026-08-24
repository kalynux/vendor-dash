import { useState, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Bell, Loader2, MoreVertical, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';
import { useHeaderReveal } from '@/hooks/use-header-reveal';
import { useNotificationStore } from '@/store';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

const NOTIFICATIONS_PATH = '/dashboard/notifications';

/**
 * One thing a page lets you do, described rather than drawn.
 *
 * Declaring actions as data instead of as JSX is what lets the header decide
 * *where* each one goes — an icon button on a roomy screen, a labelled row in a
 * sheet on a cramped one — without every page having to write it twice.
 */
export interface MobileHeaderAction {
  /** Stable identity for React keys. */
  id: string;
  icon: LucideIcon;
  /** The accessible name inline, and the visible label in the overflow sheet. */
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** Swaps the icon for a spinner and blocks the press. */
  busy?: boolean;
  /** Tints it red in the sheet — deletes, sign-out. */
  destructive?: boolean;
  /** Count badge, e.g. unread. Hidden at 0. */
  badge?: number;
}

interface MobilePageHeaderProps {
  title: string;
  /**
   * One line under the title. **Always exactly one** — it is truncated rather
   * than wrapped, because a header that grows a line taller on some pages and
   * not others makes the content below it jump as you move between them.
   */
  description?: string;
  /** When provided, a leading back button is shown. */
  onBack?: () => void;
  /**
   * A small visual before the title — the store's logo on Overview. Sized by
   * the caller; keep it to about 32px so the bar stays 56px tall.
   */
  leading?: ReactNode;
  /** Page actions, most important first. See `MobileHeaderAction`. */
  actions?: MobileHeaderAction[];
  /**
   * Escape hatch for a control that is not an icon button — the "Select all"
   * text button on Orders' selection mode is the only caller today. Rendered
   * before the actions, and counts against nothing.
   */
  actionsSlot?: ReactNode;
  /**
   * Drop the notifications bell. For the notifications page itself, and for
   * transient modes (multi-select) where the page has taken over the bar.
   */
  hideNotifications?: boolean;
  /**
   * Search / filter row. Stays pinned under the title but collapses while the
   * user scrolls down and slides back in on scroll-up.
   */
  subheader?: ReactNode;
  className?: string;
}

/**
 * The number of icon buttons the bar can hold beside the title without
 * squeezing it to nothing. Anything past this moves into the overflow sheet.
 *
 * Three, not four. At 36px each plus the bar's own gutters, three take ~120px of
 * a 360px screen and leave the title around 240px — enough for every page name
 * in the app *and* the description line under it, which is the whole point of
 * shrinking the title in the first place. A fourth icon buys one more tap target
 * and costs the header its legibility.
 *
 * The bell claims one of the three wherever it is shown, which is why it is
 * subtracted below rather than reserved separately.
 */
const MAX_BAR_BUTTONS = 3;

/**
 * Shared mobile page header: a pinned title bar (title + optional back +
 * actions + notifications) with a reveal-on-scroll-up subheader. Intended to be
 * rendered only in the mobile branch of a page, inside a full-bleed
 * (`-mx-6 -mt-6`) wrapper.
 *
 * ── The right-hand side ──────────────────────────────────────────────────────
 *
 * The bell is here, not on each page, because "notifications are always one tap
 * away" only holds if it is impossible for a page to forget it — and eleven
 * pages plus every one added later is a lot of places to remember. Owning it
 * here also means the header is the thing that knows how much room is left, so
 * it can push a page's own actions into an overflow sheet when the bell would
 * otherwise crowd them out. Pages just list what they can do, most important
 * first, and get the arrangement that fits.
 *
 * ── Who owns the status-bar inset (CAPACITOR-PLAN.md → P3.3) ────────────────
 *
 * This header does. It is `sticky top-0`, so once the page is scrolled it is the
 * thing touching the top of the viewport, and `pt-safe` is what keeps its title
 * out from under the clock.
 *
 * `<main>` in App.tsx carries the same inset for any page with no header of its
 * own. Left alone that would double-count here — main's padding *plus* this
 * `pt-safe` — hence `-mt-safe`, which pulls this element back up through main's
 * padding so the inset is applied exactly once, by the element that owns it.
 * The `-mt-6` on the page's own wrapper still cancels main's ordinary 1.5rem,
 * unchanged.
 *
 * In a browser `env(safe-area-inset-top)` is 0, so both classes are inert and
 * the web layout is byte-for-byte what it was.
 */
export function MobilePageHeader({
  title,
  description,
  onBack,
  leading,
  actions,
  actionsSlot,
  hideNotifications,
  subheader,
  className,
}: MobilePageHeaderProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { unreadCount } = useNotificationStore();
  const [overflowOpen, setOverflowOpen] = useState(false);
  // Only the pages that actually have a collapsible row pay for the listener.
  const subheaderHidden = !useHeaderReveal({ enabled: !!subheader });

  // Never a bell on the page it would navigate to — it would be a button that
  // reloads the screen you are already looking at.
  const showBell = !hideNotifications && !location.pathname.startsWith(NOTIFICATIONS_PATH);

  const all = actions ?? [];
  const barBudget = MAX_BAR_BUTTONS - (showBell ? 1 : 0);
  // Only spend a slot on the overflow button when it is actually going to hold
  // something — with exactly `barBudget` actions everything still fits inline.
  const overflowed = all.length > barBudget ? all.slice(barBudget - 1) : [];
  const inline = overflowed.length ? all.slice(0, barBudget - 1) : all;

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
            className="-ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-accent transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}

        {leading && <div className="mr-2 shrink-0">{leading}</div>}

        {/* `min-w-0` is what lets the title truncate instead of shoving the
            buttons off the right edge — a flex item's default minimum is its
            content. */}
        <div className="min-w-0 flex-1">
          <h1
            className={cn(
              'truncate font-bold leading-tight',
              description ? 'text-base' : 'text-lg',
            )}
          >
            {title}
          </h1>
          {description && (
            <p className="truncate text-xs leading-tight text-muted-foreground">
              {description}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          {actionsSlot}

          {inline.map((action) => (
            <HeaderIconButton key={action.id} action={action} />
          ))}

          {overflowed.length > 0 && (
            <HeaderIconButton
              action={{
                id: 'overflow',
                icon: MoreVertical,
                label: t('common.a11y.moreActions'),
                onClick: () => setOverflowOpen(true),
                // Surface a badge hidden inside the sheet, so nothing that was
                // asking for attention goes quiet by being moved.
                badge: overflowed.reduce((sum, a) => sum + (a.badge ?? 0), 0),
              }}
            />
          )}

          {showBell && (
            <HeaderIconButton
              action={{
                id: 'notifications',
                icon: Bell,
                label: t('common.a11y.openNotifications'),
                onClick: () => navigate(NOTIFICATIONS_PATH),
                badge: unreadCount,
              }}
            />
          )}
        </div>
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

      {/* Overflow — a bottom sheet rather than a dropdown: it is within thumb
          reach, and it has room for each action's label, which an icon in the
          bar does not. */}
      <Sheet open={overflowOpen} onOpenChange={setOverflowOpen}>
        <SheetContent side="bottom" className="gap-0 rounded-t-2xl p-0">
          <SheetHeader className="border-b px-4 pb-2 pt-4">
            <SheetTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {title}
            </SheetTitle>
          </SheetHeader>
          <div className="py-2">
            {overflowed.map((action) => (
              <button
                key={action.id}
                type="button"
                disabled={action.disabled || action.busy}
                onClick={() => {
                  setOverflowOpen(false);
                  action.onClick();
                }}
                className={cn(
                  'flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-accent',
                  'disabled:pointer-events-none disabled:opacity-50',
                  action.destructive && 'text-destructive',
                )}
              >
                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                    action.destructive ? 'bg-destructive/10' : 'bg-muted',
                  )}
                >
                  {action.busy ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <action.icon className="h-5 w-5" />
                  )}
                </div>
                <span className="flex-1 text-sm font-semibold">{action.label}</span>
                {!!action.badge && action.badge > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                    {action.badge > 9 ? '9+' : action.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="h-safe-bottom pb-2" />
        </SheetContent>
      </Sheet>
    </div>
  );
}

/** One icon button in the bar. 36px — the whole reason the budget is four. */
function HeaderIconButton({ action }: { action: MobileHeaderAction }) {
  const { icon: Icon, label, onClick, disabled, busy, badge } = action;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      aria-label={label}
      className="relative flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
    >
      {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
      {!!badge && badge > 0 && (
        <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-0.5 text-[10px] font-bold leading-none text-destructive-foreground">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  );
}
