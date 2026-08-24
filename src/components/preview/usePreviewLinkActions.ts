import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { copyText } from '@/platform/clipboard';
import { openExternal } from '@/platform/browser';
import { useTranslation } from '@/i18n';
import type { PreviewAction } from './PreviewBanner';

/**
 * Copy / open the customer link, as actions the banner can place.
 *
 * The URL handed out here is the plain customer address — never the `?preview=1`
 * form the iframe loads. That flag tells the storefront to skip its catalog
 * cache, which is right for a vendor checking their own edit and pointless
 * overhead on a link a shopper follows.
 *
 * `url` is nullable because the page it addresses may not exist yet: an
 * unpublished product has no customer address. Both actions stay *visible and
 * disabled* rather than disappearing, carrying `disabledReason` — a link that
 * quietly vanishes reads as a missing feature, where a greyed-out row that says
 * why reads as a state the vendor can get out of.
 */
export function usePreviewLinkActions({
  url,
  unavailableReason,
}: {
  url: string | null;
  unavailableReason?: string;
}): PreviewAction[] {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  // Through the platform layer, not `navigator.clipboard` directly: that API is
  // gated on a secure context and a user gesture and is unreliable inside a
  // WebView, where `@capacitor/clipboard` goes to `ClipboardManager` instead.
  // It reports whether the copy happened, so "Copied" is only ever claimed when
  // it is true (CAPACITOR-PLAN.md → P4.5).
  const copy = useCallback(async () => {
    if (!url) return;
    if (await copyText(url)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error(t('common.preview.copyFailed'));
    }
  }, [url, t]);

  return [
    {
      id: 'open-live',
      icon: ExternalLink,
      label: t('common.preview.openLive'),
      // `openExternal`, not an `<a target="_blank">`: a WebView has nowhere to
      // put a second window, so the link would simply do nothing on a device
      // (CAPACITOR-PLAN.md → P3.5).
      onClick: () => {
        if (url) void openExternal(url);
      },
      disabled: !url,
      disabledReason: unavailableReason,
      emphasis: 'outline',
    },
    {
      id: 'copy-link',
      icon: copied ? Check : Copy,
      label: t('common.actions.copyLink'),
      onClick: () => void copy(),
      disabled: !url,
      disabledReason: unavailableReason,
    },
  ];
}
