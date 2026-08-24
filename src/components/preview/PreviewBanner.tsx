import type { ReactNode } from 'react';
import {
  ArrowLeft,
  Loader2,
  Monitor,
  MoreVertical,
  RotateCw,
  Smartphone,
  Tablet,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';
import type { PreviewDevice } from './StorefrontFrame';

/**
 * The vendor's half of a preview page.
 *
 * Everything below this bar is the customer's view, rendered by the storefront
 * itself. Everything in it is ours — so it uses the dashboard's own components
 * and goes through the dashboard's own translations, while the frame below
 * serves whatever language the storefront serves that vendor.
 *
 * It is sticky rather than scrolling away because the frame owns its own scroll:
 * the page itself never scrolls, so a non-sticky bar would simply be pinned by
 * accident and break the moment that changed.
 *
 * ── Actions are data, not JSX ────────────────────────────────────────────────
 *
 * A preview page can do six or seven things — copy the link, open it, share it,
 * edit, publish, archive, reload — and on a handset that was a row of buttons
 * wide enough to squeeze the product's own name down to a couple of words. The
 * bar cannot fix that while the page hands it finished markup, because the page
 * has no idea how much room is left.
 *
 * So pages describe what they can do (`PreviewAction`) and the bar decides where
 * each one goes — the same arrangement `MobilePageHeader` uses, for the same
 * reason. Below `md` **everything** collapses into one `⋮` menu, which the
 * dropdown primitive already renders as a bottom sheet. On a wide screen the one
 * or two actions a vendor actually came for stay visible as labelled buttons
 * (`emphasis`) and the rest share that same menu.
 */

export interface PreviewAction {
  /** Stable identity for React keys. */
  id: string;
  icon: LucideIcon;
  /** The visible label in the menu, and the accessible name when icon-only. */
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** Why it is disabled. Becomes the tooltip in place of the label. */
  disabledReason?: string;
  /** Swaps the icon for a spinner and blocks the press. */
  busy?: boolean;
  /** Tints it red — archive, delete. */
  destructive?: boolean;
  /**
   * How prominent this action is **on `md` and up**: a filled or outlined button
   * with a label, instead of a row in the menu. Below `md` it buys nothing —
   * everything is in the sheet there, which is the whole point.
   */
  emphasis?: 'primary' | 'outline';
}

interface PreviewBannerProps {
  title: string;
  subtitle?: string;
  /** Rendered left of the device toggle — status badges and the like. */
  meta?: ReactNode;
  /** Everything this page can do, most important first. */
  actions?: PreviewAction[];
  /**
   * A read-only line about what customers can currently see. Rendered as a
   * second row so it never competes with the actions for width.
   */
  notice?: ReactNode;
  device: PreviewDevice;
  onDeviceChange: (device: PreviewDevice) => void;
  onBack: () => void;
  onRefresh: () => void;
}

const DEVICES: { value: PreviewDevice; Icon: typeof Monitor; labelKey: 'mobile' | 'tablet' | 'desktop' }[] = [
  { value: 'mobile', Icon: Smartphone, labelKey: 'mobile' },
  { value: 'tablet', Icon: Tablet, labelKey: 'tablet' },
  { value: 'desktop', Icon: Monitor, labelKey: 'desktop' },
];

export function PreviewBanner({
  title,
  subtitle,
  meta,
  actions = [],
  notice,
  device,
  onDeviceChange,
  onBack,
  onRefresh,
}: PreviewBannerProps) {
  const { t } = useTranslation();

  const refresh: PreviewAction = {
    id: 'refresh',
    icon: RotateCw,
    label: t('common.preview.refresh'),
    onClick: onRefresh,
  };

  // Wide screens keep the one or two actions worth a labelled button, plus
  // Refresh as its own icon; everything else shares the menu. Narrow screens put
  // the lot in there — that is the whole point.
  //
  // Pages list their actions most-important-first, which is the order the menu
  // wants. A toolbar wants the opposite for the filled one — a primary button
  // belongs at the end of a row, not in the middle of it — so the inline set is
  // re-sorted rather than asking every page to order for both at once. Refresh
  // trails them: it is about the preview, not about the thing being previewed.
  const inline = actions
    .filter((action) => action.emphasis)
    .sort((a, b) => Number(a.emphasis === 'primary') - Number(b.emphasis === 'primary'));
  const wideMenu = actions.filter((action) => !action.emphasis);
  const narrowMenu = [...actions, refresh];

  return (
    // `pt-safe`: the preview pages render outside the dashboard shell and fill
    // the viewport (`h-[100dvh]`), so this bar is what sits under the status bar
    // on a device. Inert in a browser (CAPACITOR-PLAN.md → P3.3).
    <header className="shrink-0 border-b bg-background pt-safe">
      <div className="flex items-center gap-2 px-3 py-2 sm:gap-3 sm:px-4 sm:py-2.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 shrink-0"
          onClick={onBack}
          aria-label={t('common.actions.back')}
        >
          <ArrowLeft className="size-4" />
        </Button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold leading-tight">{title}</p>
            {meta}
          </div>
          {subtitle && (
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>

        {/* Hidden below `md`: a phone cannot usefully render a 1200px frame, and
            the toggle would only ever move the preview further from what that
            vendor is actually looking at. */}
        <div
          className="hidden shrink-0 items-center rounded-lg border bg-muted/50 p-0.5 md:flex"
          role="group"
          aria-label={t('common.preview.device.label')}
        >
          {DEVICES.map(({ value, Icon, labelKey }) => {
            const active = device === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => onDeviceChange(value)}
                aria-pressed={active}
                title={t(`common.preview.device.${labelKey}` as const)}
                className={cn(
                  'inline-flex size-8 items-center justify-center rounded-md transition-colors',
                  active
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-4" />
                <span className="sr-only">{t(`common.preview.device.${labelKey}` as const)}</span>
              </button>
            );
          })}
        </div>

        <div className="hidden shrink-0 items-center gap-1.5 md:flex">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 shrink-0"
            onClick={refresh.onClick}
            aria-label={refresh.label}
            title={refresh.label}
          >
            <RotateCw className="size-4" />
          </Button>

          {inline.map((action) => (
            <Button
              key={action.id}
              type="button"
              variant={action.emphasis === 'primary' ? 'default' : 'outline'}
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={action.onClick}
              disabled={action.disabled || action.busy}
              title={action.disabled ? action.disabledReason ?? action.label : action.label}
            >
              {action.busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <action.icon className="size-4" />
              )}
              {action.label}
            </Button>
          ))}
          <PreviewActionsMenu title={title} items={wideMenu} />
        </div>

        <div className="shrink-0 md:hidden">
          <PreviewActionsMenu title={title} items={narrowMenu} />
        </div>
      </div>

      {notice && (
        <div className="border-t bg-muted/40 px-3 py-1.5 sm:px-4">
          <p className="text-xs text-muted-foreground">{notice}</p>
        </div>
      )}
    </header>
  );
}

/**
 * The `⋮` menu. Below `md` the dropdown primitive draws itself as a bottom
 * sheet, so this is the whole mobile action bar — see `ui/mobile-sheet.tsx`.
 *
 * A disabled row keeps its `disabledReason` as a second line rather than a
 * tooltip: there is no hover on a handset, so a tooltip is a message nobody
 * receives.
 */
function PreviewActionsMenu({ title, items }: { title: string; items: PreviewAction[] }) {
  const { t } = useTranslation();

  if (items.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 shrink-0"
          aria-label={t('common.a11y.moreActions')}
        >
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate">{title}</DropdownMenuLabel>
        {items.map((action) => (
          <DropdownMenuItem
            key={action.id}
            disabled={action.disabled || action.busy}
            onClick={action.onClick}
            className={cn('items-start', action.destructive && 'text-destructive')}
          >
            {action.busy ? (
              <Loader2 className="mt-0.5 size-4 animate-spin" />
            ) : (
              <action.icon className="mt-0.5 size-4" />
            )}
            <span className="min-w-0 flex-1">
              <span className="block">{action.label}</span>
              {action.disabled && action.disabledReason && (
                <span className="block text-xs font-normal text-muted-foreground">
                  {action.disabledReason}
                </span>
              )}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
