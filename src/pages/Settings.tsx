import { useParams, Navigate } from 'react-router-dom';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { PoliciesSettings } from '@/components/vendor-settings/PoliciesSettings';
import { CodTermsSettings } from '@/components/vendor-settings/CodTermsSettings';
import { PartialPaymentSettings } from '@/components/vendor-settings/PartialPaymentSettings';
import { DeliveryTermsSettings } from '@/components/vendor-settings/DeliveryTermsSettings';
import { NotificationSettings } from '@/components/vendor-settings/NotificationSettings';
import { PreferencesSettings } from '@/components/vendor-settings/PreferencesSettings';
import { ListingSettings } from '@/components/listings/ListingSettings';
import { useIsProvider } from '@/hooks/use-vendor-kind';
import { PROVIDER_SETTINGS_TABS } from '@/config/navigation';
import { SubPageHeader } from '@/components/layout/SubPageHeader';
import { MobilePageHeader } from '@/components/layout/MobilePageHeader';
import { useIsMobile } from '@/hooks/use-mobile';
import { useRouteSwipe } from '@/hooks/use-route-swipe';
import { useTranslation, type TranslationKey } from '@/i18n';

const VALID_TABS = ['policies', 'notifications', 'preferences'] as const;
/** A service provider has no policies or order rules — only these two. */
const PROVIDER_RING = PROVIDER_SETTINGS_TABS.map((tab) => `/dashboard/settings/${tab}`);

/** The same three, as routes — what a sideways swipe walks. Order matters. */
const TAB_RING = VALID_TABS.map((tab) => `/dashboard/settings/${tab}`);
const DEFAULT_TAB = 'policies';

type SettingsTab = (typeof VALID_TABS)[number] | (typeof PROVIDER_SETTINGS_TABS)[number];

/** Crumb label per tab — the sidebar's own labels, so the two always agree. */
const TAB_LABEL_KEYS: Record<SettingsTab, TranslationKey> = {
  policies: 'nav.items.policies',
  notifications: 'nav.items.notifications',
  preferences: 'nav.items.preferences',
  listings: 'nav.items.listingSettings',
};

const TAB_SUBTITLE_KEYS: Record<SettingsTab, TranslationKey> = {
  policies: 'settings.tabSubtitles.policies',
  notifications: 'settings.tabSubtitles.notifications',
  preferences: 'settings.tabSubtitles.preferences',
  listings: 'settings.tabSubtitles.listings',
};

export function Settings() {
  const { t } = useTranslation();
  const { tab } = useParams();
  const isMobile = useIsMobile();
  const isProvider = useIsProvider();
  const allowedTabs: readonly string[] = isProvider ? PROVIDER_SETTINGS_TABS : VALID_TABS;

  // Before the redirect below — a hook cannot sit behind an early return.
  useRouteSwipe(isProvider ? PROVIDER_RING : TAB_RING);

  if (!tab || !allowedTabs.includes(tab)) {
    return <Navigate to={`/dashboard/settings/${isProvider ? 'listings' : DEFAULT_TAB}`} replace />;
  }

  const activeTab = tab as SettingsTab;

  const panes = (
    <Tabs value={tab} className="w-full">
      <TabsContent value="policies" className="space-y-6">
        <PoliciesSettings />
        {/* Each its own card and its own save — never part of the policies PATCH. */}
        <DeliveryTermsSettings />
        <CodTermsSettings />
        <PartialPaymentSettings />
      </TabsContent>

      <TabsContent value="notifications" className="space-y-6">
        <NotificationSettings />
      </TabsContent>

      <TabsContent value="preferences" className="space-y-6">
        <PreferencesSettings />
      </TabsContent>

      <TabsContent value="listings" className="space-y-6">
        <ListingSettings />
      </TabsContent>
    </Tabs>
  );

  if (isMobile) {
    return (
      <div className="-mx-6 -mt-6 animate-fade-in">
        {/* Just the tab name — see the note in Account.tsx on why the "Settings ›"
            half of the crumb is dropped on a phone. */}
        <MobilePageHeader
          title={t(TAB_LABEL_KEYS[activeTab])}
          description={t(TAB_SUBTITLE_KEYS[activeTab])}
        />
        {/* `px-6` restores main's gutter; `pb-14` clears the floating save bar. */}
        <div className="px-6 pb-14 pt-4">{panes}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header — "Settings › <tab>", so the page names the surface you opened. */}
      <SubPageHeader
        parent={t('nav.items.settings')}
        current={t(TAB_LABEL_KEYS[activeTab])}
        description={t(TAB_SUBTITLE_KEYS[activeTab])}
      />
      {panes}
    </div>
  );
}
