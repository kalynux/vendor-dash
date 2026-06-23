import { useCallback, useEffect, useState } from 'react';
import { Loader2, Save, Trash2, Building2, ShieldCheck, MapPin } from 'lucide-react';
import { toast } from 'sonner';

import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { onboardingService } from '@/services/onboarding.service';
import { AgencyBrowser } from '@/components/vendor-settings/delivery/AgencyBrowser';
import { mapProfileError } from '@/components/vendor-settings/errors';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { type DeliveryAgency } from '@/types/api';

export function DeliverySettings() {
    const { session, setDeliveryAgency, clearDeliveryAgency } = useOnboarding();
    const roleEntity = session?.role_entity;
    const currentId = roleEntity?.default_delivery_agency_id ?? null;

    const [selectedId, setSelectedId] = useState<string | null>(currentId);
    const [current, setCurrent] = useState<DeliveryAgency | null>(null);
    const [loadingCurrent, setLoadingCurrent] = useState(true);
    const [saving, setSaving] = useState(false);
    const [clearing, setClearing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Keep local selection in sync with the latest stored value.
    useEffect(() => {
        setSelectedId(currentId);
    }, [currentId]);

    // Load the current agency's display details.
    useEffect(() => {
        let active = true;
        setLoadingCurrent(true);
        onboardingService
            .getDefaultDeliveryAgency()
            .then((res) => { if (active) setCurrent(res.data); })
            .catch(() => { if (active) setCurrent(null); })
            .finally(() => { if (active) setLoadingCurrent(false); });
        return () => { active = false; };
    }, [currentId]);

    const handleSave = useCallback(async () => {
        if (!selectedId) return;
        setSaving(true);
        setError(null);
        try {
            await setDeliveryAgency(selectedId);
            toast.success('Delivery agency updated');
        } catch (err) {
            setError(mapProfileError(err));
        } finally {
            setSaving(false);
        }
    }, [selectedId, setDeliveryAgency]);

    const handleClear = useCallback(async () => {
        setClearing(true);
        setError(null);
        try {
            await clearDeliveryAgency();
            setSelectedId(null);
            setCurrent(null);
            toast.success('Delivery agency cleared');
        } catch (err) {
            setError(mapProfileError(err));
        } finally {
            setClearing(false);
        }
    }, [clearDeliveryAgency]);

    if (!roleEntity) return null;

    const dirty = selectedId !== null && selectedId !== currentId;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Delivery</CardTitle>
                <CardDescription>
                    The default delivery agency that fulfils your physical-product orders.
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
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleClear}
                                disabled={clearing || saving}
                                className="ml-auto gap-1.5 text-destructive hover:text-destructive"
                            >
                                {clearing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                Clear
                            </Button>
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            No delivery agency set. Service-only vendors can leave this empty.
                        </p>
                    )}
                </div>

                {/* Browser */}
                <div className="space-y-2">
                    <p className="text-sm font-medium">Choose a delivery agency</p>
                    <AgencyBrowser selectedId={selectedId} onSelect={setSelectedId} listHeightClass="h-[48vh] min-h-[200px]" />
                </div>

                <div className="flex justify-end border-t pt-4">
                    <Button type="button" onClick={handleSave} disabled={!dirty || saving} className="gap-2">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Changes
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
