import type { MouseEvent, ReactNode } from 'react';

import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';
import { legalUrl, type LegalDocument } from '@/lib/legal';
import { openExternal } from '@/platform/browser';
import { isNative } from '@/platform/env';

interface LegalLinkProps {
  doc: LegalDocument;
  /** Usually filled in by `<Trans>`, which clones this element around a slot. */
  children?: ReactNode;
  className?: string;
}

/**
 * A link to the Terms of Service or the Privacy Policy, in the dashboard's
 * language.
 *
 * Web: a plain `target="_blank"` anchor. Native: the document is opened with
 * `Browser.open` (via `openExternal`), outside the WebView — the CDN page's
 * "Download PDF" does nothing inside a WebView. The document-level interceptor
 * in `platform/browser.ts` would also catch this anchor; when it already has
 * (it runs in the capture phase and prevents the default), this handler stands
 * down so the page does not open twice.
 *
 * `stopPropagation` keeps a click on the link from reaching an enclosing
 * `<label>` or row handler, so tapping "Terms of Service" beside a checkbox
 * opens the terms without ticking the box.
 */
export function LegalLink({ doc, children, className }: LegalLinkProps) {
  const { locale } = useI18n();
  const href = legalUrl(doc, locale);

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    event.stopPropagation();
    if (!isNative) return;
    if (event.defaultPrevented || event.nativeEvent.defaultPrevented) return;
    event.preventDefault();
    void openExternal(href);
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      onClick={handleClick}
      className={cn('font-medium text-primary underline underline-offset-4', className)}
    >
      {children}
    </a>
  );
}
