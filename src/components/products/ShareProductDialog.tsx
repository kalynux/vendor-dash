import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Check, Copy, Link2, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ResponsiveModal } from '@/components/services/ResponsiveModal';
import { ChatPreview, CHANNEL_BRAND, CHANNEL_ORDER } from '@/components/rich-text';
import { fetchProductById, fetchVariants } from '@/services/products.service';
import { useStoreStore } from '@/store';
import { useApiError, useFormatters, useTranslation, type TranslationKey } from '@/i18n';
import { cn } from '@/lib/utils';
import { openExternal } from '@/platform/browser';
import { copyText } from '@/platform/clipboard';
import { shareAvailable, shareContent } from '@/platform/share';
import {
  buildProductShareMessage,
  hydrateDoc,
  productPublicUrl,
  shareUrlFor,
  type RichDoc,
  type ShareChannel,
} from '@/lib/richtext';

interface ShareProductDialogProps {
  productId: string | null;
  onOpenChange: (open: boolean) => void;
}

type Loaded = {
  title: string;
  doc: RichDoc;
  price: string | null;
  url: string | null;
};

/**
 * Per-channel captions.
 *
 * The marks and the brand plates themselves live in
 * `components/rich-text/channels`, shared with the preview panel's channel
 * switch — so the green a vendor taps to preview a message is the green they
 * tap to send it.
 */
const CHANNEL_LABEL: Record<ShareChannel, TranslationKey> = {
  whatsapp: 'products.share.whatsapp',
  telegram: 'products.share.telegram',
};

/**
 * Share a product.
 *
 * The description editor's whole premise is that the message a customer
 * receives is what matters, and until this existed there was no way for a vendor
 * to actually send one. This closes that loop: the same formatters that drive
 * the in-editor preview produce the message, so what the vendor approved while
 * writing is literally the string that leaves the app.
 *
 * Three ways out, because vendors do not all live in the same app: the two chat
 * channels the platform formats for, the device's own share sheet for
 * everything else (Instagram, SMS, e-mail, AirDrop — none of which this could
 * enumerate), and the bare link to paste wherever.
 *
 * The detail is fetched on open rather than taken from the list row, because
 * `ProductListItem` deliberately carries only what the grid renders — no slug,
 * no description, no price.
 */
export function ShareProductDialog({ productId, onOpenChange }: ShareProductDialogProps) {
  const { t } = useTranslation();
  const apiError = useApiError();
  const { currency } = useFormatters();
  const { store } = useStoreStore();

  /**
   * Loaded state is tagged with the id it belongs to, and read back only when
   * the tag still matches.
   *
   * The obvious alternative — clearing it in an effect when `productId` goes
   * null — is a synchronous `setState` inside an effect, which cascades a render
   * for no reason. Tagging makes stale data simply unreadable instead, so
   * reopening the dialog on a different product can never flash the previous
   * one's message.
   */
  const [entry, setEntry] = useState<{ id: string; data?: Loaded; error?: string } | null>(null);
  const [channel, setChannel] = useState<ShareChannel>('whatsapp');
  const [linkCopied, setLinkCopied] = useState(false);

  const current = entry && entry.id === productId ? entry : null;
  const data = current?.data ?? null;
  const error = current?.error ?? null;

  const storeSlug = store?.slug ?? null;

  /**
   * Read once, not per render: a share sheet is a static capability, and
   * holding it in a constant keeps the button from appearing under the vendor's
   * finger mid-interaction. Absent on desktop Firefox, where the two copy
   * actions are the whole answer; always present inside the app shell, where
   * `@capacitor/share` reaches the real system chooser rather than the WebView's
   * partial `navigator.share` (CAPACITOR-PLAN.md → P4.5).
   */
  const canShareNatively = shareAvailable;

  useEffect(() => {
    if (!productId) return;
    let cancelled = false;

    (async () => {
      try {
        // The default variant carries the price; a product with none simply
        // shares without one rather than blocking the share.
        const [product, variants] = await Promise.all([
          fetchProductById(productId),
          fetchVariants(productId).catch(() => []),
        ]);
        if (cancelled) return;

        const defaultVariant =
          variants.find((v) => v.id === product.defaultVariantId) ?? variants[0] ?? null;

        setEntry({
          id: productId,
          data: {
            title: product.title,
            doc: hydrateDoc(product.descriptionRich, product.description),
            price: defaultVariant?.price ? currency(defaultVariant.price) : null,
            url: productPublicUrl(storeSlug, product.slug),
          },
        });
      } catch (err) {
        if (!cancelled) {
          setEntry({
            id: productId,
            error: apiError.resolve(err, { fallbackKey: 'products.errors.loadFailed' }),
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [productId, storeSlug, currency, apiError]);

  const message = useMemo(
    () => (data ? buildProductShareMessage(data, channel) : ''),
    [data, channel],
  );

  const openChannel = (target: ShareChannel) => {
    if (!data) return;
    const body = buildProductShareMessage(data, target);
    // Through the platform layer, not `window.open` directly: a Capacitor
    // WebView has nowhere to put a second window, so `target="_blank"` there
    // tends to do nothing at all and the share button just looks broken. On
    // native this opens a Custom Tab / SFSafariViewController over the app; on
    // the web it is still `window.open(…, 'noopener,noreferrer')` — and
    // `noopener` is not optional there, since the opened tab is whatsapp.com or
    // telegram.org and handing it a live `window.opener` back into the dashboard
    // is a needless one (CAPACITOR-PLAN.md → P3.5).
    void openExternal(shareUrlFor(target, body, data.url));
    onOpenChange(false);
  };

  /**
   * The device's own share sheet.
   *
   * The link rides in `url` rather than inside `text` because that is the field
   * receiving apps unfurl into a preview card — a URL buried in the body arrives
   * as bare characters. The body is the Telegram (plain) build for the same
   * reason it is plain there: the sheet hands `text` over verbatim, so WhatsApp's
   * `*bold*` markers would land as literal asterisks in half the targets.
   *
   * `AbortError` is what the sheet throws when the vendor dismisses it, which is
   * a choice rather than a failure and gets no toast.
   */
  const shareNatively = useCallback(async () => {
    if (!data) return;
    const outcome = await shareContent({
      title: data.title,
      text: buildProductShareMessage(data, 'telegram'),
      ...(data.url ? { url: data.url } : {}),
      dialogTitle: t('products.share.title'),
    });
    // Dismissing the sheet is a choice rather than a failure and gets no toast;
    // `shareContent` tells the two apart across both platforms' spellings of it.
    if (outcome === 'shared') onOpenChange(false);
    else if (outcome === 'failed') toast.error(t('products.share.shareFailed'));
  }, [data, onOpenChange, t]);

  const copyMessage = async () => {
    if (!message) return;
    if (await copyText(message)) toast.success(t('products.share.copied'));
    else toast.error(t('common.toast.copyFailed'));
  };

  const copyLink = async () => {
    if (!data?.url) return;
    if (await copyText(data.url)) {
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2000);
      toast.success(t('common.toast.linkCopied'));
    } else {
      toast.error(t('common.toast.copyFailed'));
    }
  };

  return (
    <ResponsiveModal
      open={!!productId}
      onOpenChange={onOpenChange}
      title={t('products.share.title')}
      description={t('products.share.description')}
      desktopClassName="sm:max-w-md"
      /* The sheet grows to its content instead of claiming 92% of the screen —
         this is a preview and four buttons, and a half-empty full-height sheet
         was most of what made the mobile popup look broken. */
      mobileClassName="h-auto max-h-[92dvh]"
      /* Side by side at every width: both labels are two words, so the default
         stacked-on-mobile footer spent a whole row on nothing. */
      footerClassName="flex-row justify-end"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={copyLink}
            disabled={!data?.url}
            title={data && !data.url ? t('products.share.noStoreUrl') : undefined}
            className="min-w-0 flex-1 sm:flex-none"
          >
            {linkCopied ? (
              <Check className="mr-2 size-4 shrink-0 text-emerald-600" />
            ) : (
              <Link2 className="mr-2 size-4 shrink-0" />
            )}
            <span className="truncate">{t('common.actions.copyLink')}</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={copyMessage}
            disabled={!data}
            className="min-w-0 flex-1 sm:flex-none"
          >
            <Copy className="mr-2 size-4 shrink-0" />
            <span className="truncate">{t('products.share.copy')}</span>
          </Button>
        </>
      }
    >
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : !data ? (
        <div className="space-y-3">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-11 w-32" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* `telegramFormat="plain"` because this dialog sends through
              `t.me/share/url`, which renders its text verbatim — the marks are
              genuinely lost on that route, and the preview says so. */}
          <ChatPreview
            doc={data.doc}
            title={data.title}
            price={data.price}
            url={data.url}
            telegramFormat="plain"
            onChannelChange={setChannel}
          />
          {channel === 'telegram' && (
            <p className="text-xs text-muted-foreground">{t('products.share.telegramPlainNote')}</p>
          )}
          {!data.url && (
            <p className="text-xs text-muted-foreground">{t('products.share.noStoreUrl')}</p>
          )}

          <div className="space-y-2">
            {/* One caption for the row. Naming each button as well is the text
                the mark already carries — and on a 360px sheet it is the text
                that pushed the buttons out of the dialog. */}
            <p className="text-xs font-medium text-muted-foreground">
              {t('products.share.sendVia')}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {CHANNEL_ORDER.map((target) => {
                const { Mark, plate } = CHANNEL_BRAND[target];
                return (
                  <button
                    key={target}
                    type="button"
                    onClick={() => openChannel(target)}
                    title={t(CHANNEL_LABEL[target])}
                    aria-label={t(CHANNEL_LABEL[target])}
                    className={cn(
                      'flex size-11 shrink-0 items-center justify-center rounded-full text-white',
                      'transition-colors focus-visible:outline-none focus-visible:ring-2',
                      'focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                      plate,
                    )}
                  >
                    <Mark className="size-6" />
                  </button>
                );
              })}
              {canShareNatively && (
                <button
                  type="button"
                  onClick={() => void shareNatively()}
                  title={t('products.share.moreApps')}
                  aria-label={t('products.share.moreApps')}
                  className={cn(
                    'flex size-11 shrink-0 items-center justify-center rounded-full',
                    'bg-muted text-foreground transition-colors hover:bg-accent',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    'focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  )}
                >
                  <Share2 className="size-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </ResponsiveModal>
  );
}
