import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { UnitInput } from '@/components/ui/unit-input';
import { cn } from '@/lib/utils';
import { editDeliveryFeeProposal, proposeDeliveryFee } from '@/services/delivery-fee-proposals.service';
import { getOrderErrorMessage } from '@/services/orders.service';
import { ApiError } from '@/types/api';
import { useFormatters, useTranslation } from '@/i18n';
import type { Order, OrderItemDelivery } from '@/types';
import type { DeliveryFeeProposal } from '@/types/delivery-fee-proposals.types';

// The vendor proposes a delivery fee to the agency (2026-10-14, ADR-A12) —
// api-doc/vendor/delivery-fee-proposals.md § Proposing a fee yourself.

/** With the agency, not picked up yet — the only window a fee can be proposed in. */
const PROPOSABLE_STATUSES = ['assigned', 'handing_over'];

/** Your own proposals per parcel; withdrawn ones do not count. */
const MAX_OWN_PROPOSALS = 2;

const REASON_MIN = 3;
const REASON_MAX = 500;

/**
 * The form cannot fix these — the parcel or the proposal moved on. Close it and
 * re-read the order. Anything else (`NO_CHANGE`, `VENDOR_NET_NOT_POSITIVE`, a
 * network failure) stays in the form so the vendor can change the figure.
 */
const RELOAD_CODES = new Set([
  'DELIVERY_FEE_PROPOSAL_ALREADY_PENDING',
  'DELIVERY_FEE_PROPOSAL_WINDOW_CLOSED',
  'DELIVERY_FEE_PROPOSAL_NOT_PAYER',
  'DELIVERY_FEE_PROPOSAL_LIMIT_REACHED',
  'DELIVERY_FEE_PROPOSAL_NOT_PENDING',
  'DELIVERY_FEE_PROPOSAL_NOT_FOUND',
  'DELIVERY_FEE_PROPOSAL_VERSION_MISMATCH',
  'DELIVERY_FEE_PROPOSAL_STALE',
]);

/**
 * Whether to offer "Propose a delivery fee" on this shipment: the vendor pays
 * its delivery, it is still with the agency, nothing on it waits for an answer,
 * and the vendor has a proposal left.
 */
function canProposeDeliveryFee(order: Order, shipment: OrderItemDelivery): boolean {
  if (!shipment.shipmentId || shipment.deliveryFee?.payer !== 'vendor') return false;
  if (!shipment.deliveryStatus || !PROPOSABLE_STATUSES.includes(shipment.deliveryStatus)) return false;
  const onShipment = (order.deliveryFeeProposals ?? []).filter((p) => p.shipmentId === shipment.shipmentId);
  if (onShipment.some((p) => p.status === 'pending')) return false;
  const own = onShipment.filter((p) => p.proposedBy.role === 'vendor' && p.status !== 'withdrawn');
  return own.length < MAX_OWN_PROPOSALS;
}

type FormTarget =
  | { mode: 'propose'; orderId: string; shipmentId: string; currentFee: number | null; agencyName: string }
  | { mode: 'edit'; proposal: DeliveryFeeProposal; agencyName: string };

interface DeliveryFeeProposalFormDialogProps {
  target: FormTarget | null;
  currency: string;
  onClose: () => void;
  /** Re-read the order — after a send, or when the form found it out of date. */
  onChanged: () => Promise<void>;
}

/** Propose a fee on a parcel, or change your proposal while the agency has not answered. */
export function DeliveryFeeProposalFormDialog({ target, currency, onClose, onChanged }: DeliveryFeeProposalFormDialogProps) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!target) return;
    setAmount(target.mode === 'edit' ? String(target.proposal.proposedFee) : '');
    setReason(target.mode === 'edit' ? target.proposal.reason : '');
    setShowErrors(false);
    setServerError(null);
  }, [target]);

  const currentFee = target?.mode === 'edit' ? target.proposal.feeBefore : target?.currentFee ?? null;
  const fee = amount === '' ? null : Number(amount);
  const trimmed = reason.trim();

  const amountError = fee === null
    ? t('orders.feeProposals.form.amountRequired')
    : fee === currentFee
      ? t('orders.feeProposals.form.sameFee')
      : null;
  const reasonError = trimmed.length < REASON_MIN ? t('orders.feeProposals.form.reasonTooShort', { min: REASON_MIN }) : null;

  const unchanged =
    target?.mode === 'edit' && fee === target.proposal.proposedFee && trimmed === target.proposal.reason.trim();

  const close = () => {
    if (!submitting) onClose();
  };

  const submit = async () => {
    if (!target || submitting) return;
    if (amountError || reasonError) {
      setShowErrors(true);
      return;
    }
    setSubmitting(true);
    setServerError(null);
    try {
      if (target.mode === 'propose') {
        await proposeDeliveryFee(target.orderId, target.shipmentId, { proposedFee: fee!, reason: trimmed });
        toast.success(t('orders.feeProposals.toast.proposed'));
      } else {
        const { proposal } = target;
        await editDeliveryFeeProposal(proposal.orderId, proposal.id, {
          ...(fee !== proposal.proposedFee && { proposedFee: fee! }),
          ...(trimmed !== proposal.reason.trim() && { reason: trimmed }),
          version: proposal.version,
        });
        toast.success(t('orders.feeProposals.toast.edited'));
      }
      onClose();
      await onChanged();
    } catch (err) {
      if (err instanceof ApiError && RELOAD_CODES.has(err.code)) {
        // On your own proposal a version clash means another screen of yours changed it.
        toast.error(
          err.code === 'DELIVERY_FEE_PROPOSAL_VERSION_MISMATCH'
            ? t('orders.feeProposals.form.changedElsewhere')
            : getOrderErrorMessage(err),
        );
        onClose();
        await onChanged().catch(() => {});
      } else {
        setServerError(getOrderErrorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-md">
        {target && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <DialogHeader>
              <DialogTitle>
                {t(target.mode === 'edit' ? 'orders.feeProposals.form.editTitle' : 'orders.feeProposals.form.title')}
              </DialogTitle>
              <DialogDescription>{t('orders.feeProposals.form.body', { agency: target.agencyName })}</DialogDescription>
            </DialogHeader>

            <p className="text-sm">
              <span className="text-muted-foreground">{t('orders.feeProposals.form.currentFee')} </span>
              <span className="font-medium text-foreground">
                {currentFee === null ? t('common.labels.emptyValue') : fmt.currency(currentFee, currency)}
              </span>
            </p>

            <div className="space-y-1.5">
              <label htmlFor="fee-proposal-amount" className="text-xs font-semibold text-muted-foreground">
                {t('orders.feeProposals.form.amountLabel')}
              </label>
              <UnitInput
                id="fee-proposal-amount"
                // The symbol the prices on screen use ("FCFA"), not the bare code.
                unit={fmt.currency(0, currency).replace(/[\d\s.,]/g, '')}
                inputMode="numeric"
                autoComplete="off"
                value={amount}
                invalid={showErrors && !!amountError}
                // Whole francs only — no decimals, no signs.
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, ''))}
              />
              {showErrors && amountError && <p className="text-xs text-destructive">{amountError}</p>}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="fee-proposal-reason" className="text-xs font-semibold text-muted-foreground">
                {t('orders.feeProposals.form.reasonLabel')}
              </label>
              <Textarea
                id="fee-proposal-reason"
                value={reason}
                maxLength={REASON_MAX}
                rows={3}
                aria-invalid={(showErrors && !!reasonError) || undefined}
                placeholder={t('orders.feeProposals.form.reasonPlaceholder')}
                onChange={(e) => setReason(e.target.value)}
              />
              <div className="flex justify-between gap-3 text-[11px]">
                <span className="text-destructive">{showErrors && reasonError}</span>
                <span className="text-muted-foreground">{fmt.number(reason.length)}/{fmt.number(REASON_MAX)}</span>
              </div>
            </div>

            {serverError && <p className="text-sm text-destructive">{serverError}</p>}

            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={close} disabled={submitting}>
                {t('common.actions.cancel')}
              </Button>
              <Button type="submit" disabled={submitting || unchanged} className="gap-2">
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {t(target.mode === 'edit' ? 'orders.feeProposals.form.save' : 'orders.feeProposals.form.send')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface ProposeDeliveryFeeButtonProps {
  order: Order;
  shipment: OrderItemDelivery;
  onChanged: () => Promise<void>;
  className?: string;
}

/** "Propose a delivery fee" on one shipment row. Renders nothing where the vendor may not propose. */
export function ProposeDeliveryFeeButton({ order, shipment, onChanged, className }: ProposeDeliveryFeeButtonProps) {
  const { t } = useTranslation();
  const [target, setTarget] = useState<FormTarget | null>(null);

  if (!canProposeDeliveryFee(order, shipment)) return null;

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={cn('h-8 w-fit bg-background', className)}
        onClick={() =>
          setTarget({
            mode: 'propose',
            orderId: order.id,
            shipmentId: shipment.shipmentId!,
            currentFee: shipment.deliveryFee?.fee ?? null,
            agencyName: shipment.agencyName ?? t('orders.feeProposals.unknownAgency'),
          })
        }
      >
        {t('orders.feeProposals.propose')}
      </Button>
      <DeliveryFeeProposalFormDialog
        target={target}
        currency={order.currency}
        onClose={() => setTarget(null)}
        onChanged={onChanged}
      />
    </>
  );
}

export type { FormTarget as DeliveryFeeProposalFormTarget };
