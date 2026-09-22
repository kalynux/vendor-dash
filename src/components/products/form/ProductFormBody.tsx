import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

/**
 * The body of a product create / edit page, inside `EditorPageShell`.
 *
 * Phones get two things here, once, instead of on each of the forty-odd fields
 * across the product pages:
 *
 *  - **A 16px gutter.** The editor pages are full-bleed below `md`, and the
 *    sections inside (`SettingsSections`) are flat there — no card to pad them.
 *  - **Thumb-sized fields.** Inputs and select triggers go from the app's 36px
 *    to 44px, with 16px type in the triggers too (inputs already have it — it is
 *    the size below which iOS zooms into a focused field). A form of 36px boxes
 *    is what made these pages read as cramped on a handset.
 *
 * `md` and up is untouched. A control that has to stay compact on a phone — a
 * cell in a table, say — opts out with `max-md:!h-9`.
 */
export function ProductFormBody({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'max-md:px-4',
        'max-md:[&_[data-slot=input]]:h-11',
        'max-md:[&_[data-slot=select-trigger]]:h-11 max-md:[&_[data-slot=select-trigger]]:text-base',
        className,
      )}
      {...props}
    />
  );
}
