import { useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
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
import { MobilePageHeader, type MobileHeaderAction } from '@/components/layout/MobilePageHeader';
import { SignOutDialog } from '@/components/layout/SignOutDialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { useRouteSwipe } from '@/hooks/use-route-swipe';
import { useTranslation, type TranslationKey } from '@/i18n';

const VALID_TABS = ['profile', 'store', 'addresses', 'security', 'billing', 'payout'] as const;

/** The same six, as routes — what a sideways swipe walks. Order matters. */
const TAB_RING = VALID_TABS.map((tab) => `/dashboard/account/${tab}`);
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
  const isMobile = useIsMobile();
  const [signOutOpen, setSignOutOpen] = useState(false);

  // Before the redirects below — a hook cannot sit behind an early return.
  useRouteSwipe(TAB_RING);

  // Branding merged into the Store tab — keep old links/bookmarks working.
  if (tab === 'branding') {
    return <Navigate to="/dashboard/account/store" replace />;
  }

  if (!tab || !VALID_TABS.includes(tab as AccountTab)) {
    return <Navigate to={`/dashboard/account/${DEFAULT_TAB}`} replace />;
  }

  const activeTab = tab as AccountTab;

  /**
   * Sign out lives here, on Profile, and only on Profile.
   *
   * A packaged app has no browser chrome and no desktop header, so until this
   * existed there was **no way to sign out on a phone at all**. Profile is where
   * people look for it — it is the screen that is about *them* rather than about
   * the store — and putting it on all six Account tabs would make it six times
   * as easy to hit by accident for no extra discoverability.
   */
  const actions: MobileHeaderAction[] =
    activeTab === 'profile'
      ? [{
        id: 'sign-out',
        icon: LogOut,
        label: t('nav.header.logout'),
        onClick: () => setSignOutOpen(true),
        destructive: true,
      }]
      : [];

  const panes = (
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
  );

  if (isMobile) {
    return (
      <div className="-mx-6 -mt-6 animate-fade-in">
        {/* The crumb collapses to just the tab name: "Account ›" is redundant
            when the only way onto this screen is through the Account menu, and
            the room it costs is room the sign-out button needs. */}
        <MobilePageHeader
          title={t(TAB_LABEL_KEYS[activeTab])}
          description={t(TAB_SUBTITLE_KEYS[activeTab])}
          actions={actions}
        />
        {/* `px-6` restores exactly the gutter `main` gives every other screen —
            the settings sections are laid out against it. `pb-14` is clearance
            for the floating save bar, which would otherwise cover the last
            field on the tab. */}
        <div className="px-6 pb-14 pt-4">{panes}</div>
        <SignOutDialog open={signOutOpen} onOpenChange={setSignOutOpen} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header — "Account › <tab>", so the page names the surface you opened. */}
      <SubPageHeader
        parent={t('nav.items.account')}
        current={t(TAB_LABEL_KEYS[activeTab])}
        description={t(TAB_SUBTITLE_KEYS[activeTab])}
      />
      {panes}
    </div>
  );
}
