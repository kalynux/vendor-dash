import { useEffect, useMemo, useState } from 'react';
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
import { InfoHint } from '@/components/ui/info-hint';
import { fetchAgencyLocations, fetchDefaultDeliveryAgency } from '@/services/agencies.service';
import { getActiveConnectedAgencies, getAgencyConnectionErrorMessage } from '@/services/agency-connections.service';
import { getDeliveryErrorMessage } from '@/services/products.service';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { formatAgencyLocationLocality } from '@/lib/agencyAddress';
import { cn } from '@/lib/utils';
import { useApiError, useMessage, useTranslation } from '@/i18n';
import type {
  VendorAgencyListItemDto,
  AgencyLocationDto,
  ApiPickupLocation,
  ApiProductPickup,
  PickupLocationSource,
} from '@/types/product.types';

/**
 * Select value standing in for `agencyAddressId: null` — "the agency's primary
 * depot", which is a real choice and not an absence. We deliberately never
 * store the primary's *id*: null follows the primary if the agency reorders its
 * locations, whereas the id pins that one depot. See the note on
 * `ApiPickupLocation.agencyAddressId`.
 */
const PRIMARY_DEPOT = '__primary__';

interface AgencySelectorProps {
  productId: string | null;
  productAgencyId: string | null;
  isSaving: boolean;
  onAgencyChange: (agencyId: string | null) => void | Promise<void>;
  freeDelivery: boolean;
  onFreeDeliveryChange: (freeDelivery: boolean) => void | Promise<void>;
  pickupLocation: ApiPickupLocation | null;
  onPickupLocationChange: (pickupLocation: ApiPickupLocation | null) => void | Promise<void>;
  /**
   * The server-resolved mirror of `pickupLocation` (product detail only). Used
   * solely to warn when what is stored no longer resolves — a deleted business
   * address, or a depot the agency has since removed and silently fell back to
   * the primary for. Optional: surfaces nothing when absent.
   */
  pickup?: ApiProductPickup | null;
  /**
   * Active variants that currently have UNLIMITED stock.
   *
   * A warehouse holds a countable number of things, so `agency_storage` and
   * `isInfiniteStock` are mutually exclusive — the backend refuses the pair with
   * `422 CATALOG_PRODUCT_AGENCY_STORAGE_INFINITE_STOCK`, and it is an activation
   * blocker on the product too.
   *
   * Pass the PERSISTED state, plus (for the simple editor, where the switch and
   * this picker share a screen) the live switch value — that is what the backend
   * judges the write against.
   */
  unlimitedStockVariants?: { id: string; sku: string }[];
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
  pickup,
  unlimitedStockVariants,
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
      } catch {
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
  // `null` agencyAddressId is a choice ("the primary depot"), so it maps to the
  // sentinel rather than to an empty selection.
  const [localDepotId, setLocalDepotId] = useState<string>(
    pickupLocation?.agencyAddressId ?? PRIMARY_DEPOT,
  );
  const [pickupSaving, setPickupSaving] = useState(false);

  useEffect(() => {
    setLocalSource(pickupLocation?.source ?? '');
    setLocalAddressId(pickupLocation?.vendorAddressId ?? '');
    setLocalDepotId(pickupLocation?.agencyAddressId ?? PRIMARY_DEPOT);
  }, [
    pickupLocation?.source,
    pickupLocation?.vendorAddressId,
    pickupLocation?.agencyAddressId,
    productId,
  ]);

  // The agency's depots, for the "which warehouse?" picker. Only fetched once
  // the vendor actually picks agency storage — the endpoint is connection-gated
  // and irrelevant until then. `effectiveAgency` may be the vendor's default
  // whose connection has since lapsed, in which case the call would 422; that
  // case already renders `defaultConnectionLost` above, so we simply degrade to
  // "no picker" instead of surfacing a second error.
  const [depots, setDepots] = useState<AgencyLocationDto[]>([]);
  const [depotsLoading, setDepotsLoading] = useState(false);
  const [depotsFailed, setDepotsFailed] = useState(false);

  useEffect(() => {
    if (localSource !== 'agency_storage' || !effectiveAgencyId) {
      setDepots([]);
      setDepotsFailed(false);
      return;
    }
    let cancelled = false;
    setDepotsLoading(true);
    setDepotsFailed(false);
    fetchAgencyLocations(effectiveAgencyId)
      .then((locations) => {
        if (!cancelled) setDepots(locations);
      })
      .catch(() => {
        if (!cancelled) {
          setDepots([]);
          setDepotsFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) setDepotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [localSource, effectiveAgencyId]);

  // `label` is null on entries saved before the agency could name them, so fall
  // back to "Primary Headquarters" / "Branch N" — numbering branches by their
  // rank among non-primary entries rather than by array index, which would read
  // "Branch 2" for the first branch.
  const depotOptions = useMemo(() => {
    let branchNumber = 0;
    return depots.map((depot) => {
      if (!depot.isPrimary) branchNumber += 1;
      const name =
        depot.label?.trim() ||
        (depot.isPrimary
          ? t('products.delivery.depotPrimaryName')
          : t('products.delivery.depotBranchName', { number: branchNumber }));
      const suffix = depot.isPrimary ? ` (${t('products.delivery.depotDefaultSuffix')})` : '';
      return {
        key: depot.id,
        // The primary is offered as the sentinel, never as its own id — see
        // PRIMARY_DEPOT.
        value: depot.isPrimary ? PRIMARY_DEPOT : depot.id,
        label: `${name} — ${formatAgencyLocationLocality(depot)}${suffix}`,
      };
    });
  }, [depots, t]);

  // A warehouse cannot hold an unbounded quantity, so agency storage is not
  // offerable while any active variant is unlimited. Note this is NOT a
  // `stock > 0` rule — a warehoused product may legitimately sit at zero.
  const blockedByInfinite = (unlimitedStockVariants?.length ?? 0) > 0;
  const blockedSkus = useMemo(() => {
    const list = unlimitedStockVariants ?? [];
    const shown = list.slice(0, 3).map((v) => v.sku).join(', ');
    // The backend's `details.variants` is an array and cannot interpolate, so
    // the sentence is assembled here.
    return list.length > 3
      ? t('products.delivery.storageSkusMore', { skus: shown, count: list.length - 3 })
      : shown;
  }, [unlimitedStockVariants, t]);
  const alreadyWarehoused = pickupLocation?.source === 'agency_storage';

  // A depot the agency deleted, or a business address the vendor deleted: the
  // stored id no longer resolves and the backend is standing something else in.
  const depotFellBackToPrimary =
    pickup?.source === 'agency_storage' &&
    pickup.isPrimaryFallback &&
    !!pickup.agencyAddressId;
  const vendorAddressMissing = pickup?.source === 'vendor_address' && !pickup.address;

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
      // Revert the picker: leaving it showing a value the server rejected is
      // the same lie as an optimistic success.
      setLocalSource(pickupLocation?.source ?? '');
      setLocalAddressId(pickupLocation?.vendorAddressId ?? '');
      setLocalDepotId(pickupLocation?.agencyAddressId ?? PRIMARY_DEPOT);
      toast.error(getDeliveryErrorMessage(err));
    } finally {
      setPickupSaving(false);
    }
  }

  async function handleSourceChange(value: string) {
    const source = value as PickupLocationSource;
    // Hard guard so a keyboard or AT path can't get past the disabled option.
    if (source === 'agency_storage' && blockedByInfinite) {
      toast.error(t('products.delivery.storageNeedsCountableStock', { skus: blockedSkus }));
      return;
    }
    setLocalSource(source);
    if (source === 'agency_storage') {
      setLocalAddressId('');
      setLocalDepotId(PRIMARY_DEPOT);
      // `agencyAddressId` is left null on purpose — the vendor has not chosen a
      // depot yet, and null means "the primary", which is publishable as-is.
      await savePickupLocation({ source, vendorAddressId: null, agencyAddressId: null });
    }
    // For 'vendor_address', wait until the vendor also picks an address below.
  }

  async function handleAddressChange(addressId: string) {
    setLocalAddressId(addressId);
    await savePickupLocation({ source: 'vendor_address', vendorAddressId: addressId });
  }

  async function handleDepotChange(value: string) {
    setLocalDepotId(value);
    await savePickupLocation({
      source: 'agency_storage',
      vendorAddressId: null,
      agencyAddressId: value === PRIMARY_DEPOT ? null : value,
    });
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
                    // Kept rendered but disabled: removing it would read as
                    // "this agency doesn't offer warehousing", which is a
                    // different and wrong message — that case is
                    // `canUseAgencyStorage` above.
                    <SelectItem
                      value="agency_storage"
                      disabled={blockedByInfinite && !alreadyWarehoused}
                    >
                      {t('products.delivery.pickupFromAgency')}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>

              {blockedByInfinite && canUseAgencyStorage && (
                // Two different situations. Not yet warehoused → the option is
                // simply unavailable. Already warehoused → the product predates
                // the rule and stays live until something revalidates it, so
                // warn rather than disable.
                <div
                  className={cn(
                    'flex items-start gap-2 text-xs',
                    alreadyWarehoused ? 'text-destructive' : 'text-amber-600',
                  )}
                >
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>
                    {alreadyWarehoused
                      ? t('products.delivery.storageInfiniteLive', { skus: blockedSkus })
                      : t('products.delivery.storageNeedsCountableStock', { skus: blockedSkus })}
                  </span>
                </div>
              )}

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

              {localSource === 'vendor_address' && vendorAddressMissing && (
                <div className="flex items-start gap-2 text-xs text-destructive">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>{t('products.delivery.pickupAddressMissing')}</span>
                </div>
              )}

              {localSource === 'agency_storage' && (
                <>
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Warehouse className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>
                      {t('products.delivery.pickupWarehoused', { name: effectiveAgency.agencyName })}
                    </span>
                  </div>

                  {/* Which depot. An agency commonly runs several; the primary
                      is the default, so this never blocks publishing. */}
                  {depotsLoading ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      {t('products.delivery.loadingDepots')}
                    </div>
                  ) : depotsFailed ? (
                    <p className="text-xs text-muted-foreground">
                      {t('products.delivery.depotsUnavailable')}
                    </p>
                  ) : depots.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {t('products.delivery.noDepots', { name: effectiveAgency.agencyName })}
                    </p>
                  ) : (
                    <>
                      <Select
                        value={localDepotId}
                        onValueChange={handleDepotChange}
                        disabled={isSaving || pickupSaving || !productId}
                      >
                        <SelectTrigger className="w-full" data-size="default">
                          <SelectValue placeholder={t('products.delivery.depotPlaceholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          {depotOptions.map((depot) => (
                            <SelectItem key={depot.key} value={depot.value}>
                              {depot.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {depotFellBackToPrimary && (
                        <div className="flex items-start gap-2 text-xs text-destructive">
                          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                          <span>{t('products.delivery.depotRemoved')}</span>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}

      <div className="flex items-start gap-3 pt-3 border-t border-border">
        <Gift className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
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

          {/* Turning this off does not move the fee onto the customer — nothing on
              the platform can, because delivery is never billed at checkout. It
              moves the fee into the *price*, which is a decision about how this
              product will look next to competing listings, so it is stated the
              moment the switch flips rather than discovered later. */}
          {!freeDelivery && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-700 dark:text-amber-400">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <p className="min-w-0">
                {t('products.delivery.freeDeliveryOffNotice')}
                <InfoHint
                  label={t('products.delivery.freeDeliveryExplainerLabel')}
                  align="start"
                  className="ml-1 inline-flex translate-y-[3px] text-amber-700/80 hover:text-amber-800 dark:text-amber-400/80 dark:hover:text-amber-300"
                >
                  <span className="block space-y-2">
                    <span className="block font-medium text-foreground">
                      {t('products.delivery.freeDeliveryExplainerTitle')}
                    </span>
                    <span className="block">{t('products.delivery.freeDeliveryExplainerBody')}</span>
                  </span>
                </InfoHint>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
