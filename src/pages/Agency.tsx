import { useCallback, useEffect, useState } from 'react';
import { useParams, Navigate, useNavigate } from 'react-router-dom';
import { Loader2, Building2, ShieldCheck, MapPin } from 'lucide-react';
import { toast } from 'sonner';

import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { onboardingService } from '@/services/onboarding.service';
import { AgencyConnectionBrowser } from '@/components/delivery/AgencyConnectionBrowser';
import { ConnectionsList } from '@/components/delivery/ConnectionsList';
import { mapProfileError } from '@/components/vendor-settings/errors';
import { MobilePageHeader } from '@/components/layout/MobilePageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { useIsMobile } from '@/hooks/use-mobile';
import { fileRefUrl } from '@/services/files.service';
import { formatAgencyLocality } from '@/lib/agencyAddress';
import { cn } from '@/lib/utils';
import { type DeliveryAgency } from '@/types/api';

const VALID_TABS = ['connections', 'browse'] as const;
const DEFAULT_TAB = 'connections';

const TAB_LABELS: Record<(typeof VALID_TABS)[number], string> = {
    connections: 'Connection',
    browse: 'Browse',
};

/**
 * Agency — delivery-agency connections, promoted from a Settings sub-tab to a
 * top-level nav item. The two views (Connection / Browse) are real routes driven
 * by the sidebar sub-tabs (`/dashboard/agency/:tab`), so this page has no in-page
 * tab list — the URL segment selects the active pane.
 */
export function Agency() {
    const { tab } = useParams();
    const navigate = useNavigate();
    const isMobile = useIsMobile();
    const { session, setDeliveryAgency } = useOnboarding();
    const roleEntity = session?.role_entity;
    const currentId = roleEntity?.default_delivery_agency_id ?? null;

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

    if (!tab || !VALID_TABS.includes(tab as (typeof VALID_TABS)[number])) {
        return <Navigate to={`/dashboard/agency/${DEFAULT_TAB}`} replace />;
    }

    if (!roleEntity) return null;

    const errorBanner = error && (
        <div
            role="alert"
            className={cn(
                'text-sm bg-destructive/10 text-destructive border border-destructive/20',
                isMobile ? 'mx-4 mt-4 rounded-lg p-3' : 'p-3 rounded-lg',
            )}
        >
            {error}
        </div>
    );

    const currentDefault = (
        <div className={cn(isMobile ? 'border-b bg-muted/30 px-4 py-4' : 'rounded-lg border bg-muted/30 p-4')}>
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
                        {fileRefUrl(current.logo) ? (
                            <img src={fileRefUrl(current.logo)!} alt={current.agencyName} crossOrigin="use-credentials" className="w-full h-full object-cover" />
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
                                {formatAgencyLocality(current.headquartersAddress)}
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
    );

    const panes = (
        <Tabs value={tab} className="w-full">
            <TabsContent value="connections" className={cn('space-y-2 mt-0', isMobile && 'px-4 py-4')}>
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

            <TabsContent value="browse" className={cn('space-y-2 mt-0', isMobile && 'px-4 py-4')}>
                <p className="text-sm font-medium">Search agencies &amp; request a connection</p>
                <AgencyConnectionBrowser
                    onConnectionChange={handleConnectionChange}
                    listHeightClass="h-[48vh] min-h-[200px]"
                    scrollable={!isMobile}
                />
            </TabsContent>
        </Tabs>
    );

    // ─── Mobile: no outer card — sections run edge-to-edge, split by hairlines ──
    if (isMobile) {
        return (
            <div className="-mx-6 -mt-6">
                <MobilePageHeader
                    title="Agency"
                    subheader={
                        <div className="flex gap-2">
                            {VALID_TABS.map((t) => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => navigate(`/dashboard/agency/${t}`)}
                                    className={cn(
                                        'flex-1 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                                        tab === t
                                            ? 'border-foreground bg-foreground text-background'
                                            : 'border-border bg-background',
                                    )}
                                >
                                    {TAB_LABELS[t]}
                                </button>
                            ))}
                        </div>
                    }
                />

                <div className="pb-28">
                    {errorBanner}
                    {currentDefault}
                    {panes}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold">Agency</h1>
                <p className="text-muted-foreground">
                    Manage delivery-agency connections and choose the default that fulfils your
                    physical-product orders.
                </p>
            </div>

            <Card>
                <CardContent className="space-y-5 pt-6">
                    {errorBanner}
                    {currentDefault}
                    {panes}
                </CardContent>
            </Card>
        </div>
    );
}
