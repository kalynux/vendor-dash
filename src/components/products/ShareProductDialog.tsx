import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Copy, MessageCircle, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ResponsiveModal } from '@/components/services/ResponsiveModal';
import { ChatPreview } from '@/components/rich-text';
import { fetchProductById, fetchVariants } from '@/services/products.service';
import { useStoreStore } from '@/store';
import { useApiError, useFormatters, useTranslation } from '@/i18n';
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
 * Share a product into a chat.
 *
 * The description editor's whole premise is that the message a customer
 * receives is what matters, and until this existed there was no way for a vendor
 * to actually send one — the product list's "Preview" item had no handler at
 * all. This closes that loop: the same formatters that drive the in-editor
 * preview produce the message, so what the vendor approved while writing is
 * literally the string that leaves the app.
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

  const current = entry && entry.id === productId ? entry : null;
  const data = current?.data ?? null;
  const error = current?.error ?? null;

  const storeSlug = store?.slug ?? null;

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
    // `noopener` on a share deep link is not optional — the opened tab is
    // whatsapp.com or telegram.org, and handing it a live `window.opener` back
    // into the dashboard is a needless one.
    window.open(shareUrlFor(target, body, data.url), '_blank', 'noopener,noreferrer');
    onOpenChange(false);
  };

  const copy = async () => {
    if (!message) return;
    await navigator.clipboard.writeText(message);
    toast.success(t('products.share.copied'));
  };

  return (
    <ResponsiveModal
      open={!!productId}
      onOpenChange={onOpenChange}
      title={t('products.share.title')}
      description={t('products.share.description')}
      desktopClassName="sm:max-w-lg"
      footer={
        <>
          <Button type="button" variant="outline" onClick={copy} disabled={!data} className="sm:mr-auto">
            <Copy className="mr-2 size-4" />
            {t('products.share.copy')}
          </Button>
          <Button type="button" variant="outline" onClick={() => openChannel('telegram')} disabled={!data}>
            <Send className="mr-2 size-4" />
            {t('products.share.telegram')}
          </Button>
          <Button type="button" onClick={() => openChannel('whatsapp')} disabled={!data}>
            <MessageCircle className="mr-2 size-4" />
            {t('products.share.whatsapp')}
          </Button>
        </>
      }
    >
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : !data ? (
        <div className="space-y-2">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : (
        <div className="space-y-3">
          {!data.url && (
            <p className="text-xs text-muted-foreground">{t('products.share.noStoreUrl')}</p>
          )}
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
        </div>
      )}
    </ResponsiveModal>
  );
}
