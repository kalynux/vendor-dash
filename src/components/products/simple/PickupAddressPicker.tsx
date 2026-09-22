import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { useTranslation } from '@/i18n';
import type { ApiPickupLocation } from '@/types/product.types';

interface PickupAddressPickerProps {
  disabled?: boolean;
  onChoose: (location: ApiPickupLocation) => void | Promise<void>;
}

/**
 * Shown when the backend reports `pickupReason: 'multiple_addresses'` — the
 * vendor has several business addresses and none is flagged default, so guessing
 * could send a courier to the wrong city.
 */
export function PickupAddressPicker({ disabled = false, onChoose }: PickupAddressPickerProps) {
  const { t } = useTranslation();
  const { session } = useOnboarding();
  const addresses = (session?.role_entity.business_addresses ?? []).filter((a) => !!a._id);
  const [selected, setSelected] = useState('');

  if (addresses.length === 0) {
    // A plain line and a way to fix it — not a centred empty state in the
    // middle of a checklist.
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{t('products.delivery.noAddresses')}</p>
        <Button asChild variant="outline" className="max-md:h-11 max-md:w-full">
          <Link to="/dashboard/account/addresses">{t('products.delivery.goToAddresses')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <Select
      value={selected}
      disabled={disabled}
      onValueChange={(value) => {
        setSelected(value);
        void onChoose({ source: 'vendor_address', vendorAddressId: value });
      }}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={t('products.delivery.addressPlaceholder')} />
      </SelectTrigger>
      <SelectContent>
        {addresses.map((addr) => (
          // "Label — street, city", skipping whatever part is missing. Long
          // ones wrap in the list and are clamped to one line in the trigger.
          <SelectItem key={addr._id} value={addr._id as string}>
            {[addr.label, [addr.address_line1, addr.city].filter(Boolean).join(', ')]
              .filter(Boolean)
              .join(' — ')}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
