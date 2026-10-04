import { useState } from 'react';
import { ArrowRight, ChevronDown, CircleDollarSign, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { refreshPendingFeeProposals } from '@/lib/pending-fee-proposals';
import {
  approveDeliveryFeeProposal,
  coverDeliveryFeeProposal,
  rejectDeliveryFeeProposal,
} from '@/services/delivery-fee-proposals.service';
import { getOrderErrorMessage } from '@/services/orders.service';
import { ApiError } from '@/types/api';
import { useFormatters, useTranslation, type TranslationKey } from '@/i18n';
import type { Order } from '@/types';
import type { DeliveryFeeProposal } from '@/types/delivery-fee-proposals.types';

/** Anchor for "scroll to the fee changes" (notifications land on the order). */
const FEE_PROPOSALS_ANCHOR = 'delivery-fee-proposals';

const NOTE_MAX = 500;

const TOAST_KEYS: Record<'approve' | 'reject' | 'cover', TranslationKey> = {
  approve: 'orders.feeProposals.toast.approved',
  reject: 'orders.feeProposals.toast.rejected',
  cover: 'orders.feeProposals.toast.covered',
};

const STATUS_KEYS: Record<string, TranslationKey> = {
  pending: 'orders.feeProposals.status.pending',
  approved: 'orders.feeProposals.status.approved',
  rejected: 'orders.feeProposals.status.rejected',
  withdrawn: 'orders.feeProposals.status.withdrawn',
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'border-amber-300 bg-amber-50 text-amber-800',
  approved: 'border-green-300 bg-green-50 text-green-700',
  rejected: 'border-red-200 bg-red-50 text-red-700',
};

const WITHDRAWN_KEYS: Record<string, TranslationKey> = {
  shipment_declined: 'orders.feeProposals.withdrawn.shipment_declined',
  agent_detached: 'orders.feeProposals.withdrawn.agent_detached',
};

/**
 * Since 2026-10-04 the customer answers on a customer-paid parcel (`approver`
 * `customer`/`none`), and a change of delivery company raises a `change_agency`
 * difference — the customer is asked, the vendor may cover it.
 */
function answeredByCustomer(p: DeliveryFeeProposal): boolean {
  return p.origin === 'change_agency' || p.approver === 'customer' || p.approver === 'none';
}

function statusKey(p: DeliveryFeeProposal): TranslationKey {
  if (p.status === 'pending' && answeredByCustomer(p)) {
    return p.customerApproval && p.topup?.status === 'awaiting_payment'
      ? 'orders.feeProposals.status.waitingCustomerPayment'
      : 'orders.feeProposals.status.waitingCustomer';
  }
  // A covered difference is recorded as `rejected` (the customer is not paying it).
  if (p.status === 'rejected' && p.origin === 'change_agency') {
    return p.respondedBy?.role === 'vendor' ? 'orders.feeProposals.status.coveredByYou' : 'orders.feeProposals.status.customerDeclined';
  }
  if (p.status === 'withdrawn') {
    return (p.withdrawalReason && WITHDRAWN_KEYS[p.withdrawalReason]) || 'orders.feeProposals.withdrawn.other';
  }
  return STATUS_KEYS[p.status] ?? 'orders.feeProposals.status.unknown';
}

function titleKey(p: DeliveryFeeProposal): TranslationKey {
  if (p.origin === 'change_agency') return 'orders.feeProposals.fromChangeAgency';
  if (p.origin === 'combined_request') return 'orders.feeProposals.fromCombined';
  return p.proposedBy.role === 'agent' ? 'orders.feeProposals.fromAgent' : 'orders.feeProposals.fromAgency';
}

/** Answers that mean "what you saw is out of date" — re-read the order. */
const RELOAD_CODES = new Set([
  'DELIVERY_FEE_PROPOSAL_VERSION_MISMATCH',
  'DELIVERY_FEE_PROPOSAL_NOT_PENDING',
  'DELIVERY_FEE_PROPOSAL_STALE',
  'DELIVERY_FEE_PROPOSAL_NOT_FOUND',
  'DELIVERY_FEE_PROPOSAL_SETTLEMENT_CONFLICT',
]);

interface DeliveryFeeProposalsProps {
  order: Order;
  /** Re-read the order after an answer (or a stale one). */
  onChanged: () => Promise<void>;
  className?: string;
}

/**
 * Delivery-fee changes an agency (or its agent) proposed on this order's
 * shipments. Pending ones first — a pending proposal blocks pickup. Buttons
 * come from `availableActions` only, and every answer sends back the
 * `version` that was on screen.
 */
export function DeliveryFeeProposals({ order, onChanged, className }: DeliveryFeeProposalsProps) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const proposals = order.deliveryFeeProposals ?? [];

  const [approving, setApproving] = useState<DeliveryFeeProposal | null>(null);
  const [rejecting, setRejecting] = useState<DeliveryFeeProposal | null>(null);
  const [covering, setCovering] = useState<DeliveryFeeProposal | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  /** The proposal the agency changed under the vendor — called out after the reload. */
  const [changedId, setChangedId] = useState<string | null>(null);

  if (proposals.length === 0) return null;

  // Newest first from the API; pending ones lifted to the top (stable sort).
  const sorted = [...proposals].sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending'));

  const agencyName = (agencyId: string): string => {
    const shipment =
      order.deliveries?.find((d) => d.agencyId === agencyId) ??
      order.items.find((i) => i.delivery?.agencyId === agencyId)?.delivery;
    return shipment?.agencyName ?? t('orders.feeProposals.unknownAgency');
  };

  const money = (amount: number, currency: string) => fmt.currency(amount, currency);

  const answer = async (proposal: DeliveryFeeProposal, action: 'approve' | 'reject' | 'cover') => {
    setSubmitting(true);
    try {
      if (action === 'approve') {
        await approveDeliveryFeeProposal(proposal.orderId, proposal.id, proposal.version);
      } else if (action === 'reject') {
        await rejectDeliveryFeeProposal(proposal.orderId, proposal.id, proposal.version, note.trim() || undefined);
      } else {
        await coverDeliveryFeeProposal(proposal.orderId, proposal.id);
      }
      setApproving(null);
      setRejecting(null);
      setCovering(null);
      setChangedId(null);
      toast.success(t(TOAST_KEYS[action]));
      void refreshPendingFeeProposals();
      await onChanged();
    } catch (err) {
      setApproving(null);
      setRejecting(null);
      setCovering(null);
      toast.error(getOrderErrorMessage(err));
      if (err instanceof ApiError && RELOAD_CODES.has(err.code)) {
        if (err.code === 'DELIVERY_FEE_PROPOSAL_VERSION_MISMATCH') setChangedId(proposal.id);
        void refreshPendingFeeProposals();
        await onChanged().catch(() => {});
      }
      // VENDOR_NET_NOT_POSITIVE leaves the proposal as it is — Reject stays available.
    } finally {
      setSubmitting(false);
    }
  };

  const earningsDelta = approving ? approving.feeBefore - approving.proposedFee : 0;

  return (
    <section id={FEE_PROPOSALS_ANCHOR} className={cn('space-y-3', className)}>
      <h3 className="flex items-center gap-2 text-sm font-medium">
        <CircleDollarSign className="w-4 h-4 text-muted-foreground" />
        {t('orders.feeProposals.title')}
      </h3>

      {sorted.map((p) => {
        const isPending = p.status === 'pending';
        const canApprove = p.availableActions.includes('approve');
        const canReject = p.availableActions.includes('reject');
        const canCover = p.availableActions.includes('cover');
        const customerSide = answeredByCustomer(p);
        const statusLabel = t(statusKey(p));
        const app = p.application;
        // `covered_by_vendor` is a machine note, not something anyone typed.
        const showNote = p.rejectionNote && p.origin !== 'change_agency';

        return (
          <div
            key={p.id}
            className={cn(
              'rounded-lg border p-3 text-xs space-y-2',
              isPending ? 'border-amber-300 bg-amber-50/60' : 'bg-muted/30',
              changedId === p.id && 'ring-2 ring-amber-400',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium text-foreground">
                {t(titleKey(p), { agency: agencyName(p.agencyId) })}
              </p>
              <Badge variant="outline" className={cn('shrink-0 text-[10px]', STATUS_STYLES[p.status])}>
                {statusLabel}
              </Badge>
            </div>

            <p className="flex items-center gap-1.5 text-sm">
              <span className="text-muted-foreground line-through decoration-1">{money(p.feeBefore, p.currency)}</span>
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="font-semibold text-foreground">{money(p.proposedFee, p.currency)}</span>
            </p>
            <p className="text-foreground/90 whitespace-pre-line break-words">{p.reason}</p>

            {changedId === p.id && (
              <p className="font-medium text-amber-800">{t('orders.feeProposals.changedHighlight')}</p>
            )}
            {isPending && (
              <p className="text-amber-800">
                {t(customerSide ? 'orders.feeProposals.blocksPickupCustomer' : 'orders.feeProposals.blocksPickup')}
              </p>
            )}
            {isPending && p.origin === 'change_agency' && (
              <p className="text-muted-foreground">{t('orders.feeProposals.changeAgencyExplainer')}</p>
            )}
            {isPending && customerSide && p.origin !== 'change_agency' && (
              <p className="text-muted-foreground">{t('orders.feeProposals.customerAnswers')}</p>
            )}

            {p.edits.length > 0 && (
              <Collapsible>
                <CollapsibleTrigger className="group flex items-center gap-1 text-muted-foreground hover:text-foreground">
                  {t('orders.feeProposals.edits', { count: p.edits.length })}
                  <ChevronDown className="w-3.5 h-3.5 transition-transform group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ul className="mt-1.5 space-y-1.5 border-l pl-3">
                    {p.edits.map((edit) => (
                      <li key={edit.version}>
                        <p className="flex items-center gap-1">
                          {money(edit.feeBefore, p.currency)}
                          <ArrowRight className="w-3 h-3 text-muted-foreground" />
                          {money(edit.feeAfter, p.currency)}
                          <span className="text-muted-foreground">· {fmt.dateTime(edit.at)}</span>
                        </p>
                        <p className="text-muted-foreground break-words">{edit.reasonAfter}</p>
                      </li>
                    ))}
                  </ul>
                </CollapsibleContent>
              </Collapsible>
            )}

            {showNote && (
              <p className="text-muted-foreground">
                {t(p.respondedBy?.role === 'customer' ? 'orders.feeProposals.customerNote' : 'orders.feeProposals.rejectionNote', {
                  note: p.rejectionNote,
                })}
              </p>
            )}
            {!isPending && p.respondedBy?.at && (
              <p className="text-muted-foreground">{t('orders.feeProposals.answeredOn', { date: fmt.dateTime(p.respondedBy.at) })}</p>
            )}
            {p.status === 'approved' && app && app.vendorAllocationBefore !== null && app.vendorAllocationAfter !== null && (
              <p className="text-muted-foreground">
                {t('orders.feeProposals.earnings', {
                  before: money(app.vendorAllocationBefore, p.currency),
                  after: money(app.vendorAllocationAfter, p.currency),
                })}
              </p>
            )}
            {app?.vendorBorneDelta != null && app.vendorBorneDelta > 0 && (
              <p className="text-muted-foreground">
                {t('orders.feeProposals.youPayMore', { amount: money(app.vendorBorneDelta, p.currency) })}
              </p>
            )}

            {canCover && (
              <div className="pt-1">
                <Button size="sm" variant="outline" className="h-8 bg-background" disabled={submitting} onClick={() => setCovering(p)}>
                  {t('orders.feeProposals.cover')}
                </Button>
              </div>
            )}

            {(canApprove || canReject) && (
              <div className="flex flex-wrap gap-2 pt-1">
                {canApprove && (
                  <Button size="sm" className="h-8" disabled={submitting} onClick={() => setApproving(p)}>
                    {t('orders.feeProposals.approve')}
                  </Button>
                )}
                {canReject && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 bg-background"
                    disabled={submitting}
                    onClick={() => {
                      setNote('');
                      setRejecting(p);
                    }}
                  >
                    {t('orders.feeProposals.reject')}
                  </Button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Approve — states what it does to the vendor's money. */}
      <Dialog open={approving !== null} onOpenChange={(open) => !open && !submitting && setApproving(null)}>
        <DialogContent className="sm:max-w-md">
          {approving && (
            <>
              <DialogHeader>
                <DialogTitle>{t('orders.feeProposals.approveDialog.title')}</DialogTitle>
                <DialogDescription className="space-y-2 pt-2" asChild>
                  <div>
                    <p className="flex items-center gap-1.5 text-foreground">
                      {money(approving.feeBefore, approving.currency)}
                      <ArrowRight className="w-3.5 h-3.5" />
                      <span className="font-semibold">{money(approving.proposedFee, approving.currency)}</span>
                    </p>
                    {earningsDelta !== 0 && (
                      <p className="text-foreground">
                        {t(earningsDelta > 0 ? 'orders.feeProposals.approveDialog.earningsUp' : 'orders.feeProposals.approveDialog.earningsDown', {
                          amount: money(Math.abs(earningsDelta), approving.currency),
                        })}
                      </p>
                    )}
                    <p>
                      {t(order.paymentMethod === 'cash_on_delivery'
                        ? 'orders.feeProposals.approveDialog.codNote'
                        : 'orders.feeProposals.approveDialog.onlineNote')}
                    </p>
                  </div>
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:gap-2">
                <Button variant="outline" onClick={() => setApproving(null)} disabled={submitting}>
                  {t('common.actions.cancel')}
                </Button>
                <Button onClick={() => void answer(approving, 'approve')} disabled={submitting} className="gap-2">
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t('orders.feeProposals.approve')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Cover — the vendor pays the new company's higher price now; the customer pays nothing more. */}
      <Dialog open={covering !== null} onOpenChange={(open) => !open && !submitting && setCovering(null)}>
        <DialogContent className="sm:max-w-md">
          {covering && (
            <>
              <DialogHeader>
                <DialogTitle>{t('orders.feeProposals.coverDialog.title')}</DialogTitle>
                <DialogDescription className="space-y-2 pt-2" asChild>
                  <div>
                    <p className="flex items-center gap-1.5 text-foreground">
                      {money(covering.feeBefore, covering.currency)}
                      <ArrowRight className="w-3.5 h-3.5" />
                      <span className="font-semibold">{money(covering.proposedFee, covering.currency)}</span>
                    </p>
                    <p>{t('orders.feeProposals.coverDialog.body')}</p>
                  </div>
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:gap-2">
                <Button variant="outline" onClick={() => setCovering(null)} disabled={submitting}>
                  {t('common.actions.cancel')}
                </Button>
                <Button onClick={() => void answer(covering, 'cover')} disabled={submitting} className="gap-2">
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t('orders.feeProposals.cover')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject — optional note, and what the agency may do next. */}
      <Dialog open={rejecting !== null} onOpenChange={(open) => !open && !submitting && setRejecting(null)}>
        <DialogContent className="sm:max-w-md">
          {rejecting && (
            <>
              <DialogHeader>
                <DialogTitle>{t('orders.feeProposals.rejectDialog.title')}</DialogTitle>
                <DialogDescription>{t('orders.feeProposals.rejectDialog.body')}</DialogDescription>
              </DialogHeader>
              <div className="space-y-1.5">
                <label htmlFor="fee-proposal-reject-note" className="text-xs font-semibold text-muted-foreground">
                  {t('orders.feeProposals.rejectDialog.noteLabel')}
                </label>
                <Textarea
                  id="fee-proposal-reject-note"
                  value={note}
                  maxLength={NOTE_MAX}
                  rows={3}
                  placeholder={t('orders.feeProposals.rejectDialog.notePlaceholder')}
                  onChange={(e) => setNote(e.target.value)}
                />
                <p className="text-right text-[11px] text-muted-foreground">{fmt.number(note.length)}/{fmt.number(NOTE_MAX)}</p>
              </div>
              <DialogFooter className="gap-2 sm:gap-2">
                <Button variant="outline" onClick={() => setRejecting(null)} disabled={submitting}>
                  {t('common.actions.cancel')}
                </Button>
                <Button variant="destructive" onClick={() => void answer(rejecting, 'reject')} disabled={submitting} className="gap-2">
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t('orders.feeProposals.reject')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
