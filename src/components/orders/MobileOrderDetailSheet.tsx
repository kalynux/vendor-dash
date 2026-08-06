import { useState, useRef, useEffect } from 'react';
import {
  Package,
  Truck,
  Clock,
  MapPin,
  CreditCard,
  User,
  MessageSquare,
  Send,
  Printer,
  Phone,
  Mail,
  Info,
  UserPlus,
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
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { OrderStatusBadge } from './OrderStatusBadge';
import { PaymentStatusBadge } from './PaymentStatusBadge';
import { DeliveryStatusBadge } from './DeliveryStatusBadge';
import { DeliveryRejectionNotice } from './DeliveryRejectionNotice';
import { ReassignAgencyPopover } from './ReassignAgencyPopover';
import { cn } from '@/lib/utils';
import { useOrderStore } from '@/store';
import { addNote, revokeEntitlement, restoreEntitlement, fetchNote, dispatchOrder, getOrderErrorMessage, isOrderFrozen } from '@/services/orders.service';
import { getNextStatuses, STATUS_ACTION_KEYS, ORDER_STATUS_KEYS, canDispatchOrder } from '@/lib/orderStatus';
import { ApiError } from '@/types/api';
import { toast } from 'sonner';
import { formatPhoneInternational } from '@/lib/phone';
import { useTranslation, useFormatters, Trans, type TranslationKey } from '@/i18n';
import type { Order, Entitlement, OrderTimelineEvent, VendorSettableStatus } from '@/types';

const REASSIGNABLE_DELIVERY_STATUSES = ['pending', 'assigned', 'pending_agency_reassignment'];

type TabId = 'details' | 'items' | 'timeline' | 'payment' | 'entitlements';

const BASE_TABS: { id: TabId; labelKey: TranslationKey }[] = [
  { id: 'details', labelKey: 'orders.detail.tabs.details' },
  { id: 'items', labelKey: 'orders.detail.tabs.items' },
  { id: 'timeline', labelKey: 'orders.detail.tabs.timeline' },
  { id: 'payment', labelKey: 'orders.detail.tabs.payment' },
];

const timelineIcons: Record<string, React.ElementType> = {
  'order.created': Clock,
  'payment.updated': CreditCard,
  'fulfillment.updated': Package,
  'delivery.agency_updated': Truck,
  'note.added': MessageSquare,
  'entitlement.revoked': Ban,
  'entitlement.restored': RotateCcw,
};

/**
 * One block of sheet content. Runs edge-to-edge and is separated from its
 * neighbours by a hairline rather than being boxed in its own bordered card —
 * on a phone the nested card padding stole ~48px of width from every row.
 */
function Section({
  title,
  icon: Icon,
  action,
  children,
}: {
  title?: string;
  icon?: React.ElementType;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b px-4 py-4 last:border-b-0">
      {(title || action) && (
        <div className="flex items-center justify-between gap-2 mb-3">
          {title && (
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              {Icon && <Icon className="w-3.5 h-3.5" />} {title}
            </p>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

interface Props {
  order: Order | null;
  open: boolean;
  isDetailLoading: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileOrderDetailSheet({ order: initialOrder, open, isDetailLoading, onOpenChange }: Props) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const { updateOrderStatus } = useOrderStore();

  const [order, setOrder] = useState<Order | null>(initialOrder);
  const [activeTab, setActiveTab] = useState<TabId>('details');
  const [customerSheetOpen, setCustomerSheetOpen] = useState(false);
  const touchStartX = useRef(0);

  // Note
  const [note, setNote] = useState('');
  const [noteLoading, setNoteLoading] = useState(false);
  const [fetchingNoteId, setFetchingNoteId] = useState<string | null>(null);

  // Status update
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

  useEffect(() => {
    if (open) {
      setActiveTab('details');
      setOrder(initialOrder);
    }
  }, [open, initialOrder]);

  if (!order) return null;

  const formatCurrency = (value: number, currency = 'XAF') => fmt.currency(value, currency);
  const formatDate = (dateStr: string) => fmt.dateTime(dateStr);

  const isPhysical = order.orderType === 'physical';
  const isDigital = order.orderType === 'digital';
  const hasEntitlements = (order.entitlements?.length ?? 0) > 0;
  const frozen = isOrderFrozen(order);
  const nextStatuses = frozen ? [] : getNextStatuses(order.status);
  const canDispatch = canDispatchOrder(order);
  // Translated, so the confirm check reads the same key the prompt renders.
  const cancelWord = t('orders.detail.cancelDialog.confirmWord');

  const TABS = hasEntitlements
    ? [...BASE_TABS, { id: 'entitlements' as TabId, labelKey: 'orders.detail.tabs.access' as TranslationKey }]
    : BASE_TABS;

  const currentIndex = TABS.findIndex((t) => t.id === activeTab);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) < 50) return;
    if (diff > 0 && currentIndex < TABS.length - 1) setActiveTab(TABS[currentIndex + 1].id);
    else if (diff < 0 && currentIndex > 0) setActiveTab(TABS[currentIndex - 1].id);
  };

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleStatusUpdate = async (status: VendorSettableStatus) => {
    if (status === 'cancelled') {
      setCancelConfirmationText('');
      setShowCancelConfirm(true);
      return;
    }
    setStatusLoading(true);
    try {
      await updateOrderStatus(order.id, status);
      setOrder(prev => prev ? { ...prev, status: status as Order['status'] } : prev);
      toast.success(t('orders.toast.markedAs', { status: t(ORDER_STATUS_KEYS[status]) }));
    } catch (err) {
      if (err instanceof ApiError && err.status === 423 && err.code === 'ORDER_DISPUTE_HOLD') {
        setOrder(prev => prev ? {
          ...prev,
          paymentStatus: 'disputed',
          disputeHold: { ...(prev.disputeHold ?? {}), active: true },
        } : prev);
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
      await updateOrderStatus(order.id, 'cancelled');
      setOrder(prev => prev ? { ...prev, status: 'cancelled' as Order['status'] } : prev);
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
      const { order: updated } = await dispatchOrder(order.id);
      setOrder(updated);
      toast.success(t('orders.toast.dispatched'));
    } catch (err) {
      toast.error(getOrderErrorMessage(err));
    } finally {
      setDispatchLoading(false);
    }
  };

  const handleItemReassigned = (updated: Order) => {
    setOrder(updated);
  };

  const handleAddNote = async () => {
    if (!note.trim()) return;
    setNoteLoading(true);
    try {
      await addNote(order.id, note.trim());
      setNote('');
      const pseudoEvent = {
        id: `local-${Date.now()}`,
        type: 'note.added' as const,
        messageKey: 'orders.detail.timeline.noteAdded' as const,
        messageFallback: 'note added',
        description: note.trim(),
        createdAt: new Date().toISOString(),
        actor: t('orders.detail.timeline.you'),
      };
      setOrder(prev => prev ? { ...prev, timeline: [pseudoEvent, ...prev.timeline] } : prev);
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
      const message = await fetchNote(order.id, event.noteId);
      setOrder(prev => prev ? {
        ...prev,
        timeline: prev.timeline.map(e =>
          e.id === event.id ? { ...e, description: message } : e,
        ),
      } : prev);
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
      setOrder(prev => {
        if (!prev) return prev;
        return {
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
        };
      });
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

  const { customer } = order;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[90vh] p-0 rounded-t-2xl [&>button]:top-3 [&>button]:right-3">
          {isDetailLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
          ) : (
            order && <div className="flex flex-col h-full">
              {/* Header */}
              <div className="px-4 pt-3 pb-3 border-b flex-shrink-0 pr-12">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold">{order.orderNumber}</h2>
                  <OrderStatusBadge status={order.status} />
                  {isDigital ? (
                    <Badge variant="outline" className="gap-1 text-xs border-violet-300 text-violet-700 bg-violet-50">
                      <Download className="w-3 h-3" />{t('orders.orderType.digital')}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 text-xs border-blue-300 text-blue-700 bg-blue-50">
                      <Package className="w-3 h-3" />{t('orders.orderType.physical')}
                    </Badge>
                  )}
                  {order.paymentMethod === 'cash_on_delivery' && (
                    <Badge variant="outline" className="gap-1 text-xs border-amber-300 text-amber-700 bg-amber-50">
                      <Banknote className="w-3 h-3" />{t('orders.paymentMethod.cashOnDeliveryShort')}
                    </Badge>
                  )}
                  <Button variant="outline" size="sm" className="gap-1.5 h-7 px-2.5 text-xs ml-auto">
                    <Printer className="w-3.5 h-3.5" />{t('common.actions.print')}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{customer.name}</p>
              </div>

              {/* Tab bar */}
              <div className="flex border-b flex-shrink-0 overflow-x-auto">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'flex-1 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px whitespace-nowrap px-2',
                      activeTab === tab.id
                        ? 'border-foreground text-foreground'
                        : 'border-transparent text-muted-foreground',
                    )}
                  >
                    {tab.id === 'items'
                      ? t('orders.detail.tabs.itemsWithCount', { count: order.items.length })
                      : tab.id === 'entitlements'
                        ? t('orders.detail.tabs.accessWithCount', { count: order.entitlements!.length })
                        : t(tab.labelKey)}
                  </button>
                ))}
              </div>

              {/* Swipeable content */}
              <div
                className="flex-1 overflow-y-auto min-h-0"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
              >
                {/* ── Details ── */}
                {activeTab === 'details' && (
                  <div>
                    <Section
                      title={t('orders.detail.customer.title')}
                      icon={User}
                      action={
                        <button
                          onClick={() => setCustomerSheetOpen(true)}
                          className="w-7 h-7 rounded-full bg-muted flex items-center justify-center hover:bg-accent transition-colors flex-shrink-0"
                        >
                          <Info className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      }
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={customer.avatar || `https://i.pravatar.cc/150?u=${customer.id}`}
                          alt={customer.name}
                          crossOrigin="use-credentials"
                          className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="font-medium truncate">{customer.name}</p>
                          <p className="text-sm text-muted-foreground truncate">{customer.email}</p>
                          {customer.phone && (
                            <p className="text-xs text-muted-foreground">
                              {formatPhoneInternational(customer.phone)}
                            </p>
                          )}
                        </div>
                      </div>
                    </Section>

                    {/* Shipping / Delivery method */}
                    {isDigital ? (
                      <Section title={t('orders.detail.shipping.deliveryMethodTitle')} icon={Download}>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-violet-50 border border-violet-200">
                          <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                            <Download className="w-3.5 h-3.5 text-violet-700" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-violet-900">{t('orders.detail.shipping.digitalDelivery')}</p>
                            <p className="text-xs text-violet-700">{t('orders.detail.shipping.digitalDeliveryNoteShort')}</p>
                          </div>
                        </div>
                      </Section>
                    ) : (
                      <Section title={t('orders.detail.shipping.addressTitle')} icon={MapPin}>
                        {customer.defaultAddress ? (
                          <div className="text-sm space-y-0.5">
                            <p className="font-medium">
                              {customer.defaultAddress.firstName} {customer.defaultAddress.lastName}
                            </p>
                            <p>{customer.defaultAddress.address1}</p>
                            <p>{customer.defaultAddress.city}, {customer.defaultAddress.province}</p>
                            <p>{customer.defaultAddress.country}</p>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">{t('orders.detail.shipping.noAddress')}</p>
                        )}
                      </Section>
                    )}

                    {/* Shipments (physical, multi-agency) */}
                    {isPhysical && order.deliveries && order.deliveries.length > 0 && (
                      <Section
                        title={order.deliveries.length > 1
                          ? t('orders.detail.shipping.shipmentsTitleWithCount', { count: order.deliveries.length })
                          : t('orders.detail.shipping.shipmentsTitle')}
                        icon={Truck}
                      >
                        {order.deliveries.map((shipment, i) => (
                          <div key={shipment.shipmentId ?? i} className={cn(i > 0 && 'pt-2 border-t mt-2')}>
                            <p className="text-xs text-muted-foreground">{t('orders.detail.shipping.agency')}</p>
                            <p className="text-sm font-medium">{shipment.agencyName ?? t('common.labels.emptyValue')}</p>
                            {shipment.agencyPhone && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {formatPhoneInternational(shipment.agencyPhone)}
                              </p>
                            )}
                            <div className="mt-1.5"><DeliveryStatusBadge status={shipment.deliveryStatus} size="xs" /></div>
                            {shipment.agent && (
                              <p className="text-xs text-muted-foreground mt-1.5"><Trans i18nKey="orders.detail.shipping.agent" params={{ name: shipment.agent.name }} components={[<span className="font-medium text-foreground" />]} /></p>
                            )}
                            {shipment.trackingNumber && (
                              <p className="text-xs text-muted-foreground mt-0.5">{t('orders.detail.shipping.tracking', { number: shipment.trackingNumber })}</p>
                            )}
                          </div>
                        ))}
                      </Section>
                    )}

                    <Section title={t('orders.detail.summary.title')}>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t('orders.detail.summary.subtotal')}</span>
                          <span>{formatCurrency(order.subtotal, order.currency)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t('orders.detail.summary.tax')}</span>
                          <span>{formatCurrency(order.tax, order.currency)}</span>
                        </div>
                        {isPhysical && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{t('orders.detail.summary.shipping')}</span>
                            <span>{order.shipping === 0 ? t('orders.detail.summary.free') : formatCurrency(order.shipping, order.currency)}</span>
                          </div>
                        )}
                        {order.discount > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{t('orders.detail.summary.discount')}</span>
                            <span className="text-green-600">-{formatCurrency(order.discount, order.currency)}</span>
                          </div>
                        )}
                        <div className="pt-2 border-t flex justify-between">
                          <span className="font-medium">{t('orders.detail.summary.total')}</span>
                          <span className="font-bold text-base">{formatCurrency(order.total, order.currency)}</span>
                        </div>
                      </div>
                    </Section>
                    <div className="h-4" />
                  </div>
                )}

                {/* ── Items ── */}
                {activeTab === 'items' && (
                  <div>
                    {order.items.map((item) => (
                      <div key={item.id} className="border-b px-4 py-3 space-y-2">
                        <div className="flex items-center gap-3">
                          {item.image && (
                            <img src={item.image} alt={item.name} crossOrigin="use-credentials" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{item.name}</p>
                            {item.sku && <p className="text-xs text-muted-foreground">{item.sku}</p>}
                            {(isDigital || item.delivery?.freeDelivery) && (
                              <div className="flex items-center gap-1.5 mt-1">
                                {isDigital && (
                                  <Badge variant="outline" className="text-xs gap-1 border-violet-300 text-violet-700 bg-violet-50">
                                    <Download className="w-2.5 h-2.5" />{t('orders.orderType.digital')}
                                  </Badge>
                                )}
                                {item.delivery?.freeDelivery && (
                                  <Badge variant="outline" className="text-xs gap-1 border-green-300 text-green-700 bg-green-50">
                                    <Truck className="w-2.5 h-2.5" />{t('orders.detail.shipping.freeDelivery')}
                                  </Badge>
                                )}
                              </div>
                            )}
                            <p className="text-xs text-muted-foreground mt-0.5">{t('orders.detail.items.qty', { count: item.quantity })}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-semibold text-sm">{formatCurrency(item.total, order.currency)}</p>
                            <p className="text-xs text-muted-foreground">{t('orders.detail.items.unitPrice', { price: formatCurrency(item.price, order.currency) })}</p>
                          </div>
                        </div>
                        {isPhysical && item.delivery && (
                          <div className="pt-2 border-t space-y-1.5">
                            <div className="flex items-center gap-1.5 flex-wrap text-xs">
                              <Truck className="w-3 h-3 text-muted-foreground" />
                              <span className="font-medium">{item.delivery.agencyName ?? t('orders.detail.shipping.noAgency')}</span>
                              <DeliveryStatusBadge status={item.delivery.deliveryStatus} size="xs" />
                            </div>
                            {item.delivery.trackingNumber && (
                              <p className="text-xs text-muted-foreground">{t('orders.detail.shipping.tracking', { number: item.delivery.trackingNumber })}</p>
                            )}
                            {item.delivery.rejection && (
                              <DeliveryRejectionNotice rejection={item.delivery.rejection} size="xs" />
                            )}
                            {item.delivery.deliveryStatus && REASSIGNABLE_DELIVERY_STATUSES.includes(item.delivery.deliveryStatus) && (
                              <ReassignAgencyPopover
                                orderId={order.id}
                                itemId={item.id}
                                currentAgencyId={item.delivery.agencyId}
                                onReassigned={handleItemReassigned}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                    <div className="h-4" />
                  </div>
                )}

                {/* ── Timeline ── */}
                {activeTab === 'timeline' && (
                  <div className="p-4">
                    {order.timeline.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">{t('orders.detail.timeline.empty')}</p>
                    ) : (
                      <div className="space-y-4">
                        {order.timeline.map((event, index) => {
                          const Icon = timelineIcons[event.type] ?? Clock;
                          const isLast = index === order.timeline.length - 1;
                          const isClickable = !!event.noteId && (event.description?.length ?? 0) >= 100;
                          return (
                            <div key={event.id} className="flex gap-3" onClick={() => isClickable && handleGetNote(event)}>
                              <div className="flex flex-col items-center">
                                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                  <Icon className="w-4 h-4 text-primary" />
                                </div>
                                {!isLast && <div className="w-0.5 flex-1 bg-border mt-2" />}
                              </div>
                              <div className={`flex-1 pb-4 rounded-lg p-2 ${isClickable ? 'cursor-pointer hover:bg-accent' : ''}`}>
                                <p className="font-medium text-sm">
                                  {event.messageKey ? t(event.messageKey, event.messageParams) : event.messageFallback}
                                </p>
                                {fetchingNoteId === event.id
                                  ? <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />{t('orders.detail.timeline.loadingNote')}</p>
                                  : event.description && <p className="text-xs text-muted-foreground block">• {event.description}</p>
                                }
                                <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                                  <span>{event.actor}</span>
                                  <span>·</span>
                                  <span>{formatDate(event.createdAt)}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="mt-4 pt-4 border-t">
                      <p className="font-medium text-sm mb-3">{t('orders.detail.timeline.addNote')}</p>
                      <div className="flex gap-2">
                        <Textarea
                          placeholder={t('orders.detail.timeline.notePlaceholder')}
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          className="flex-1 text-sm"
                          rows={3}
                        />
                        <Button
                          size="sm"
                          className="gap-1.5 self-end"
                          disabled={!note.trim() || noteLoading}
                          onClick={handleAddNote}
                        >
                          {noteLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          {t('common.actions.add')}
                        </Button>
                      </div>
                    </div>

                    {/* Delivery Timeline (physical, multi-agency shipment history) */}
                    {isPhysical && order.deliveryTimeline && order.deliveryTimeline.length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="font-medium text-sm mb-3 flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5" /> {t('orders.detail.shipping.deliveryTimeline')}
                        </p>
                        <div className="space-y-4">
                          {order.deliveryTimeline.map((entry, index) => {
                            const isLast = index === order.deliveryTimeline!.length - 1;
                            return (
                              <div key={`${entry.shipmentId}-${entry.changedAt}-${index}`} className="flex gap-3">
                                <div className="flex flex-col items-center">
                                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                    <Truck className="w-4 h-4 text-primary" />
                                  </div>
                                  {!isLast && <div className="w-0.5 flex-1 bg-border mt-2" />}
                                </div>
                                <div className="flex-1 pb-4 rounded-lg p-2">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className="font-medium text-sm">{entry.agencyName}</p>
                                    <DeliveryStatusBadge status={entry.status} size="xs" />
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground capitalize">
                                    <span>{entry.changedByRole}</span>
                                    <span>·</span>
                                    <span>{formatDate(entry.changedAt)}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <div className="h-4" />
                  </div>
                )}

                {/* ── Payment ── */}
                {activeTab === 'payment' && (
                  <div>
                    <Section title={t('orders.detail.payment.title')} icon={CreditCard}>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">{t('orders.detail.payment.statusShort')}</p>
                          <PaymentStatusBadge status={order.paymentStatus} size="xs" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">{t('orders.detail.payment.method')}</p>
                          <p className="text-sm font-medium">
                            {t(order.paymentMethod === 'cash_on_delivery'
                              ? 'orders.paymentMethod.cashOnDelivery'
                              : 'orders.paymentMethod.online')}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">{t('orders.detail.payment.orderType')}</p>
                          <p className="text-sm font-medium">{t(`orders.orderType.${order.orderType}`)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">{t('orders.detail.payment.currency')}</p>
                          <p className="text-sm font-medium">{order.currency}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">{t('orders.detail.payment.placedAt')}</p>
                          <p className="text-sm font-medium">{formatDate(order.createdAt)}</p>
                        </div>
                      </div>
                      {frozen && (
                        <div className="mt-3 flex items-start gap-2 rounded-md bg-orange-50 border border-orange-100 p-2.5 text-xs">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-orange-600" />
                          <p className="text-orange-700/90">
                            <span className="font-medium text-orange-800">{t('orders.detail.dispute.paymentShortTitle')}</span>{' '}
                            {t('orders.detail.dispute.paymentShortBody')}
                          </p>
                        </div>
                      )}
                    </Section>
                    <div className="h-4" />
                  </div>
                )}

                {/* ── Entitlements (digital only) ── */}
                {activeTab === 'entitlements' && hasEntitlements && (
                  <div>
                    <div className="flex items-start gap-2 border-b bg-violet-50 px-4 py-3 text-xs text-violet-800">
                      <Shield className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-violet-600" />
                      <p>{t('orders.detail.entitlements.introShort')}</p>
                    </div>

                    {order.entitlements!.map((entitlement) => {
                      const maxDl = entitlement.maxDownloads;
                      const downloadPct = maxDl === null ? 0
                        : Math.min(100, Math.round((entitlement.downloadsUsed / maxDl) * 100));

                      return (
                        <div key={entitlement.id} className="border-b px-4 py-4 space-y-3">
                          {/* Top row */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${entitlement.isRevoked ? 'bg-red-100' : entitlement.isExpired ? 'bg-gray-100' : 'bg-violet-100'}`}>
                                <Download className={`w-4 h-4 ${entitlement.isRevoked ? 'text-red-600' : entitlement.isExpired ? 'text-gray-500' : 'text-violet-700'}`} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{entitlement.productTitle}</p>
                                {entitlement.variantName && (
                                  <p className="text-xs font-medium text-violet-700 truncate">{entitlement.variantName}</p>
                                )}
                                <p className="text-xs text-muted-foreground truncate">{entitlement.assetName}</p>
                                <Badge
                                  variant={entitlement.isRevoked ? 'destructive' : entitlement.isExpired ? 'secondary' : 'outline'}
                                  className={cn('text-xs mt-0.5', !entitlement.isRevoked && !entitlement.isExpired && 'border-green-300 text-green-700 bg-green-50')}
                                >
                                  {t(entitlement.isRevoked
                                    ? 'orders.detail.entitlements.revoked'
                                    : entitlement.isExpired
                                      ? 'orders.detail.entitlements.expired'
                                      : 'orders.detail.entitlements.active')}
                                </Badge>
                              </div>
                            </div>

                            {entitlement.isRevoked ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 h-7 text-xs flex-shrink-0"
                                disabled={entitlement.isExpired}
                                onClick={() => openRestoreDialog(entitlement)}
                              >
                                <RotateCcw className="w-3 h-3" />{t('orders.detail.entitlements.restore')}
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 h-7 text-xs flex-shrink-0 text-red-600 border-red-200 hover:bg-red-50"
                                onClick={() => openRevokeDialog(entitlement)}
                              >
                                <Ban className="w-3 h-3" />{t('orders.detail.entitlements.revoke')}
                              </Button>
                            )}
                          </div>

                          {/* Download progress */}
                          <div>
                            <div className="flex justify-between text-xs mb-1.5">
                              <span className="text-muted-foreground">{t('orders.detail.entitlements.downloadsUsed')}</span>
                              <span className="font-medium">
                                {entitlement.downloadsUsed} / {maxDl === null ? '∞' : maxDl}
                              </span>
                            </div>
                            {maxDl !== null && (
                              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${entitlement.isRevoked ? 'bg-red-400' : 'bg-violet-500'}`}
                                  style={{ width: `${downloadPct}%` }}
                                />
                              </div>
                            )}
                          </div>

                          {/* Expiry */}
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{t('orders.detail.entitlements.expires')}</span>
                            <span className="font-medium">{formatDate(entitlement.expiresAt)}</span>
                          </div>

                          {/* Revoke info */}
                          {entitlement.isRevoked && entitlement.revokedAt && (
                            <div className="p-2.5 rounded-md bg-red-50 border border-red-100 text-xs">
                              <p className="font-medium text-red-700 mb-0.5">{t('orders.detail.entitlements.revokedAt')}</p>
                              <p className="text-red-800">{formatDate(entitlement.revokedAt)}</p>
                              {entitlement.revokeReason && (
                                <>
                                  <p className="font-medium text-red-700 mt-2 mb-0.5">{t('orders.detail.entitlements.reason')}</p>
                                  <p className="text-red-800">{entitlement.revokeReason}</p>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div className="h-4" />
                  </div>
                )}
              </div>

              {/* Action footer */}
              <div className="px-4 py-3 border-t flex-shrink-0 space-y-2">
                {canDispatch && (
                  <Button variant="outline" className="w-full gap-2" disabled={dispatchLoading} onClick={handleDispatch}>
                    {dispatchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackageCheck className="w-4 h-4" />}
                    {t('orders.actions.dispatchToAgency')}
                  </Button>
                )}
                {nextStatuses.length > 0 ? (
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button className="w-full gap-2" disabled={statusLoading}>
                        {statusLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                        {t('orders.actions.updateStatus')}
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="center" className="w-56">
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
                ) : frozen ? (
                  <div className="flex items-center justify-center gap-2 py-1 text-sm text-orange-700">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    <span>{t('orders.detail.dispute.footerFrozen')}</span>
                  </div>
                ) : (
                  <div className="text-center text-sm text-muted-foreground py-1">
                    {t('orders.detail.noFurtherActions', { status: t(ORDER_STATUS_KEYS[order.status]) })}
                  </div>
                )}
              </div>
            </div>
          )}

        </SheetContent>
      </Sheet>

      {/* Customer info sheet */}
      <Sheet open={customerSheetOpen} onOpenChange={setCustomerSheetOpen}>
        <SheetContent side="bottom" className="p-0 rounded-t-2xl [&>button]:top-3 [&>button]:right-3">
          <div className="flex flex-col">
            <div className="px-4 pt-4 pb-3 border-b pr-12">
              <h3 className="text-base font-bold">{t('orders.detail.customer.infoTitle')}</h3>
            </div>
            <div className="overflow-y-auto max-h-[70vh]">
              <div className="flex items-center gap-3 border-b px-4 py-4">
                <img
                  src={customer.avatar || `https://i.pravatar.cc/150?u=${customer.id}`}
                  alt={customer.name}
                  crossOrigin="use-credentials"
                  className="w-14 h-14 rounded-full object-cover flex-shrink-0 border"
                />
                <div className="min-w-0">
                  <p className="font-semibold text-base truncate">{customer.name}</p>
                  <p className="text-sm text-muted-foreground truncate">{customer.email}</p>
                </div>
              </div>

              <div className="divide-y border-b">
                {customer.phone && (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">{t('common.labels.phone')}</p>
                      <p className="text-sm font-medium">
                        {formatPhoneInternational(customer.phone)}
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3 px-4 py-3">
                  <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{t('common.labels.email')}</p>
                    <p className="text-sm font-medium truncate">{customer.email}</p>
                  </div>
                </div>
                {customer.defaultAddress && (
                  <div className="flex items-start gap-3 px-4 py-3">
                    <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">{t('common.labels.address')}</p>
                      <p className="text-sm font-medium">
                        {customer.defaultAddress.address1}, {customer.defaultAddress.city},{' '}
                        {customer.defaultAddress.province}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 divide-x border-b">
                <div className="px-4 py-3 text-center">
                  <p className="text-2xl font-bold">{customer.orderCount}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('orders.detail.customer.orderCount')}</p>
                </div>
                <div className="px-4 py-3 text-center">
                  <p className="text-2xl font-bold">{formatCurrency(customer.totalSpent, order.currency)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('orders.detail.customer.totalSpentLong')}</p>
                </div>
              </div>

              <div className="px-4 py-4">
                <Button className="w-full gap-2">
                  <UserPlus className="w-4 h-4" />
                  {t('orders.detail.customer.addToCustomers')}
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Revoke / Restore dialog */}
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
                ? 'orders.detail.entitlements.revokeBodyShort'
                : 'orders.detail.entitlements.restoreBodyShort',
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
        <DialogContent className="max-w-[calc(100%-2rem)] rounded-lg">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <DialogTitle>{t('orders.detail.cancelDialog.title')}</DialogTitle>
            </div>
            <DialogDescription className="pt-3 space-y-3" asChild>
              <div>
                <p className="text-foreground text-sm">
                  <Trans
                    i18nKey="orders.detail.cancelDialog.bodyShort"
                    params={{ number: order.orderNumber }}
                    components={[<span className="font-semibold text-foreground" />]}
                  />
                </p>
                <div className="space-y-2 pt-2">
                  <label htmlFor="mobile-cancel-confirm-input" className="text-xs font-semibold text-muted-foreground block">
                    <Trans
                      i18nKey="orders.detail.cancelDialog.prompt"
                      params={{ word: cancelWord }}
                      components={[<span className="font-bold text-destructive" />]}
                    />
                  </label>
                  <Input
                    id="mobile-cancel-confirm-input"
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
          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-2">
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
    </>
  );
}
