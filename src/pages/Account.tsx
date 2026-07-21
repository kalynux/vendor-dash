import { useParams, Navigate } from 'react-router-dom';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { BillingTab } from '@/components/billing/BillingTab';
import { ProfileSettings } from '@/components/vendor-settings/ProfileSettings';
import { SecuritySettings } from '@/components/vendor-settings/SecuritySettings';
import { BrandingSettings } from '@/components/vendor-settings/BrandingSettings';
import { PayoutSetupSettings } from '@/components/vendor-settings/PayoutSetupSettings';
import { EarningsSummaryCard } from '@/components/vendor-settings/EarningsSummaryCard';
import { StorefrontSettings } from '@/components/vendor-settings/StorefrontSettings';
import { StoreRegionFields } from '@/components/vendor-settings/StoreRegionFields';
import { BusinessAddressSettings } from '@/components/vendor-settings/BusinessAddressSettings';

const VALID_TABS = ['profile', 'store', 'branding', 'security', 'billing', 'payout'] as const;
const DEFAULT_TAB = 'profile';

export function Account() {
  const { tab } = useParams();

  if (!tab || !VALID_TABS.includes(tab as (typeof VALID_TABS)[number])) {
    return <Navigate to={`/dashboard/account/${DEFAULT_TAB}`} replace />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Account</h1>
        <p className="text-muted-foreground">
          Manage your personal account, store identity, and payouts
        </p>
      </div>

      <Tabs value={tab} className="w-full">
        <TabsContent value="profile" className="space-y-6">
          <ProfileSettings />
        </TabsContent>

        <TabsContent value="store" className="space-y-6">
          <StorefrontSettings />
          <StoreRegionFields />
          <BusinessAddressSettings />
        </TabsContent>

        <TabsContent value="branding" className="space-y-6">
          <BrandingSettings />
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <SecuritySettings />
        </TabsContent>

        <TabsContent value="billing" className="space-y-6">
          <BillingTab />
        </TabsContent>

        <TabsContent value="payout" className="space-y-6">
          <EarningsSummaryCard />
          <PayoutSetupSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
