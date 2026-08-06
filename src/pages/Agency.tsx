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
import { SubPageHeader } from '@/components/layout/SubPageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { useIsMobile } from '@/hooks/use-mobile';
import { fileRefUrl } from '@/services/files.service';
import { formatAgencyLocality } from '@/lib/agencyAddress';
import { cn } from '@/lib/utils';
import { type DeliveryAgency } from '@/types/api';
import { useTranslation, type TranslationKey } from '@/i18n';

const VALID_TABS = ['connections', 'browse'] as const;
const DEFAULT_TAB = 'connections';

type AgencyTab = (typeof VALID_TABS)[number];

/** Crumb label per tab — the sidebar's own labels, so the two always agree. */
const TAB_LABEL_KEYS: Record<AgencyTab, TranslationKey> = {
    connections: 'nav.items.connection',
    browse: 'nav.items.browse',
};

const TAB_SUBTITLE_KEYS: Record<AgencyTab, TranslationKey> = {
    connections: 'agency.tabSubtitles.connections',
    browse: 'agency.tabSubtitles.browse',
};

/**
 * Agency — delivery-agency connections, promoted from a Settings sub-tab to a
 * top-level nav item. The two views (Connection / Browse) are real routes driven
 * by the sidebar sub-tabs (`/dashboard/agency/:tab`), so this page has no in-page
 * tab list — the URL segment selects the active pane.
 */
export function Agency() {
  const { t } = useTranslation();
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
                // The backend's `message` is developer-facing English — resolve our own.
                const { reassignedOrderItems } = await setDeliveryAgency(agencyId);
                toast.success(
                    reassignedOrderItems > 0
                        ? `${t('agency.toast.defaultSet')} — ${t('agency.toast.itemsReassigned', { count: reassignedOrderItems })}`
                        : t('agency.toast.defaultSet'),
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

    if (!tab || !VALID_TABS.includes(tab as AgencyTab)) {
        return <Navigate to={`/dashboard/agency/${DEFAULT_TAB}`} replace />;
    }

    if (!roleEntity) return null;

    const activeTab = tab as AgencyTab;

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
                {t('agency.page.currentDefault')}
            </p>
            {loadingCurrent ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" /> {t('common.states.loading')}
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
                <p className="text-sm text-muted-foreground">{t('agency.page.noDefault')}</p>
            )}
        </div>
    );

    const panes = (
        <Tabs value={tab} className="w-full">
            <TabsContent value="connections" className={cn('space-y-2 mt-0', isMobile && 'px-4 py-4')}>
                <p className="text-sm font-medium">{t('agency.page.connectionsTitle')}</p>
                <p className="text-xs text-muted-foreground">{t('agency.page.connectionsHint')}</p>
                <ConnectionsList
                    onConnectionChange={handleConnectionChange}
                    defaultAgencyId={currentId}
                    onSetDefault={handleSetDefault}
                    settingDefaultAgencyId={settingDefaultAgencyId}
                />
            </TabsContent>

            <TabsContent value="browse" className={cn('space-y-2 mt-0', isMobile && 'px-4 py-4')}>
                <p className="text-sm font-medium">{t('agency.page.browseTitle')}</p>
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
                    title={t(TAB_LABEL_KEYS[activeTab])}
                    subheader={
                        <div className="flex gap-2">
                            {VALID_TABS.map((value) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => navigate(`/dashboard/agency/${value}`)}
                                    className={cn(
                                        'flex-1 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                                        activeTab === value
                                            ? 'border-foreground bg-foreground text-background'
                                            : 'border-border bg-background',
                                    )}
                                >
                                    {t(TAB_LABEL_KEYS[value])}
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
            {/* Header — "Agency › <tab>", so the page names the surface you opened. */}
            <SubPageHeader
                parent={t('nav.items.agency')}
                current={t(TAB_LABEL_KEYS[activeTab])}
                description={t(TAB_SUBTITLE_KEYS[activeTab])}
            />

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
