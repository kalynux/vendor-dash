import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, Pencil, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShareProductDialog } from '@/components/products/ShareProductDialog';
import {
  PreviewBanner,
  PreviewUnavailable,
  StorefrontFrame,
  useDefaultPreviewDevice,
  usePreviewBack,
  usePreviewLinkActions,
  useProductStatusActions,
  type PreviewAction,
  type PreviewDevice,
} from '@/components/preview';
import { fetchProductById } from '@/services/products.service';
import { useStoreStore } from '@/store';
import { useApiError, useLocale, useTranslation, type TranslationKey } from '@/i18n';
import {
  localeStorefrontPath,
  productIdPath,
  productPath,
  storefrontUrl,
  withPreviewParam,
} from '@/lib/storefront/urls';
import type { ApiProductDetail, ApiProductStatus } from '@/types/product.types';

/**
 * A product, as a customer sees it.
 *
 * The page below the banner is the storefront's own, embedded — see
 * `StorefrontFrame` for why that beats rebuilding it here. What this page owns
 * is everything the storefront cannot know: which product the vendor meant, what
 * state it is in, and what they can do about it from here.
 *
 * ── Why the product is fetched at all ────────────────────────────────────────
 *
 * The iframe needs only a URL, which a slug would give. The fetch is for the
 * banner: the status decides whether a customer page exists at all, and `mode`
 * decides which editor "Edit" opens. `ProductListItem` carries neither a slug
 * nor a status usable for this, so the detail read is unavoidable — and cheap,
 * since it is one request beside a whole page load.
 */

/**
 * Why there is no customer page, per status — the one-line banner notice and the
 * fuller explanation on the panel.
 *
 * The help text is per-status rather than generic because the way out differs:
 * `pending_review` and `suspended` accept **no** vendor-triggered transition
 * (see `STATUS_TRANSITIONS`), so "publish it" would be advice neither can act on.
 */
const UNAVAILABLE: Partial<Record<ApiProductStatus, { notice: TranslationKey; help: TranslationKey }>> = {
  draft: {
    notice: 'products.preview.unavailable.draft',
    help: 'products.preview.unavailable.helpDraft',
  },
  pending_review: {
    notice: 'products.preview.unavailable.pendingReview',
    help: 'products.preview.unavailable.helpPendingReview',
  },
  archived: {
    notice: 'products.preview.unavailable.archived',
    help: 'products.preview.unavailable.helpArchived',
  },
  suspended: {
    notice: 'products.preview.unavailable.suspended',
    help: 'products.preview.unavailable.helpSuspended',
  },
};

const STATUS_LABEL_KEYS: Record<ApiProductStatus, TranslationKey> = {
  active: 'products.status.active',
  draft: 'products.status.draft',
  archived: 'products.status.archived',
  pending_review: 'products.status.pendingReview',
  suspended: 'products.status.suspended',
};

export function ProductPreview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { locale } = useLocale();
  const apiError = useApiError();
  const { store } = useStoreStore();

  const [device, setDevice] = useState<PreviewDevice>(useDefaultPreviewDevice());
  const [reloadToken, setReloadToken] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const [product, setProduct] = useState<ApiProductDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const detail = await fetchProductById(id);
      setProduct(detail);
      setError(null);
    } catch (err) {
      setError(apiError.resolve(err, { fallbackKey: 'products.errors.loadFailed' }));
    } finally {
      setLoading(false);
    }
  }, [id, apiError]);

  useEffect(() => {
    void load();
  }, [load]);

  const isLive = product?.status === 'active';

  /**
   * The customer address, or `null` when there is no page behind it.
   *
   * A product whose slug has not been generated yet falls back to the
   * storefront's id route, which resolves the product and redirects to the
   * canonical URL — better than showing nothing over a missing field.
   */
  const publicUrl = useMemo(() => {
    if (!product || !isLive) return null;
    const path =
      store?.slug && product.slug
        ? productPath(store.slug, product.slug)
        : productIdPath(product.id);
    return storefrontUrl(localeStorefrontPath(path, locale));
  }, [product, isLive, store?.slug, locale]);

  const frameSrc = publicUrl ? withPreviewParam(publicUrl) : null;

  const refresh = useCallback(() => {
    setReloadToken((n) => n + 1);
    void load();
  }, [load]);

  // Back to whichever surface opened this preview — either editor, the products
  // list, or the products list for a vendor who deep-linked straight in.
  const goBack = usePreviewBack('/dashboard/products');

  const edit = useCallback(() => {
    if (!product) return;
    navigate(
      product.mode === 'simple'
        ? `/dashboard/product-edit/${product.id}/simple`
        : `/dashboard/product-edit/${product.id}`,
    );
  }, [navigate, product]);

  // Both are hooks, so they run before the early returns below — with nothing
  // loaded they produce a link nobody can press and an empty transition list,
  // neither of which is ever rendered.
  const linkActions = usePreviewLinkActions({
    url: publicUrl,
    unavailableReason: t('products.preview.linkUnavailable'),
  });

  const status = useProductStatusActions({
    productId: product?.id ?? '',
    productTitle: product?.title ?? '',
    status: product?.status ?? 'draft',
    // Publishing is why a vendor opens a preview of something unpublished, so
    // it is the one transition that gets a button of its own.
    primaryIntent: product?.status === 'active' ? undefined : 'activate',
    onChanged: refresh,
  });

  if (loading && !product) {
    return (
      <div className="flex h-[100dvh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-4 p-6">
        <Alert variant="destructive" className="max-w-md">
          <AlertDescription>{error ?? t('products.errors.loadFailed')}</AlertDescription>
        </Alert>
        <Button variant="outline" onClick={goBack}>
          {t('common.actions.back')}
        </Button>
      </div>
    );
  }

  const unavailable = UNAVAILABLE[product.status];

  // Most important first — that is the order the menu shows them in, and the bar
  // re-sorts the handful it renders as buttons.
  const actions: PreviewAction[] = [
    {
      id: 'edit',
      icon: Pencil,
      label: t('common.actions.edit'),
      onClick: edit,
      emphasis: 'outline',
    },
    ...status.actions,
    ...linkActions,
    {
      id: 'share',
      icon: Share2,
      label: t('products.share.action'),
      onClick: () => setShareOpen(true),
    },
  ];

  return (
    <div className="flex h-[100dvh] flex-col bg-background">
      <PreviewBanner
        title={product.title}
        subtitle={t('products.preview.subtitle')}
        meta={
          <Badge variant={isLive ? 'default' : 'secondary'} className="shrink-0">
            {t(STATUS_LABEL_KEYS[product.status])}
          </Badge>
        }
        notice={!isLive && unavailable ? t(unavailable.notice) : undefined}
        device={device}
        onDeviceChange={setDevice}
        onBack={goBack}
        onRefresh={refresh}
        actions={actions}
      />

      <div className="min-h-0 flex-1">
        {frameSrc ? (
          <StorefrontFrame src={frameSrc} device={device} reloadToken={reloadToken} />
        ) : (
          <PreviewUnavailable
            title={t('products.preview.unavailable.title')}
            description={t(unavailable?.help ?? 'products.preview.unavailable.helpDraft')}
          />
        )}
      </div>

      <ShareProductDialog
        productId={shareOpen ? product.id : null}
        onOpenChange={(open) => setShareOpen(open)}
      />

      {/* The confirmation behind the status actions above. It belongs to the
          hook that owns those transitions; the page only gives it a home. */}
      {status.dialog}
    </div>
  );
}
