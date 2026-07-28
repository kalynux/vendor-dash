import { useParams, Navigate } from 'react-router-dom';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { PoliciesSettings } from '@/components/vendor-settings/PoliciesSettings';
import { NotificationSettings } from '@/components/vendor-settings/NotificationSettings';
import { PreferencesSettings } from '@/components/vendor-settings/PreferencesSettings';

const VALID_TABS = ['policies', 'notifications', 'preferences'] as const;
const DEFAULT_TAB = 'policies';

export function Settings() {
  const { tab } = useParams();

  if (!tab || !VALID_TABS.includes(tab as (typeof VALID_TABS)[number])) {
    return <Navigate to={`/dashboard/settings/${DEFAULT_TAB}`} replace />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Configure policies, notifications, and preferences for your store
        </p>
      </div>

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
    </div>
  );
}
