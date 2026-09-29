import type { ComponentProps, ReactNode, Ref } from 'react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { InfoHint } from '@/components/ui/info-hint';
import { useTranslation } from '@/i18n';

/**
 * Container for a settings surface.
 *
 * On mobile the card chrome is dropped entirely and sections are separated by a
 * hairline instead: a card inside the page's own padding cost ~48px of the
 * viewport width to borders and padding alone, which is what made every settings
 * screen feel cramped. From `md` up there is room for the cards, so they come
 * back and this behaves like a plain `space-y-6` stack.
 *
 * Direct children must be `SettingsSection`s (or a wrapper that lays several of
 * them out) — the separators come from `divide-y`, which only sees direct DOM
 * children.
 */
export function SettingsSections({ children, className, ...props }: ComponentProps<'div'>) {
  return (
    <div className={cn('max-md:divide-y max-md:divide-border md:space-y-6', className)} {...props}>
      {children}
    </div>
  );
}

interface SettingsSectionProps {
  title: ReactNode;
  icon?: LucideIcon;
  /**
   * The long-form explanation of this section, hidden behind an info icon next
   * to the title. Prefer this over `description` — permanent prose is what
   * pushes the actual fields off the first screenful.
   */
  info?: ReactNode;
  /** A short line under the title. Only for copy that must always be visible. */
  description?: ReactNode;
  /** Control rendered at the right end of the header row (e.g. an "Add" button). */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Classes for the body wrapper (spacing between the section's own fields). */
  contentClassName?: string;
  /**
   * Classes for the title row — e.g. `max-md:hidden` when the phone's page
   * header already names this section and a second heading is just noise.
   */
  headerClassName?: string;
  /** React 19 passes `ref` as a plain prop — used for scroll-into-view targets. */
  ref?: Ref<HTMLElement>;
}

export function SettingsSection({
  title,
  icon: Icon,
  info,
  description,
  action,
  children,
  className,
  contentClassName,
  headerClassName,
  ref,
}: SettingsSectionProps) {
  const { t } = useTranslation();

  return (
    <section
      ref={ref}
      className={cn(
        // Uniform vertical padding rather than a `first:pt-0` reset: sections
        // also appear as the first child of a *column* wrapper in the two-column
        // layouts, where zeroing the top padding would jam them against the
        // divider above.
        'max-md:py-5',
        // Thumb-sized fields on a phone, the same rule as `ProductFormBody`:
        // inputs and select triggers go from 36px to 44px (16px type, below
        // which iOS zooms a focused field). Opt out with `max-md:!h-9`.
        'max-md:[&_[data-slot=input]]:h-11',
        'max-md:[&_[data-slot=select-trigger]]:h-11 max-md:[&_[data-slot=select-trigger]]:text-base',
        'md:rounded-xl md:border md:bg-card md:p-6 md:text-card-foreground md:shadow-sm',
        className,
      )}
    >
      <div className={cn('mb-4 flex items-start justify-between gap-3', headerClassName)}>
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 font-display text-base font-semibold leading-none tracking-tight">
            {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" />}
            <span className="min-w-0">{title}</span>
            {info && (
              <InfoHint
                label={
                  typeof title === 'string'
                    ? t('account.section.aboutTitle', { title })
                    : t('account.section.moreInformation')
                }
                align="start"
              >
                {info}
              </InfoHint>
            )}
          </h3>
          {description && <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className={contentClassName}>{children}</div>
    </section>
  );
}

/**
 * A titled group *inside* a section (e.g. "Delivery channel" within
 * Notifications). Never draws a border — nesting boxes is the thing we are
 * getting rid of.
 */
export function SettingsGroup({
  title,
  info,
  action,
  children,
  className,
  contentClassName,
}: {
  title: ReactNode;
  info?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const { t } = useTranslation();

  return (
    <div className={className}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h4 className="flex items-center gap-1.5 text-sm font-medium">
          <span className="min-w-0">{title}</span>
          {info && (
            <InfoHint
              label={
                typeof title === 'string'
                  ? t('account.section.aboutTitle', { title })
                  : t('account.section.moreInformation')
              }
              align="start"
            >
              {info}
            </InfoHint>
          )}
        </h4>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className={contentClassName}>{children}</div>
    </div>
  );
}
