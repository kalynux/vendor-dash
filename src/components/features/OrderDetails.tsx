import { useState } from 'react';
import {
  Package,
  Truck,
  Clock,
  MapPin,
  CreditCard,
  User,
  Printer,
  MessageSquare,
  Send,
  Download,
  Ban,
  RotateCcw,
  Shield,
  ChevronDown,
  Loader2,
  AlertTriangle,
  PackageCheck,
  Banknote,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useOrderStore } from '@/store';
import { addNote, fetchNote, revokeEntitlement, restoreEntitlement, dispatchOrder, getOrderErrorMessage, isOrderFrozen } from '@/services/orders.service';
import { PaymentStatusBadge } from '@/components/orders/PaymentStatusBadge';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { DeliveryStatusBadge } from '@/components/orders/DeliveryStatusBadge';
import { DeliveryRejectionNotice } from '@/components/orders/DeliveryRejectionNotice';
import { ReassignAgencyPopover } from '@/components/orders/ReassignAgencyPopover';
import { ApiError } from '@/types/api';
import { toast } from 'sonner';
import { formatPhoneInternational } from '@/lib/phone';
import { useTranslation, useFormatters, Trans } from '@/i18n';
import type { Order, Entitlement, OrderTimelineEvent, VendorSettableStatus } from '@/types';
import { getNextStatuses, STATUS_ACTION_KEYS, ORDER_STATUS_KEYS, canDispatchOrder } from '@/lib/orderStatus';

const REASSIGNABLE_DELIVERY_STATUSES = ['pending', 'assigned', 'pending_agency_reassignment'];

interface OrderDetailsProps {
  order: Order;
  onOrderUpdated?: (updated: Order) => void;
}

// Valid next statuses based on current status and order type
// export function getNextStatuses(status: string, orderType: 'physical' | 'digital'): string[] {
//   switch (status) {
//     case 'pending':     return ['processing', 'cancelled'];
//     case 'processing':  return orderType === 'digital' ? ['fulfilled', 'cancelled'] : ['shipped', 'cancelled'];
//     case 'shipped':     return ['delivered', 'cancelled'];
//     default:            return []; // delivered, fulfilled, cancelled are terminal
//   }
// }

const timelineIcons: Record<string, React.ElementType> = {
  'order.created': Clock,
  'payment.updated': CreditCard,
  'fulfillment.updated': Package,
  'delivery.agency_updated': Truck,
  'note.added': MessageSquare,
  'entitlement.revoked': Ban,
  'entitlement.restored': RotateCcw,
};

export function OrderDetails({ order, onOrderUpdated }: OrderDetailsProps) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const { updateOrderStatus } = useOrderStore();

  // Local state for the current order (so actions can update it without refetching the page)
  const [currentOrder, setCurrentOrder] = useState<Order>(order);

  const [note, setNote] = useState('');
  const [noteLoading, setNoteLoading] = useState(false);
  const [fetchingNoteId, setFetchingNoteId] = useState<string | null>(null);

  const [statusLoading, setStatusLoading] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelConfirmationText, setCancelConfirmationText] = useState('');
  const [dispatchLoading, setDispatchLoading] = useState(false);

  // Entitlement action dialog
  const [actionDialog, setActionDialog] = useState<{
    type: 'revoke' | 'restore';
    entitlement: Entitlement;
  } | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const isPhysical = currentOrder.orderType === 'physical';
  const isDigital = currentOrder.orderType === 'digital';
  const hasEntitlements = (currentOrder.entitlements?.length ?? 0) > 0;
  const frozen = isOrderFrozen(currentOrder);
  // A frozen (disputed) order can't be advanced — the status PATCH returns 423.
  const nextStatuses = frozen ? [] : getNextStatuses(currentOrder.status);
  const canDispatch = canDispatchOrder(currentOrder);
  const cancelWord = t('orders.detail.cancelDialog.confirmWord');

  const formatCurrency = (value: number) => fmt.currency(value, currentOrder.currency);
  const formatDate = (dateStr: string) => fmt.dateTime(dateStr);

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleStatusUpdate = async (status: VendorSettableStatus) => {
    if (status === 'cancelled') {
      setCancelConfirmationText('');
      setShowCancelConfirm(true);
      return;
    }
    setStatusLoading(true);
    try {
      await updateOrderStatus(currentOrder.id, status);
      const next = { ...currentOrder, status: status as Order['status'] };
      setCurrentOrder(next);
      onOrderUpdated?.(next);
      toast.success(t('orders.toast.markedAs', { status: t(ORDER_STATUS_KEYS[status]) }));
    } catch (err) {
      // 423 → the order was frozen by a dispute since this view loaded. Reflect it
      // locally so the controls disable and the banner shows, instead of a bare toast.
      if (err instanceof ApiError && err.status === 423 && err.code === 'ORDER_DISPUTE_HOLD') {
        const frozenOrder: Order = {
          ...currentOrder,
          paymentStatus: 'disputed',
          disputeHold: { ...(currentOrder.disputeHold ?? {}), active: true },
        };
        setCurrentOrder(frozenOrder);
        onOrderUpdated?.(frozenOrder);
      }
      toast.error(getOrderErrorMessage(err));
    } finally {
      setStatusLoading(false);
    }
  };

  const confirmCancelOrder = async () => {
    setShowCancelConfirm(false);
    setCancelConfirmationText('');
    setStatusLoading(true);
    try {
      await updateOrderStatus(currentOrder.id, 'cancelled');
      const next = { ...currentOrder, status: 'cancelled' as Order['status'] };
      setCurrentOrder(next);
      onOrderUpdated?.(next);
      toast.success(t('orders.toast.cancelled'));
    } catch (err) {
      toast.error(getOrderErrorMessage(err));
    } finally {
      setStatusLoading(false);
    }
  };

  const handleDispatch = async () => {
    setDispatchLoading(true);
    try {
      const { order: updated } = await dispatchOrder(currentOrder.id);
      setCurrentOrder(updated);
      onOrderUpdated?.(updated);
      toast.success(t('orders.toast.dispatched'));
    } catch (err) {
      toast.error(getOrderErrorMessage(err));
    } finally {
      setDispatchLoading(false);
    }
  };

  const handleItemReassigned = (updated: Order) => {
    setCurrentOrder(updated);
    onOrderUpdated?.(updated);
  };

  const handleAddNote = async () => {
    if (!note.trim()) return;
    setNoteLoading(true);
    try {
      await addNote(currentOrder.id, note.trim());
      setNote('');
      // Append a local optimistic timeline entry so the user sees feedback
      const pseudoEvent = {
        id: `local-${Date.now()}`,
        type: 'note.added' as const,
        messageKey: 'orders.detail.timeline.noteAdded' as const,
        messageFallback: 'note added',
        description: note.trim(),
        createdAt: new Date().toISOString(),
        actor: t('orders.detail.timeline.you'),
      }
      setCurrentOrder(prev => ({ ...prev, timeline: [pseudoEvent, ...prev.timeline] }));
      toast.success(t('orders.detail.timeline.noteAdded'));
    } catch (err) {
      toast.error(getOrderErrorMessage(err));
    } finally {
      setNoteLoading(false);
    }
  };

  const handleGetNote = async (event: OrderTimelineEvent) => {
    if (!event.noteId) return;
    // Already loaded
    // if (event.description) return;
    setFetchingNoteId(event.id);
    try {
      await new Promise(res => setTimeout(res, 2000));
      const message = await fetchNote(currentOrder.id, event.noteId);
      setCurrentOrder(prev => ({
        ...prev,
        timeline: prev.timeline.map(e =>
          e.id === event.id ? { ...e, description: message } : e,
        ),
      }));
    } catch (err) {
      toast.error(getOrderErrorMessage(err));
    } finally {
      setFetchingNoteId(null);
    }
  };

  const openRevokeDialog = (entitlement: Entitlement) => {
    setActionReason('');
    setActionDialog({ type: 'revoke', entitlement });
  };

  const openRestoreDialog = (entitlement: Entitlement) => {
    setActionReason('');
    setActionDialog({ type: 'restore', entitlement });
  };

  const handleEntitlementAction = async () => {
    if (!actionDialog || !actionReason.trim()) return;
    setActionLoading(true);
    try {
      const { type, entitlement } = actionDialog;
      if (type === 'revoke') {
        await revokeEntitlement(entitlement.id, actionReason.trim());
      } else {
        await restoreEntitlement(entitlement.id, actionReason.trim());
      }
      // Update entitlement state locally
      setCurrentOrder(prev => ({
        ...prev,
        entitlements: prev.entitlements?.map(e =>
          e.id === entitlement.id
            ? {
              ...e,
              isRevoked: type === 'revoke',
              isActive: type === 'restore',
              revokedAt: type === 'revoke' ? new Date().toISOString() : null,
              revokeReason: type === 'revoke' ? actionReason.trim() : null,
            }
            : e,
        ),
      }));
      setActionDialog(null);
      toast.success(t(type === 'revoke'
        ? 'orders.detail.entitlements.revokedToast'
        : 'orders.detail.entitlements.restoredToast'));
    } catch (err) {
      toast.error(getOrderErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold">{currentOrder.orderNumber}</h2>
            <OrderStatusBadge status={currentOrder.status} />
            {isDigital ? (
              <Badge variant="outline" className="gap-1 border-violet-300 text-violet-700 bg-violet-50">
                <Download className="w-3 h-3" />{t('orders.orderType.digital')}
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 border-blue-300 text-blue-700 bg-blue-50">
                <Package className="w-3 h-3" />{t('orders.orderType.physical')}
              </Badge>
            )}
            {currentOrder.paymentMethod === 'cash_on_delivery' && (
              <Badge variant="outline" className="gap-1 border-amber-300 text-amber-700 bg-amber-50">
                <Banknote className="w-3 h-3" />{t('orders.paymentMethod.cashOnDelivery')}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {t('orders.detail.placedOn', { date: formatDate(currentOrder.createdAt) })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Printer className="w-4 h-4" />
            {t('common.actions.print')}
          </Button>
          {canDispatch && (
            <Button variant="outline" size="sm" className="gap-2" disabled={dispatchLoading} onClick={handleDispatch}>
              {dispatchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackageCheck className="w-4 h-4" />}
              {t('orders.actions.dispatchToAgency')}
            </Button>
          )}
          {nextStatuses.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="gap-2" disabled={statusLoading}>
                  {statusLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t('orders.actions.updateStatus')}
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {nextStatuses.map((s) => (
                  <DropdownMenuItem
                    key={s}
                    onClick={() => handleStatusUpdate(s)}
                    className={s === 'cancelled' ? 'text-destructive' : ''}
                  >
                    {t(STATUS_ACTION_KEYS[s])}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Badge variant="outline" className="px-3 py-1">{t(ORDER_STATUS_KEYS[currentOrder.status])}</Badge>
          )}
        </div>
      </div>

      {/* Dispute freeze banner — fulfilment is locked until the chargeback settles. */}
      {frozen && (
        <div className="flex items-start gap-3 rounded-lg border border-orange-300 bg-orange-50 p-3 flex-shrink-0">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-600" />
          <div className="text-sm">
            <p className="font-semibold text-orange-800">{t('orders.detail.dispute.bannerTitle')}</p>
            <p className="text-orange-700/90 mt-0.5">
              {t('orders.detail.dispute.bannerBody')}
              {currentOrder.disputeHold?.disputedAt && (
                <> {t('orders.detail.dispute.bannerDisputedOn', { date: formatDate(currentOrder.disputeHold.disputedAt) })}</>
              )}{' '}
              {t('orders.detail.dispute.bannerResolution')}
            </p>
          </div>
        </div>
      )}

      <Tabs defaultValue="details" className="w-full flex flex-col flex-1 min-h-0">
        <TabsList className={`grid w-full flex-shrink-0 ${hasEntitlements ? 'grid-cols-5' : 'grid-cols-4'}`}>
          <TabsTrigger value="details">{t('orders.detail.tabs.details')}</TabsTrigger>
          <TabsTrigger value="items">{t('orders.detail.tabs.itemsWithCount', { count: currentOrder.items.length })}</TabsTrigger>
          <TabsTrigger value="timeline">{t('orders.detail.tabs.timeline')}</TabsTrigger>
          <TabsTrigger value="payment">{t('orders.detail.tabs.payment')}</TabsTrigger>
          {hasEntitlements && (
            <TabsTrigger value="entitlements">
              {t('orders.detail.tabs.accessWithCount', { count: currentOrder.entitlements!.length })}
            </TabsTrigger>
          )}
        </TabsList>

        {/* ── Details tab ── */}
        <TabsContent value="details" className="space-y-4 mt-4 flex-1 overflow-y-auto min-h-0 pr-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
            {/* Customer */}
            <Card className="h-full flex flex-col">
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" /> {t('orders.detail.customer.title')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 flex-1 flex flex-col justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={currentOrder.customer.avatar || `https://i.pravatar.cc/150?u=${currentOrder.customer.id}`}
                    alt={currentOrder.customer.name}
                    crossOrigin="use-credentials"
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div>
                    <p className="font-semibold text-sm">{currentOrder.customer.name}</p>
                    <p className="text-xs text-muted-foreground">{currentOrder.customer.email}</p>
                    {currentOrder.customer.phone && (
                      <p className="text-xs text-muted-foreground">
                        {formatPhoneInternational(currentOrder.customer.phone)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="pt-3 border-t grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-base font-bold">{currentOrder.customer.orderCount}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{t('orders.detail.customer.orderCount')}</p>
                  </div>
                  <div>
                    <p className="text-base font-bold">{formatCurrency(currentOrder.customer.totalSpent)}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{t('orders.detail.customer.totalSpent')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Shipping / Delivery method */}
            {isDigital ? (
              <Card className="h-full flex flex-col">
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Download className="w-4 h-4 text-muted-foreground" /> {t('orders.detail.shipping.deliveryMethodTitle')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-center">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-violet-50/70 border border-violet-100/80">
                    <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0 text-violet-700">
                      <Download className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-xs text-violet-900">{t('orders.detail.shipping.digitalDelivery')}</p>
                      <p className="text-[11px] text-violet-700/80 mt-0.5 leading-relaxed">
                        {t('orders.detail.shipping.digitalDeliveryNote')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="h-full flex flex-col">
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" /> {t('orders.detail.shipping.addressTitle')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-start">
                  {currentOrder.customer.defaultAddress ? (
                    <div className="space-y-1 text-xs leading-relaxed text-muted-foreground">
                      <p className="font-semibold text-foreground text-sm">
                        {currentOrder.customer.defaultAddress.firstName}{' '}
                        {currentOrder.customer.defaultAddress.lastName}
                      </p>
                      <p>{currentOrder.customer.defaultAddress.address1}</p>
                      <p>
                        {currentOrder.customer.defaultAddress.city},{' '}
                        {currentOrder.customer.defaultAddress.province}
                      </p>
                      <p className="font-medium text-foreground/80">{currentOrder.customer.defaultAddress.country}</p>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground py-2">
                      <p className="text-xs">{t('orders.detail.shipping.noAddress')}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Shipments (physical, multi-agency) */}
          {isPhysical && currentOrder.deliveries && currentOrder.deliveries.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Truck className="w-4 h-4 text-muted-foreground" />
                  {currentOrder.deliveries.length > 1
                    ? t('orders.detail.shipping.shipmentsTitleWithCount', { count: currentOrder.deliveries.length })
                    : t('orders.detail.shipping.shipmentsTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {currentOrder.deliveries.map((shipment, i) => (
                  <div
                    key={shipment.shipmentId ?? i}
                    className={i > 0 ? 'pt-3 border-t grid grid-cols-2 gap-4 text-xs' : 'grid grid-cols-2 gap-4 text-xs'}
                  >
                    <div>
                      <p className="text-muted-foreground text-[10px] uppercase tracking-wider font-semibold mb-1">{t('orders.detail.shipping.agency')}</p>
                      <p className="font-semibold text-sm text-foreground">{shipment.agencyName ?? t('common.labels.emptyValue')}</p>
                      {shipment.agencyPhone && (
                        <p className="text-muted-foreground mt-0.5">
                          {formatPhoneInternational(shipment.agencyPhone)}
                        </p>
                      )}
                      <div className="mt-1.5"><DeliveryStatusBadge status={shipment.deliveryStatus} size="xs" /></div>
                    </div>
                    <div>
                      {shipment.agent && (
                        <>
                          <p className="text-muted-foreground text-[10px] uppercase tracking-wider font-semibold mb-1">{t('orders.detail.shipping.assignedAgent')}</p>
                          <p className="font-semibold text-sm text-foreground">{shipment.agent.name}</p>
                        </>
                      )}
                      {shipment.trackingNumber && (
                        <p className="text-muted-foreground mt-1">{t('orders.detail.shipping.tracking', { number: shipment.trackingNumber })}</p>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Order Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Package className="w-4 h-4 text-muted-foreground" /> {t('orders.detail.summary.title')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('orders.detail.summary.subtotal')}</span>
                  <span className="font-medium text-foreground">{formatCurrency(currentOrder.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('orders.detail.summary.tax')}</span>
                  <span className="font-medium text-foreground">{formatCurrency(currentOrder.tax)}</span>
                </div>
                {isPhysical && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('orders.detail.summary.shipping')}</span>
                    <span className="font-medium text-foreground">{currentOrder.shipping === 0 ? t('orders.detail.summary.free') : formatCurrency(currentOrder.shipping)}</span>
                  </div>
                )}
                {currentOrder.discount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('orders.detail.summary.discount')}</span>
                    <span className="font-semibold text-green-600">-{formatCurrency(currentOrder.discount)}</span>
                  </div>
                )}
                <div className="pt-2 border-t flex justify-between items-center">
                  <span className="font-semibold text-sm text-foreground">{t('orders.detail.summary.total')}</span>
                  <span className="font-bold text-base text-primary">{formatCurrency(currentOrder.total)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Items tab ── */}
        <TabsContent value="items" className="mt-4 flex-1 overflow-y-auto min-h-0 pr-2">
          <div className="space-y-3">
            {currentOrder.items.map((item) => (
              <Card key={item.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    {/* Product Details (Left) */}
                    <div className="flex items-center gap-4 min-w-0">
                      {item.image ? (
                        <img src={item.image} alt={item.name} crossOrigin="use-credentials" className="w-14 h-14 rounded-lg object-cover flex-shrink-0 border" />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 font-bold border">
                          {item.name.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-foreground truncate">{item.name}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                          {item.sku && <Trans i18nKey="orders.detail.items.sku" params={{ sku: item.sku }} components={[<span className="font-medium text-foreground" />]} />}
                          {item.sku && <span>•</span>}
                          <Trans i18nKey="orders.detail.items.qty" params={{ count: item.quantity }} components={[<span className="font-semibold text-foreground" />]} />
                        </div>
                        {(isDigital || item.delivery?.freeDelivery) && (
                          <div className="flex items-center gap-1.5 mt-1.5">
                            {isDigital && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-violet-300 text-violet-700 bg-violet-50 gap-1 font-semibold">
                                <Download className="w-2.5 h-2.5" />{t('orders.orderType.digital')}
                              </Badge>
                            )}
                            {item.delivery?.freeDelivery && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-green-300 text-green-700 bg-green-50 gap-1 font-semibold">
                                <Truck className="w-2.5 h-2.5" />{t('orders.detail.shipping.freeDelivery')}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Pricing (Right) */}
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-sm text-foreground">{formatCurrency(item.total)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t('orders.detail.items.unitPrice', { price: formatCurrency(item.price) })}</p>
                    </div>
                  </div>

                  {/* Per-item delivery (physical only) */}
                  {isPhysical && item.delivery && (
                    <div className="pt-3 border-t space-y-2">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap text-xs">
                          <Truck className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="font-medium text-foreground">{item.delivery.agencyName ?? t('orders.detail.shipping.noAgency')}</span>
                          <DeliveryStatusBadge status={item.delivery.deliveryStatus} size="xs" />
                          {item.delivery.trackingNumber && (
                            <span className="text-muted-foreground">{t('orders.detail.shipping.tracking', { number: item.delivery.trackingNumber })}</span>
                          )}
                        </div>
                        {item.delivery.deliveryStatus && REASSIGNABLE_DELIVERY_STATUSES.includes(item.delivery.deliveryStatus) && (
                          <ReassignAgencyPopover
                            orderId={currentOrder.id}
                            itemId={item.id}
                            currentAgencyId={item.delivery.agencyId}
                            onReassigned={handleItemReassigned}
                          />
                        )}
                      </div>
                      {item.delivery.rejection && (
                        <DeliveryRejectionNotice rejection={item.delivery.rejection} />
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── Timeline tab ── */}
        <TabsContent value="timeline" className="space-y-4 mt-4 flex-1 overflow-y-auto min-h-0 pr-2">
          <Card>
            <CardContent className="p-6">
              {currentOrder.timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">{t('orders.detail.timeline.empty')}</p>
              ) : (
                <div className="space-y-2">
                  {currentOrder.timeline.map((event, index) => {
                    const Icon = timelineIcons[event.type] ?? Clock;
                    const isLast = index === currentOrder.timeline.length - 1;
                    const isClickable = !!event.noteId && (event.description?.length ?? 0) >= 100;
                    return (
                      <div key={event.id} className="flex gap-1" onClick={() => isClickable && handleGetNote(event)}>
                        <div className="flex flex-col items-center">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Icon className="w-5 h-5 text-primary" />
                          </div>
                          {!isLast && <div className="w-0.5 flex-1 bg-border mt-2" />}
                        </div>
                        <div className={`flex-1 pb-6 rounded-lg p-2 ${isClickable ? 'cursor-pointer hover:bg-accent' : ''}`}>
                          <p className="font-medium">
                            {event.messageKey ? t(event.messageKey, event.messageParams) : event.messageFallback}
                          </p>
                          {fetchingNoteId === event.id
                            ? <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />{t('orders.detail.timeline.loadingNote')}</p>
                            : event.description && <p className="text-xs text-muted-foreground block">• {event.description}</p>
                          }
                          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                            <span>{event.actor}</span>
                            <span>•</span>
                            <span>{formatDate(event.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add Note */}
              <div className="mt-6 pt-6 border-t">
                <p className="font-medium mb-3">{t('orders.detail.timeline.addNote')}</p>
                <div className="flex gap-3">
                  <Textarea
                    placeholder={t('orders.detail.timeline.notePlaceholder')}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    className="gap-2 self-end"
                    disabled={!note.trim() || noteLoading}
                    onClick={handleAddNote}
                  >
                    {noteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {t('common.actions.add')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Delivery Timeline (physical, multi-agency shipment history) */}
          {isPhysical && currentOrder.deliveryTimeline && currentOrder.deliveryTimeline.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Truck className="w-4 h-4 text-muted-foreground" /> {t('orders.detail.shipping.deliveryTimeline')}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 pt-0">
                <div className="space-y-2">
                  {currentOrder.deliveryTimeline.map((entry, index) => {
                    const isLast = index === currentOrder.deliveryTimeline!.length - 1;
                    return (
                      <div key={`${entry.shipmentId}-${entry.changedAt}-${index}`} className="flex gap-1">
                        <div className="flex flex-col items-center">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Truck className="w-5 h-5 text-primary" />
                          </div>
                          {!isLast && <div className="w-0.5 flex-1 bg-border mt-2" />}
                        </div>
                        <div className="flex-1 pb-6 rounded-lg p-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium">{entry.agencyName}</p>
                            <DeliveryStatusBadge status={entry.status} size="xs" />
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground capitalize">
                            <span>{entry.changedByRole}</span>
                            <span>•</span>
                            <span>{formatDate(entry.changedAt)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Payment tab ── */}
        <TabsContent value="payment" className="space-y-4 mt-4 flex-1 overflow-y-auto min-h-0 pr-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CreditCard className="w-4 h-4" /> {t('orders.detail.payment.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground mb-1">{t('orders.detail.payment.status')}</p>
                  <PaymentStatusBadge status={currentOrder.paymentStatus} />
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">{t('orders.detail.payment.method')}</p>
                  <p className="font-medium">
                    {t(currentOrder.paymentMethod === 'cash_on_delivery'
                      ? 'orders.paymentMethod.cashOnDelivery'
                      : 'orders.paymentMethod.online')}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">{t('orders.detail.payment.orderType')}</p>
                  <p className="font-medium">{t(`orders.orderType.${currentOrder.orderType}`)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">{t('orders.detail.payment.currency')}</p>
                  <p className="font-medium">{currentOrder.currency}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">{t('orders.detail.payment.placedAt')}</p>
                  <p className="font-medium">{formatDate(currentOrder.createdAt)}</p>
                </div>
              </div>

              {frozen && (
                <div className="flex items-start gap-2 rounded-md bg-orange-50 border border-orange-100 p-3 text-sm">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-orange-600" />
                  <div>
                    <p className="font-medium text-orange-800">{t('orders.detail.dispute.paymentTitle')}</p>
                    <p className="text-orange-700/90 mt-0.5">
                      {currentOrder.disputeHold?.disputedAt
                        ? t('orders.detail.dispute.paymentBodyOn', { date: formatDate(currentOrder.disputeHold.disputedAt) })
                        : t('orders.detail.dispute.paymentBody')}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Entitlements tab (digital only) ── */}
        {hasEntitlements && (
          <TabsContent value="entitlements" className="space-y-4 mt-4 flex-1 overflow-y-auto min-h-0 pr-2">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-violet-50 border border-violet-200 text-sm text-violet-800">
              <Shield className="w-4 h-4 mt-0.5 flex-shrink-0 text-violet-600" />
              <p>{t('orders.detail.entitlements.intro')}</p>
            </div>

            {currentOrder.entitlements!.map((entitlement) => {
              const maxDl = entitlement.maxDownloads;
              const downloadPct = maxDl === null ? 0
                : Math.min(100, Math.round((entitlement.downloadsUsed / maxDl) * 100));

              return (
                <Card key={entitlement.id}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${entitlement.isRevoked ? 'bg-red-100' : entitlement.isExpired ? 'bg-gray-100' : 'bg-violet-100'}`}>
                          <Download className={`w-4 h-4 ${entitlement.isRevoked ? 'text-red-600' : entitlement.isExpired ? 'text-gray-500' : 'text-violet-700'}`} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <p className="font-medium truncate">{entitlement.productTitle}</p>
                            {entitlement.variantName && (
                              <Badge variant="secondary" className="text-xs font-normal shrink-0">
                                {entitlement.variantName}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{entitlement.assetName}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge
                          variant={entitlement.isRevoked ? 'destructive' : entitlement.isExpired ? 'secondary' : 'outline'}
                          className={!entitlement.isRevoked && !entitlement.isExpired ? 'border-green-300 text-green-700 bg-green-50' : ''}
                        >
                          {t(entitlement.isRevoked
                            ? 'orders.detail.entitlements.revoked'
                            : entitlement.isExpired
                              ? 'orders.detail.entitlements.expired'
                              : 'orders.detail.entitlements.active')}
                        </Badge>
                        {entitlement.isRevoked ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 h-8"
                            disabled={entitlement.isExpired}
                            onClick={() => openRestoreDialog(entitlement)}
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            {t('orders.detail.entitlements.restore')}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 h-8 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                            onClick={() => openRevokeDialog(entitlement)}
                          >
                            <Ban className="w-3.5 h-3.5" />
                            {t('orders.detail.entitlements.revoke')}
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground mb-1.5">{t('orders.detail.entitlements.downloadsUsed')}</p>
                        <p className="font-medium mb-1.5">
                          {entitlement.downloadsUsed} / {maxDl === null ? '∞' : maxDl}
                        </p>
                        {maxDl !== null && (
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full ${entitlement.isRevoked ? 'bg-red-400' : 'bg-violet-500'}`}
                              style={{ width: `${downloadPct}%` }}
                            />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">{t('orders.detail.entitlements.expires')}</p>
                        <p className="font-medium">{formatDate(entitlement.expiresAt)}</p>
                      </div>
                      {entitlement.lastDownloadAt && (
                        <div>
                          <p className="text-muted-foreground mb-1">{t('orders.detail.entitlements.lastDownload')}</p>
                          <p className="font-medium">{formatDate(entitlement.lastDownloadAt)}</p>
                        </div>
                      )}
                    </div>

                    {entitlement.isRevoked && entitlement.revokedAt && (
                      <div className="mt-3 p-3 rounded-md bg-red-50 border border-red-100 text-sm">
                        <p className="text-xs font-medium text-red-700 mb-0.5">{t('orders.detail.entitlements.revokedAt')}</p>
                        <p className="text-red-800">{formatDate(entitlement.revokedAt)}</p>
                        {entitlement.revokeReason && (
                          <>
                            <p className="text-xs font-medium text-red-700 mt-2 mb-0.5">{t('orders.detail.entitlements.reason')}</p>
                            <p className="text-red-800">{entitlement.revokeReason}</p>
                          </>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>
        )}
      </Tabs>

      {/* Revoke / Restore dialog ── */}
      <Dialog open={!!actionDialog} onOpenChange={(open) => !open && setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t(actionDialog?.type === 'revoke'
                ? 'orders.detail.entitlements.revokeTitle'
                : 'orders.detail.entitlements.restoreTitle')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t(actionDialog?.type === 'revoke'
                ? 'orders.detail.entitlements.revokeBody'
                : 'orders.detail.entitlements.restoreBody',
              { product: actionDialog?.entitlement.productTitle ?? '' })}
            </p>
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                {t('orders.detail.entitlements.reason')} <span className="text-destructive">*</span>
              </label>
              <Textarea
                placeholder={t(actionDialog?.type === 'revoke'
                  ? 'orders.detail.entitlements.revokeReasonPlaceholder'
                  : 'orders.detail.entitlements.restoreReasonPlaceholder')}
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)} disabled={actionLoading}>
              {t('common.actions.cancel')}
            </Button>
            <Button
              variant={actionDialog?.type === 'revoke' ? 'destructive' : 'default'}
              onClick={handleEntitlementAction}
              disabled={!actionReason.trim() || actionLoading}
            >
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t(actionDialog?.type === 'revoke'
                ? 'orders.detail.entitlements.revokeConfirm'
                : 'orders.detail.entitlements.restoreConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Order Cancellation Warning Dialog */}
      <Dialog open={showCancelConfirm} onOpenChange={(open) => {
        if (!open) {
          setShowCancelConfirm(false);
          setCancelConfirmationText('');
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <DialogTitle>{t('orders.detail.cancelDialog.title')}</DialogTitle>
            </div>
            <DialogDescription className="pt-3 space-y-3" asChild>
              <div>
                <p className="text-foreground">
                  <Trans
                    i18nKey="orders.detail.cancelDialog.body"
                    params={{ number: currentOrder.orderNumber }}
                    components={[<span className="font-semibold text-foreground" />]}
                  />
                </p>
                <div className="space-y-2 pt-2">
                  <label htmlFor="details-cancel-confirm-input" className="text-xs font-semibold text-muted-foreground block">
                    <Trans
                      i18nKey="orders.detail.cancelDialog.prompt"
                      params={{ word: cancelWord }}
                      components={[<span className="font-bold text-destructive" />]}
                    />
                  </label>
                  <Input
                    id="details-cancel-confirm-input"
                    placeholder={t('orders.detail.cancelDialog.placeholder', { word: cancelWord })}
                    value={cancelConfirmationText}
                    onChange={(e) => setCancelConfirmationText(e.target.value)}
                    className="h-9 border-red-200 focus-visible:ring-red-500"
                    autoComplete="off"
                  />
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex sm:justify-end gap-2 pt-2">
            <DialogClose asChild>
              <Button variant="outline">{t('orders.detail.cancelDialog.keep')}</Button>
            </DialogClose>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white font-medium focus:ring-red-500"
              disabled={cancelConfirmationText.trim().toLowerCase() !== cancelWord.toLowerCase()}
              onClick={confirmCancelOrder}
            >
              {t('orders.detail.cancelDialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
