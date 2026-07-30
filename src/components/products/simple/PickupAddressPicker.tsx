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
  const { session } = useOnboarding();
  const addresses = (session?.role_entity.business_addresses ?? []).filter((a) => !!a._id);
  const [selected, setSelected] = useState('');

  if (addresses.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-center space-y-2">
        <p className="text-sm text-muted-foreground">You have no business addresses yet.</p>
        <Button asChild size="sm" variant="outline">
          <Link to="/dashboard/account/addresses">Go to Account &rarr; Addresses</Link>
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
      <SelectTrigger className="w-full" data-size="default">
        <SelectValue placeholder="Select a business address" />
      </SelectTrigger>
      <SelectContent>
        {addresses.map((addr) => (
          <SelectItem key={addr._id} value={addr._id as string}>
            {addr.label ? `${addr.label} — ` : ''}
            {addr.address_line1}, {addr.city}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
