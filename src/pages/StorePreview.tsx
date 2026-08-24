import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  PreviewBanner,
  PreviewUnavailable,
  StorefrontFrame,
  useDefaultPreviewDevice,
  usePreviewBack,
  usePreviewLinkActions,
  type PreviewAction,
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

  const goBack = usePreviewBack('/dashboard/account/store');

  const linkActions = usePreviewLinkActions({ url: publicUrl });

  const actions: PreviewAction[] = [
    {
      id: 'edit',
      icon: Pencil,
      label: t('settings.storefront.preview.edit'),
      onClick: () => navigate('/dashboard/account/store'),
      emphasis: 'outline',
    },
    ...linkActions,
  ];

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
        actions={actions}
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
