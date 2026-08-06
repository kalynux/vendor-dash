import { useEffect, useState } from 'react';
import { Truck, AlertCircle, Loader2, Gift, MapPin, Warehouse } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { fetchDefaultDeliveryAgency } from '@/services/agencies.service';
import { getActiveConnectedAgencies, getAgencyConnectionErrorMessage } from '@/services/agency-connections.service';
import { getDeliveryErrorMessage } from '@/services/products.service';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { useApiError, useMessage, useTranslation } from '@/i18n';
import type { VendorAgencyListItemDto, ApiPickupLocation, PickupLocationSource } from '@/types/product.types';

interface AgencySelectorProps {
  productId: string | null;
  productAgencyId: string | null;
  isSaving: boolean;
  onAgencyChange: (agencyId: string | null) => void | Promise<void>;
  freeDelivery: boolean;
  onFreeDeliveryChange: (freeDelivery: boolean) => void | Promise<void>;
  pickupLocation: ApiPickupLocation | null;
  onPickupLocationChange: (pickupLocation: ApiPickupLocation | null) => void | Promise<void>;
  // Called once agencies + default are loaded so parent can decide if it can
  // gate the vectorisation toggle on "no usable agency".
  onAvailabilityResolved?: (info: {
    defaultAgency: VendorAgencyListItemDto | null;
  }) => void;
}

export function AgencySelector({
  productId,
  productAgencyId,
  isSaving,
  onAgencyChange,
  freeDelivery,
  onFreeDeliveryChange,
  pickupLocation,
  onPickupLocationChange,
  onAvailabilityResolved,
}: AgencySelectorProps) {
  const { t } = useTranslation();
  const m = useMessage();
  const apiError = useApiError();
  const { session } = useOnboarding();
  const businessAddresses = session?.role_entity.business_addresses ?? [];
  const [agencies, setAgencies] = useState<VendorAgencyListItemDto[]>([]);
  const [defaultAgency, setDefaultAgency] =
    useState<VendorAgencyListItemDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const [connectedResult, defaultResult] = await Promise.all([
          getActiveConnectedAgencies(),
          fetchDefaultDeliveryAgency(),
        ]);
        if (cancelled) return;
        setAgencies(connectedResult.agencies);
        setDefaultAgency(defaultResult);
        onAvailabilityResolved?.({ defaultAgency: defaultResult });
      } catch (err: unknown) {
        if (cancelled) return;
        setLoadError('products.delivery.loadAgenciesFailed');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // We intentionally do not depend on onAvailabilityResolved — callers may
    // pass a fresh function each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The agency that will actually be used at activation time
  const effectiveAgencyId = productAgencyId ?? defaultAgency?.id ?? null;
  const effectiveAgency =
    agencies.find((a) => a.id === effectiveAgencyId) ?? defaultAgency ?? null;

  // The "selected" value in the dropdown: explicit product-level pick, or the
  // sentinel value 'default' when relying on the vendor default.
  const selectValue = productAgencyId ?? (defaultAgency ? 'default' : '');

  const noUsableAgency = !effectiveAgency;

  // The vendor's default may point at an agency whose connection was later
  // terminated — it would still resolve here (a plain read of the vendor
  // profile field) but isn't in the connection-filtered `agencies` list, so
  // relying on it would 422 at write time. Warn instead of failing silently.
  const defaultConnectionLost =
    !!defaultAgency && !agencies.some((a) => a.id === defaultAgency.id);

  // Which pickup sources the agency that will actually handle delivery
  // supports — gates which options the picker offers (see delivery-agencies.md).
  const pricing = effectiveAgency?.policies?.pricing;
  const canPickupFromAddress = pricing?.pickup_based_enabled ?? false;
  const canUseAgencyStorage = pricing?.storage_based_enabled ?? false;
  const noPickupSourcesAvailable = !!effectiveAgency && !canPickupFromAddress && !canUseAgencyStorage;

  const [localSource, setLocalSource] = useState<PickupLocationSource | ''>(
    pickupLocation?.source ?? '',
  );
  const [localAddressId, setLocalAddressId] = useState<string>(
    pickupLocation?.vendorAddressId ?? '',
  );
  const [pickupSaving, setPickupSaving] = useState(false);

  useEffect(() => {
    setLocalSource(pickupLocation?.source ?? '');
    setLocalAddressId(pickupLocation?.vendorAddressId ?? '');
  }, [pickupLocation?.source, pickupLocation?.vendorAddressId, productId]);

  async function handleChange(value: string) {
    if (!productId) return;
    try {
      if (value === 'default') {
        await onAgencyChange(null);
      } else {
        await onAgencyChange(value);
      }
    } catch (err: unknown) {
      toast.error(getAgencyConnectionErrorMessage(err));
    }
  }

  async function savePickupLocation(next: ApiPickupLocation) {
    if (!productId) return;
    setPickupSaving(true);
    try {
      await onPickupLocationChange(next);
    } catch (err: unknown) {
      toast.error(getDeliveryErrorMessage(err));
    } finally {
      setPickupSaving(false);
    }
  }

  async function handleSourceChange(value: string) {
    const source = value as PickupLocationSource;
    setLocalSource(source);
    if (source === 'agency_storage') {
      setLocalAddressId('');
      await savePickupLocation({ source, vendorAddressId: null });
    }
    // For 'vendor_address', wait until the vendor also picks an address below.
  }

  async function handleAddressChange(addressId: string) {
    setLocalAddressId(addressId);
    await savePickupLocation({ source: 'vendor_address', vendorAddressId: addressId });
  }

  async function handleFreeDeliveryToggle(checked: boolean) {
    if (!productId) return;
    try {
      await onFreeDeliveryChange(checked);
    } catch (err: unknown) {
      apiError.toast(err, { fallbackKey: 'products.errors.freeDeliveryFailed' });
    }
  }

  return (
    <div className="rounded-xl border border-border p-5 space-y-3">
      <div className="flex items-start gap-3">
        <Truck className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{t('products.delivery.agencyLabel')}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('products.delivery.agencyDescription')}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t('products.delivery.loadingAgencies')}
        </div>
      ) : loadError ? (
        <div className="flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{m(loadError)}</span>
        </div>
      ) : agencies.length === 0 && !defaultAgency ? (
        <div className="rounded-lg border border-dashed p-4 text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            {t('products.delivery.noConnections')}
          </p>
          <Button asChild size="sm" variant="outline">
            <Link to="/dashboard/agency/connections">
              {t('products.delivery.goToConnections')}
            </Link>
          </Button>
        </div>
      ) : (
        <>
          <Select
            value={selectValue}
            onValueChange={handleChange}
            disabled={isSaving || !productId}
          >
            <SelectTrigger className="w-full" data-size="default">
              <SelectValue placeholder={t('products.delivery.agencyPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {defaultAgency && (
                <SelectItem value="default">
                  {t('products.delivery.agencyDefaultNamed', { name: defaultAgency.agencyName })}
                </SelectItem>
              )}
              {agencies.map((agency) => (
                <SelectItem key={agency.id} value={agency.id}>
                  {agency.agencyName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {noUsableAgency && (
            <div className="flex items-start gap-2 text-xs text-destructive">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{t('products.delivery.noDefaultAgency')}</span>
            </div>
          )}

          {defaultConnectionLost && !productAgencyId && (
            <div className="flex items-start gap-2 text-xs text-destructive">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{t('products.delivery.defaultConnectionLost')}</span>
            </div>
          )}

          {effectiveAgency && !productAgencyId && !defaultConnectionLost && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                {t('products.delivery.usingDefaultAgency', { name: effectiveAgency.agencyName })}
              </span>
            </div>
          )}
        </>
      )}

      {/* Pickup location — where the resolved agency collects this product from */}
      {!isLoading && !loadError && (
        <div className="pt-3 border-t border-border space-y-3">
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{t('products.delivery.pickupLabel')}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('products.delivery.pickupDescription')}
              </p>
            </div>
          </div>

          {!effectiveAgency ? (
            <p className="text-xs text-muted-foreground">
              {t('products.delivery.pickupNeedsAgency')}
            </p>
          ) : noPickupSourcesAvailable ? (
            <div className="flex items-start gap-2 text-xs text-destructive">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                {t('products.delivery.pickupNoSources', { name: effectiveAgency.agencyName })}
              </span>
            </div>
          ) : (
            <>
              <Select
                value={localSource}
                onValueChange={handleSourceChange}
                disabled={isSaving || pickupSaving || !productId}
              >
                <SelectTrigger className="w-full" data-size="default">
                  <SelectValue placeholder={t('products.delivery.pickupPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {canPickupFromAddress && (
                    <SelectItem value="vendor_address">
                      {t('products.delivery.pickupFromAddress')}
                    </SelectItem>
                  )}
                  {canUseAgencyStorage && (
                    <SelectItem value="agency_storage">
                      {t('products.delivery.pickupFromAgency')}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>

              {localSource === 'vendor_address' && (
                businessAddresses.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-center space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {t('products.delivery.noAddresses')}
                    </p>
                    <Button asChild size="sm" variant="outline">
                      <Link to="/dashboard/account/addresses">
                        {t('products.delivery.goToAddresses')}
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <Select
                    value={localAddressId}
                    onValueChange={handleAddressChange}
                    disabled={isSaving || pickupSaving || !productId}
                  >
                    <SelectTrigger className="w-full" data-size="default">
                      <SelectValue placeholder={t('products.delivery.addressPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {businessAddresses.filter((addr) => !!addr._id).map((addr) => (
                        <SelectItem key={addr._id} value={addr._id as string}>
                          {addr.label ? `${addr.label} — ` : ''}
                          {addr.address_line1}, {addr.city}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )
              )}

              {localSource === 'agency_storage' && (
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Warehouse className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>
                    {t('products.delivery.pickupWarehoused', { name: effectiveAgency.agencyName })}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="flex items-start gap-3 pt-3 border-t border-border">
        <Gift className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0 flex items-center justify-between gap-3">
          <div>
            <p className="font-medium text-sm">{t('products.delivery.freeDelivery')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t('products.delivery.freeDeliveryHint')}
            </p>
          </div>
          <Switch
            checked={freeDelivery}
            onCheckedChange={handleFreeDeliveryToggle}
            disabled={isSaving || !productId}
            aria-label={t('products.delivery.freeDelivery')}
          />
        </div>
      </div>
    </div>
  );
}
