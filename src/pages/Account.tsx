import { useParams, Navigate } from 'react-router-dom';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { BillingTab } from '@/components/billing/BillingTab';
import { ProfileSettings } from '@/components/vendor-settings/ProfileSettings';
import { SecuritySettings } from '@/components/vendor-settings/SecuritySettings';
import { PayoutSetupSettings } from '@/components/vendor-settings/PayoutSetupSettings';
import { EarningsSummaryCard } from '@/components/vendor-settings/EarningsSummaryCard';
import { StorefrontSettings } from '@/components/vendor-settings/StorefrontSettings';
import { BusinessAddressSettings } from '@/components/vendor-settings/BusinessAddressSettings';
import { SettingsSections } from '@/components/vendor-settings/SettingsSection';
import { SubPageHeader } from '@/components/layout/SubPageHeader';
import { useTranslation, type TranslationKey } from '@/i18n';

const VALID_TABS = ['profile', 'store', 'addresses', 'security', 'billing', 'payout'] as const;
const DEFAULT_TAB = 'profile';

type AccountTab = (typeof VALID_TABS)[number];

/** Crumb label per tab — the sidebar's own labels, so the two always agree. */
const TAB_LABEL_KEYS: Record<AccountTab, TranslationKey> = {
  profile: 'nav.items.profile',
  store: 'nav.items.store',
  addresses: 'nav.items.addresses',
  security: 'nav.items.security',
  billing: 'nav.items.billing',
  payout: 'nav.items.payout',
};

const TAB_SUBTITLE_KEYS: Record<AccountTab, TranslationKey> = {
  profile: 'account.tabSubtitles.profile',
  store: 'account.tabSubtitles.store',
  addresses: 'account.tabSubtitles.addresses',
  security: 'account.tabSubtitles.security',
  billing: 'account.tabSubtitles.billing',
  payout: 'account.tabSubtitles.payout',
};

export function Account() {
  const { t } = useTranslation();
  const { tab } = useParams();

  // Branding merged into the Store tab — keep old links/bookmarks working.
  if (tab === 'branding') {
    return <Navigate to="/dashboard/account/store" replace />;
  }

  if (!tab || !VALID_TABS.includes(tab as AccountTab)) {
    return <Navigate to={`/dashboard/account/${DEFAULT_TAB}`} replace />;
  }

  const activeTab = tab as AccountTab;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header — "Account › <tab>", so the page names the surface you opened. */}
      <SubPageHeader
        parent={t('nav.items.account')}
        current={t(TAB_LABEL_KEYS[activeTab])}
        description={t(TAB_SUBTITLE_KEYS[activeTab])}
      />

      <Tabs value={tab} className="w-full">
        <TabsContent value="profile" className="space-y-6">
          <ProfileSettings />
        </TabsContent>

        <TabsContent value="store" className="space-y-6">
          <StorefrontSettings />
        </TabsContent>

        <TabsContent value="addresses" className="space-y-6">
          <BusinessAddressSettings />
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <SecuritySettings />
        </TabsContent>

        <TabsContent value="billing" className="space-y-6">
          <BillingTab />
        </TabsContent>

        <TabsContent value="payout">
          {/* One flow: on mobile Earnings and Payout Setup are separated by a
              rule instead of each sitting in its own card. */}
          <SettingsSections>
            <EarningsSummaryCard />
            <PayoutSetupSettings />
          </SettingsSections>
        </TabsContent>
      </Tabs>
    </div>
  );
}
