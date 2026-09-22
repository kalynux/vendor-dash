import type { ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePageBack } from '@/hooks/use-page-back';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { PageBackButton } from './PageBackButton';
import { MobilePageHeader, type MobileHeaderAction } from './MobilePageHeader';

/**
 * The frame around the create / edit pages — the two product wizards, the two
 * quick-add forms and the two service wizards.
 *
 * ── What it fixes ────────────────────────────────────────────────────────────
 *
 * These six pages each carried the same header by hand, and the same two bugs
 * with it.
 *
 * **They were not full-bleed on a phone.** The wrapper read
 * `max-w-3xl mx-auto -mx-6 sm:mx-auto`, meaning to cancel `<main>`'s `px-6`
 * below `sm` — but `mx-auto` and `-mx-6` are the same property at the same
 * specificity, so which one applies is decided by their order in the compiled
 * stylesheet, and Tailwind emits `.mx-auto` *after* `.-mx-6`. The negative
 * margin never applied on any screen. Every one of these pages sat in a 24px
 * gutter while its cards were styled (`border-x-0`) for an edge they never
 * reached. ⚠ Two utilities for one property, differing only by breakpoint
 * *prefix*, is not a way to express "except on mobile" — the media-query variant
 * has to be the one that overrides, which is why the wide-screen branch below is
 * the one carrying `mx-auto`.
 *
 * **Back was stacked above the title**, costing a whole row on the screen with
 * the least of them, and putting it where a thumb has to reach past the title to
 * get to it. On a handset it belongs beside the title, which is where every
 * other page in this app puts it and where `MobilePageHeader` already draws it.
 *
 * ── The two shapes ───────────────────────────────────────────────────────────
 *
 * Below `md` this is the standard mobile page: a full-bleed wrapper and a sticky
 * `MobilePageHeader` that owns the back arrow, the status-bar inset and the
 * action overflow sheet. On `md` and up it is the wide layout these pages
 * already had — a centred 3xl column, back above the title, actions at the top
 * right — so nothing changes on a desktop.
 */

export interface EditorPageAction extends MobileHeaderAction {
  /**
   * Give this action its own labelled button on `md` and up. Without it the
   * action lives in the `⋮` menu there.
   *
   * Below `md` it means nothing: `MobilePageHeader` decides what fits in the bar
   * and what drops into its sheet, because it is the thing that knows how much
   * room the title has left.
   */
  inline?: boolean;
}

interface EditorPageShellProps {
  title: string;
  /**
   * One line under the title. Plain text, because the mobile header truncates it
   * to a single line — see `descriptionNode` for anything richer.
   */
  description?: string;
  /**
   * A wide-screen-only replacement for `description`, for the one case that
   * needs markup in it (quick-add's link to the full editor). `description` is
   * still what the handset shows, so it must stand on its own.
   */
  descriptionNode?: ReactNode;
  /** Rendered beside the title on `md` and up — a badge, typically. */
  titleExtra?: ReactNode;
  /** The parent route, and how back is labelled on a wide screen. */
  backTo: string;
  backLabel: string;
  /** Always return to `backTo` rather than popping. See `usePageBack`. */
  alwaysFallback?: boolean;
  actions?: EditorPageAction[];
  children: ReactNode;
}

export function EditorPageShell({
  title,
  description,
  descriptionNode,
  titleExtra,
  backTo,
  backLabel,
  alwaysFallback,
  actions = [],
  children,
}: EditorPageShellProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const goBack = usePageBack({ fallbackPath: backTo, alwaysFallback });

  if (isMobile) {
    return (
      // `-mx-6 -mt-6` cancels `<main>`'s ordinary padding so the page reaches
      // both edges; the header re-applies the status-bar inset itself.
      //
      // `overflow-x-clip`: one control wider than the screen — a Select whose
      // chosen address will not truncate, say — made the whole document wider
      // than the viewport, and a phone then lays every fixed layer out against
      // that wider page: the header slides up out of view, and bottom sheets
      // open offset and too wide (worse on each reopen, because the scroll lock
      // mistakes the extra width for a scrollbar and pads the body by it).
      // Clipping here keeps any such overflow inside the page. `clip`, not
      // `hidden`: it makes no scroll container, so the sticky header still
      // sticks.
      <div className="-mx-6 -mt-6 overflow-x-clip animate-fade-in">
        <MobilePageHeader
          title={title}
          description={description}
          onBack={goBack}
          actions={actions}
        />
        <div className="space-y-4 pt-4">{children}</div>
      </div>
    );
  }

  const inline = actions.filter((action) => action.inline);
  const menu = actions.filter((action) => !action.inline);

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <PageBackButton
            fallbackPath={backTo}
            alwaysFallback={alwaysFallback}
            label={backLabel}
            className="mb-1"
          />
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{title}</h1>
            {titleExtra}
          </div>
          {(descriptionNode ?? description) && (
            <p className="mt-1 text-sm text-muted-foreground">
              {descriptionNode ?? description}
            </p>
          )}
        </div>

        {actions.length > 0 && (
          <div className="flex shrink-0 items-center gap-2">
            {inline.map((action) => (
              <Button
                key={action.id}
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5"
                onClick={action.onClick}
                disabled={action.disabled || action.busy}
              >
                <action.icon className="h-4 w-4" />
                {action.label}
              </Button>
            ))}

            {menu.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    aria-label={t('common.a11y.moreActions')}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {menu.map((action) => (
                    <DropdownMenuItem
                      key={action.id}
                      disabled={action.disabled || action.busy}
                      onClick={action.onClick}
                      className={cn(action.destructive && 'text-destructive')}
                    >
                      <action.icon className="mr-2 h-4 w-4" />
                      {action.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
      </div>

      {children}
    </div>
  );
}
