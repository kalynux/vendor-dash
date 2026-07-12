import { useCallback, useEffect, useState } from 'react';
import { Loader2, Building2, ShieldCheck, MapPin } from 'lucide-react';
import { toast } from 'sonner';

import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { onboardingService } from '@/services/onboarding.service';
import { AgencyConnectionBrowser } from '@/components/delivery/AgencyConnectionBrowser';
import { ConnectionsList } from '@/components/delivery/ConnectionsList';
import { mapProfileError } from '@/components/vendor-settings/errors';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { type DeliveryAgency } from '@/types/api';

export function DeliverySettings() {
    const { session, setDeliveryAgency } = useOnboarding();
    const roleEntity = session?.role_entity;
    const currentId = roleEntity?.default_delivery_agency_id ?? null;

    const [tab, setTab] = useState<'connections' | 'browse'>('connections');
    const [current, setCurrent] = useState<DeliveryAgency | null>(null);
    const [loadingCurrent, setLoadingCurrent] = useState(true);
    const [settingDefaultAgencyId, setSettingDefaultAgencyId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    // Bumped after any successful connection mutation so the "current default"
    // summary self-corrects (e.g. a first-ever approval silently sets
    // default_delivery_agency_id with no signal in the mutation response).
    const [refreshKey, setRefreshKey] = useState(0);

    const loadCurrent = useCallback(() => {
        setLoadingCurrent(true);
        return onboardingService
            .getDefaultDeliveryAgency()
            .then((res) => setCurrent(res.data))
            .catch(() => setCurrent(null))
            .finally(() => setLoadingCurrent(false));
    }, []);

    useEffect(() => {
        loadCurrent();
    }, [loadCurrent, currentId, refreshKey]);

    const handleConnectionChange = useCallback(() => {
        setRefreshKey((k) => k + 1);
    }, []);

    const handleSetDefault = useCallback(
        async (agencyId: string) => {
            setSettingDefaultAgencyId(agencyId);
            setError(null);
            try {
                const { message, reassignedOrderItems } = await setDeliveryAgency(agencyId);
                toast.success(
                    message ??
                        (reassignedOrderItems > 0
                            ? `Default agency updated — ${reassignedOrderItems} order item(s) reassigned.`
                            : 'Default agency updated'),
                );
                setRefreshKey((k) => k + 1);
            } catch (err) {
                setError(mapProfileError(err));
            } finally {
                setSettingDefaultAgencyId(null);
            }
        },
        [setDeliveryAgency],
    );

    if (!roleEntity) return null;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Delivery</CardTitle>
                <CardDescription>
                    Manage delivery-agency connections and choose the default that fulfils your
                    physical-product orders.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
                {error && (
                    <div
                        role="alert"
                        className="p-3 text-sm bg-destructive/10 text-destructive rounded-lg border border-destructive/20"
                    >
                        {error}
                    </div>
                )}

                {/* Current selection */}
                <div className="rounded-lg border bg-muted/30 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                        Current default
                    </p>
                    {loadingCurrent ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                        </div>
                    ) : current ? (
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-background border flex items-center justify-center overflow-hidden flex-shrink-0">
                                {current.logoUrl ? (
                                    <img src={current.logoUrl} alt={current.agencyName} className="w-full h-full object-cover" />
                                ) : (
                                    <Building2 className="w-5 h-5 text-muted-foreground" />
                                )}
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-semibold flex items-center gap-1.5 truncate">
                                    {current.agencyName}
                                    {current.kycVerified && <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />}
                                </p>
                                {current.headquartersAddress && (
                                    <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                                        <MapPin className="w-3 h-3 flex-shrink-0" />
                                        {current.headquartersAddress.city}, {current.headquartersAddress.region}
                                    </p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            No delivery agency set. Your first approved connection automatically becomes
                            your default — service-only vendors can leave this empty.
                        </p>
                    )}
                </div>

                <Tabs value={tab} onValueChange={(v) => setTab(v as 'connections' | 'browse')}>
                    <TabsList>
                        <TabsTrigger value="connections">Connections</TabsTrigger>
                        <TabsTrigger value="browse">Browse</TabsTrigger>
                    </TabsList>

                    <TabsContent value="connections" className="space-y-2 pt-4">
                        <p className="text-sm font-medium">Your connections</p>
                        <p className="text-xs text-muted-foreground">
                            Your first active connection becomes the default automatically — switch it
                            at any time with "Set as default" below.
                        </p>
                        <ConnectionsList
                            onConnectionChange={handleConnectionChange}
                            defaultAgencyId={currentId}
                            onSetDefault={handleSetDefault}
                            settingDefaultAgencyId={settingDefaultAgencyId}
                        />
                    </TabsContent>

                    <TabsContent value="browse" className="space-y-2 pt-4">
                        <p className="text-sm font-medium">Search agencies &amp; request a connection</p>
                        <AgencyConnectionBrowser
                            onConnectionChange={handleConnectionChange}
                            listHeightClass="h-[48vh] min-h-[200px]"
                        />
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}
