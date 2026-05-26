import { useEffect, useState } from 'react';
import { Truck, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  fetchDeliveryAgencies,
  fetchDefaultDeliveryAgency,
} from '@/services/agencies.service';
import { ApiError } from '@/types/api';
import type { VendorAgencyListItemDto } from '@/types/product.types';

interface AgencySelectorProps {
  productId: string | null;
  productAgencyId: string | null;
  isSaving: boolean;
  onAgencyChange: (agencyId: string | null) => void | Promise<void>;
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
  onAvailabilityResolved,
}: AgencySelectorProps) {
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
        const [agencyResult, defaultResult] = await Promise.all([
          fetchDeliveryAgencies({ limit: 50 }),
          fetchDefaultDeliveryAgency(),
        ]);
        if (cancelled) return;
        setAgencies(agencyResult.data);
        setDefaultAgency(defaultResult);
        onAvailabilityResolved?.({ defaultAgency: defaultResult });
      } catch (err: unknown) {
        if (cancelled) return;
        const msg =
          err instanceof ApiError ? err.message : 'Could not load delivery agencies.';
        setLoadError(msg);
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

  async function handleChange(value: string) {
    if (!productId) return;
    try {
      if (value === 'default') {
        await onAgencyChange(null);
      } else {
        await onAgencyChange(value);
      }
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : 'Could not update delivery agency.';
      toast.error(msg);
    }
  }

  return (
    <div className="rounded-xl border border-border p-5 space-y-3">
      <div className="flex items-start gap-3">
        <Truck className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">Delivery agency</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            The agency that will fulfill orders for this product. Defaults to the
            agency you selected during onboarding.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading agencies…
        </div>
      ) : loadError ? (
        <div className="flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{loadError}</span>
        </div>
      ) : (
        <>
          <Select
            value={selectValue}
            onValueChange={handleChange}
            disabled={isSaving || !productId}
          >
            <SelectTrigger className="w-full" data-size="default">
              <SelectValue placeholder="Select an agency" />
            </SelectTrigger>
            <SelectContent>
              {defaultAgency && (
                <SelectItem value="default">
                  Use my default — {defaultAgency.agencyName}
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
              <span>
                You have no default delivery agency. Pick one for this product or
                set a default in your profile before publishing.
              </span>
            </div>
          )}

          {effectiveAgency && !productAgencyId && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                The system will use your default agency — {effectiveAgency.agencyName}.
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
