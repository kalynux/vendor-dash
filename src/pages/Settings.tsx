import { SlidersHorizontal } from 'lucide-react';
import { useParams, Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { DeliverySettings } from '@/components/vendor-settings/DeliverySettings';
import { PoliciesSettings } from '@/components/vendor-settings/PoliciesSettings';
import { NotificationSettings } from '@/components/vendor-settings/NotificationSettings';

const VALID_TABS = ['delivery', 'policies', 'notifications', 'preferences'] as const;
const DEFAULT_TAB = 'delivery';

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
          Configure delivery, policies, and notifications for your store
        </p>
      </div>

      <Tabs value={tab} className="w-full">
        <TabsContent value="delivery" className="space-y-6">
          <DeliverySettings />
        </TabsContent>

        <TabsContent value="policies" className="space-y-6">
          <PoliciesSettings />
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <NotificationSettings />
        </TabsContent>

        <TabsContent value="preferences" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Preferences</CardTitle>
              <CardDescription>Personalize your dashboard experience</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <SlidersHorizontal className="w-10 h-10 mb-3 opacity-40" />
                <p className="font-medium">Coming soon</p>
                <p className="text-sm">Preferences aren&apos;t available yet.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
