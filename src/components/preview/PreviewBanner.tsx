import type { ReactNode } from 'react';
import { ArrowLeft, Monitor, RotateCw, Smartphone, Tablet } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
 */

interface PreviewBannerProps {
  title: string;
  subtitle?: string;
  /** Rendered left of the device toggle — status badges and the like. */
  meta?: ReactNode;
  /** Buttons and menus. Keep them icon-only below `sm`. */
  actions?: ReactNode;
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
  actions,
  notice,
  device,
  onDeviceChange,
  onBack,
  onRefresh,
}: PreviewBannerProps) {
  const { t } = useTranslation();

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

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 shrink-0"
          onClick={onRefresh}
          aria-label={t('common.preview.refresh')}
          title={t('common.preview.refresh')}
        >
          <RotateCw className="size-4" />
        </Button>

        {actions}
      </div>

      {notice && (
        <div className="border-t bg-muted/40 px-3 py-1.5 sm:px-4">
          <p className="text-xs text-muted-foreground">{notice}</p>
        </div>
      )}
    </header>
  );
}
