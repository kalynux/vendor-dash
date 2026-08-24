import { useParams, Navigate } from 'react-router-dom';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { PoliciesSettings } from '@/components/vendor-settings/PoliciesSettings';
import { NotificationSettings } from '@/components/vendor-settings/NotificationSettings';
import { PreferencesSettings } from '@/components/vendor-settings/PreferencesSettings';
import { SubPageHeader } from '@/components/layout/SubPageHeader';
import { MobilePageHeader } from '@/components/layout/MobilePageHeader';
import { useIsMobile } from '@/hooks/use-mobile';
import { useRouteSwipe } from '@/hooks/use-route-swipe';
import { useTranslation, type TranslationKey } from '@/i18n';

const VALID_TABS = ['policies', 'notifications', 'preferences'] as const;

/** The same three, as routes — what a sideways swipe walks. Order matters. */
const TAB_RING = VALID_TABS.map((tab) => `/dashboard/settings/${tab}`);
const DEFAULT_TAB = 'policies';

type SettingsTab = (typeof VALID_TABS)[number];

/** Crumb label per tab — the sidebar's own labels, so the two always agree. */
const TAB_LABEL_KEYS: Record<SettingsTab, TranslationKey> = {
  policies: 'nav.items.policies',
  notifications: 'nav.items.notifications',
  preferences: 'nav.items.preferences',
};

const TAB_SUBTITLE_KEYS: Record<SettingsTab, TranslationKey> = {
  policies: 'settings.tabSubtitles.policies',
  notifications: 'settings.tabSubtitles.notifications',
  preferences: 'settings.tabSubtitles.preferences',
};

export function Settings() {
  const { t } = useTranslation();
  const { tab } = useParams();
  const isMobile = useIsMobile();

  // Before the redirect below — a hook cannot sit behind an early return.
  useRouteSwipe(TAB_RING);

  if (!tab || !VALID_TABS.includes(tab as SettingsTab)) {
    return <Navigate to={`/dashboard/settings/${DEFAULT_TAB}`} replace />;
  }

  const activeTab = tab as SettingsTab;

  const panes = (
    <Tabs value={tab} className="w-full">
      <TabsContent value="policies" className="space-y-6">
        <PoliciesSettings />
      </TabsContent>

      <TabsContent value="notifications" className="space-y-6">
        <NotificationSettings />
      </TabsContent>

      <TabsContent value="preferences" className="space-y-6">
        <PreferencesSettings />
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
