import type { ReactNode } from 'react';
import { EyeOff } from 'lucide-react';

/**
 * What stands in for the frame when there is no customer page to embed.
 *
 * The storefront serves published products only — an unpublished one 404s, by
 * design, so that a competitor cannot enumerate a vendor's unreleased catalogue.
 * Rendering the iframe anyway would sit a Next.js "not found" page inside the
 * preview and make a deliberate rule look like a broken feature, so the caller
 * checks the status first and renders this instead.
 */
export function PreviewUnavailable({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex h-full items-center justify-center overflow-auto bg-muted/40 p-6">
      <div className="flex max-w-sm flex-col items-center text-center">
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <EyeOff className="size-5" />
        </div>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  );
}
