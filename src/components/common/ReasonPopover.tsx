import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';

export interface ReasonPopoverProps {
  triggerLabel: string;
  confirmLabel: string;
  /** Omit together with `hideReason` for a plain confirm-with-no-reason step. */
  placeholder?: string;
  variant?: 'outline' | 'destructive';
  /** In-flight for THIS action — spins the confirm button and blocks re-submit. */
  disabled: boolean;
  onConfirm: (reason: string) => void;
  /** Optional line above the textarea, e.g. "the agency is not notified". */
  hint?: string;
  /** Drop the textarea — the popover becomes a confirmation step only. */
  hideReason?: boolean;
}

/**
 * Confirm-an-action-with-an-optional-reason popover.
 *
 * The house primitive for "reject this, and say why": a trigger button, a free-text
 * box, and a confirm that spins while the mutation is in flight. Callers pass the
 * labels, so the same component covers rejecting an agency connection and rejecting
 * a stock request. Pass an empty `placeholder`-less flow by simply ignoring the
 * `reason` argument in `onConfirm` when the verb takes no reason (e.g. withdraw).
 */
export function ReasonPopover({
  triggerLabel,
  confirmLabel,
  placeholder,
  variant,
  disabled,
  onConfirm,
  hint,
  hideReason = false,
}: ReasonPopoverProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant={variant ?? 'outline'}>
          {triggerLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-2" align="end">
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        {!hideReason && (
          <Textarea
            placeholder={placeholder}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="text-xs min-h-16"
          />
        )}
        <Button
          size="sm"
          variant={variant ?? 'default'}
          className="w-full"
          disabled={disabled}
          onClick={() => {
            onConfirm(reason);
            setOpen(false);
            setReason('');
          }}
        >
          {disabled ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : confirmLabel}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

export default ReasonPopover;
