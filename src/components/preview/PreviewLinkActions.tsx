import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';

/**
 * Copy / open the customer link.
 *
 * The URL handed out here is the plain customer address — never the `?preview=1`
 * form the iframe loads. That flag tells the storefront to skip its catalog
 * cache, which is right for a vendor checking their own edit and pointless
 * overhead on a link a shopper follows.
 *
 * `url` is nullable because the page it addresses may not exist yet: an
 * unpublished product has no customer address, and offering a link that 404s is
 * worse than saying why there isn't one.
 */
export function PreviewLinkActions({
  url,
  unavailableReason,
}: {
  url: string | null;
  unavailableReason?: string;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('common.preview.copyFailed'));
    }
  }, [url, t]);

  const disabledTitle = url ? undefined : unavailableReason;

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-9 shrink-0"
        onClick={() => void copy()}
        disabled={!url}
        title={disabledTitle ?? t('common.actions.copyLink')}
        aria-label={t('common.actions.copyLink')}
      >
        {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
      </Button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0 gap-1.5"
        disabled={!url}
        title={disabledTitle ?? t('common.preview.openLive')}
        asChild={!!url}
      >
        {url ? (
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-4" />
            <span className="hidden sm:inline">{t('common.preview.openLive')}</span>
          </a>
        ) : (
          <span>
            <ExternalLink className="size-4" />
            <span className="hidden sm:inline">{t('common.preview.openLive')}</span>
          </span>
        )}
      </Button>
    </>
  );
}
