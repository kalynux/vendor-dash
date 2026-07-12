import { useEffect, useState } from 'react';
import { ArrowLeftRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getActiveConnectedAgencies } from '@/services/agency-connections.service';
import { reassignItemDeliveryAgency, getOrderErrorMessage } from '@/services/orders.service';
import { ApiError } from '@/types/api';
import type { AgencyBrowseItemDto } from '@/types/agency-connection.types';
import type { Order } from '@/types';

interface ReassignAgencyPopoverProps {
  orderId: string;
  itemId: string;
  currentAgencyId?: string;
  onReassigned: (order: Order) => void;
}

/** Small popover letting a vendor move a not-yet-dispatched item to a different delivery agency. */
export function ReassignAgencyPopover({ orderId, itemId, currentAgencyId, onReassigned }: ReassignAgencyPopoverProps) {
  const [open, setOpen] = useState(false);
  const [agencies, setAgencies] = useState<AgencyBrowseItemDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setSelected(currentAgencyId ?? '');
    setIsLoading(true);
    setLoadError(null);
    getActiveConnectedAgencies()
      .then((res) => { if (!cancelled) setAgencies(res.agencies); })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof ApiError ? err.message : 'Could not load delivery agencies.');
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [open, currentAgencyId]);

  async function handleConfirm() {
    if (!selected || selected === currentAgencyId) return;
    setSubmitting(true);
    try {
      const updated = await reassignItemDeliveryAgency(orderId, itemId, selected);
      onReassigned(updated);
      toast.success('Delivery agency updated');
      setOpen(false);
    } catch (err) {
      toast.error(getOrderErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-6 px-2 text-[10px] gap-1">
          <ArrowLeftRight className="w-3 h-3" />
          Reassign
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-3" align="start">
        <p className="text-xs font-medium">Move to a different agency</p>
        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Loading agencies…
          </div>
        ) : loadError ? (
          <p className="text-xs text-destructive">{loadError}</p>
        ) : (
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="w-full h-8 text-xs">
              <SelectValue placeholder="Select an agency" />
            </SelectTrigger>
            <SelectContent>
              {agencies.map((agency) => (
                <SelectItem key={agency.id} value={agency.id}>
                  {agency.agencyName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button
          size="sm"
          className="w-full h-7 text-xs"
          disabled={!selected || selected === currentAgencyId || submitting}
          onClick={handleConfirm}
        >
          {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
          Confirm
        </Button>
      </PopoverContent>
    </Popover>
  );
}
