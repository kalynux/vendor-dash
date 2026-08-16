import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  PreviewBanner,
  PreviewLinkActions,
  PreviewUnavailable,
  StorefrontFrame,
  useDefaultPreviewDevice,
  type PreviewDevice,
} from '@/components/preview';
import { useStoreStore } from '@/store';
import { useLocale, useTranslation } from '@/i18n';
import { localeStorefrontPath, storePath, storefrontUrl, withPreviewParam } from '@/lib/storefront/urls';

/**
 * The storefront, as a customer sees it.
 *
 * Unlike a product, a store page always exists — a vendor with nothing published
 * gets a real page saying so, which is itself worth previewing. The only state
 * that has no page is a store that has not been created yet, which onboarding
 * should have made impossible.
 *
 * Vacation mode is deliberately not gated either: a closed store still lists and
 * still sells, and the storefront renders its own "On vacation" banner. Hiding
 * the preview would misrepresent what customers actually get.
 */
export function StorePreview() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { locale } = useLocale();
  const { store, isLoading } = useStoreStore();

  const [device, setDevice] = useState<PreviewDevice>(useDefaultPreviewDevice());
  const [reloadToken, setReloadToken] = useState(0);

  const publicUrl = useMemo(
    () => (store?.slug ? storefrontUrl(localeStorefrontPath(storePath(store.slug), locale)) : null),
    [store?.slug, locale],
  );

  const goBack = useCallback(() => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/dashboard/account/store');
  }, [navigate]);

  if (isLoading && !store) {
    return (
      <div className="flex h-[100dvh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-background">
      <PreviewBanner
        title={store?.name ?? t('settings.storefront.title')}
        subtitle={t('settings.storefront.preview.subtitle')}
        meta={
          store && !store.isOpen ? (
            <Badge variant="secondary" className="shrink-0">
              {t('settings.storefront.status.closed')}
            </Badge>
          ) : undefined
        }
        notice={
          store && !store.isOpen ? t('settings.storefront.preview.onVacation') : undefined
        }
        device={device}
        onDeviceChange={setDevice}
        onBack={goBack}
        onRefresh={() => setReloadToken((n) => n + 1)}
        actions={
          <>
            <PreviewLinkActions url={publicUrl} />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={() => navigate('/dashboard/account/store')}
            >
              <Pencil className="size-4" />
              <span className="hidden sm:inline">{t('settings.storefront.preview.edit')}</span>
            </Button>
          </>
        }
      />

      <div className="min-h-0 flex-1">
        {publicUrl ? (
          <StorefrontFrame
            src={withPreviewParam(publicUrl)}
            device={device}
            reloadToken={reloadToken}
          />
        ) : (
          <PreviewUnavailable
            title={t('settings.storefront.preview.noStoreTitle')}
            description={t('settings.storefront.preview.noStoreHelp')}
            action={
              <Button onClick={() => navigate('/dashboard/account/store')}>
                {t('settings.storefront.preview.edit')}
              </Button>
            }
          />
        )}
      </div>
    </div>
  );
}
