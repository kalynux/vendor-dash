import { useState, useRef, useEffect } from 'react';
import {
  Package,
  Truck,
  CheckCircle,
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
import { cn } from '@/lib/utils';
import { useOrderStore } from '@/store';
import { addNote, revokeEntitlement, restoreEntitlement, fetchNote } from '@/services/orders.service';
import type { Order, Entitlement, OrderTimelineEvent } from '@/types';

type TabId = 'details' | 'items' | 'timeline' | 'payment' | 'entitlements';

const BASE_TABS: { id: TabId; label: string }[] = [
  { id: 'details', label: 'Details' },
  { id: 'items', label: 'Items' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'payment', label: 'Payment' },
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

function formatCurrency(value: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function getNextStatuses(status: string, orderType: 'physical' | 'digital'): string[] {
  switch (status) {
    case 'pending': return ['processing', 'cancelled'];
    case 'processing': return orderType === 'digital' ? ['fulfilled', 'cancelled'] : ['shipped', 'cancelled'];
    case 'shipped': return ['delivered', 'cancelled'];
    default: return [];
  }
}

const STATUS_LABELS: Record<string, string> = {
  processing: 'Mark as Processing',
  shipped: 'Mark as Shipped',
  delivered: 'Mark as Delivered',
  fulfilled: 'Mark as Fulfilled',
  cancelled: 'Cancel Order',
};

interface Props {
  order: Order | null;
  open: boolean;
  isDetailLoading: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileOrderDetailSheet({ order: initialOrder, open, isDetailLoading, onOpenChange }: Props) {
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

  const isPhysical = order.orderType === 'physical';
  const isDigital = order.orderType === 'digital';
  const hasEntitlements = (order.entitlements?.length ?? 0) > 0;
  const nextStatuses = getNextStatuses(order.status, order.orderType);

  const TABS = hasEntitlements
    ? [...BASE_TABS, { id: 'entitlements' as TabId, label: 'Access' }]
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

  const handleStatusUpdate = async (status: string) => {
    if (status === 'cancelled') {
      setCancelConfirmationText('');
      setShowCancelConfirm(true);
      return;
    }
    setStatusLoading(true);
    try {
      await updateOrderStatus(order.id, status);
      setOrder(prev => prev ? { ...prev, status: status as Order['status'] } : prev);
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
    } finally {
      setStatusLoading(false);
    }
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
        message: 'Note added',
        description: note.trim(),
        createdAt: new Date().toISOString(),
        actor: 'You',
      };
      setOrder(prev => prev ? { ...prev, timeline: [pseudoEvent, ...prev.timeline] } : prev);
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
                      <Download className="w-3 h-3" />Digital
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 text-xs border-blue-300 text-blue-700 bg-blue-50">
                      <Package className="w-3 h-3" />Physical
                    </Badge>
                  )}
                  <Button variant="outline" size="sm" className="gap-1.5 h-7 px-2.5 text-xs ml-auto">
                    <Printer className="w-3.5 h-3.5" />Print
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
                      ? `Items (${order.items.length})`
                      : tab.id === 'entitlements'
                        ? `Access (${order.entitlements!.length})`
                        : tab.label}
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
                  <div className="p-4 space-y-4">
                    {/* Customer card */}
                    <div className="bg-card rounded-xl border p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5" /> Customer
                        </p>
                        <button
                          onClick={() => setCustomerSheetOpen(true)}
                          className="w-7 h-7 rounded-full bg-muted flex items-center justify-center hover:bg-accent transition-colors"
                        >
                          <Info className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      </div>
                      <div className="flex items-center gap-3">
                        <img
                          src={customer.avatar || `https://i.pravatar.cc/150?u=${customer.id}`}
                          alt={customer.name}
                          className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="font-medium truncate">{customer.name}</p>
                          <p className="text-sm text-muted-foreground truncate">{customer.email}</p>
                          {customer.phone && (
                            <p className="text-xs text-muted-foreground">{customer.phone}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Shipping / Delivery method */}
                    {isDigital ? (
                      <div className="bg-card rounded-xl border p-4">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                          <Download className="w-3.5 h-3.5" /> Delivery Method
                        </p>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-violet-50 border border-violet-200">
                          <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                            <Download className="w-3.5 h-3.5 text-violet-700" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-violet-900">Digital Delivery</p>
                            <p className="text-xs text-violet-700">Download links sent to customer's email</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-card rounded-xl border p-4">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5" /> Shipping Address
                        </p>
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
                          <p className="text-sm text-muted-foreground">No address on file</p>
                        )}
                      </div>
                    )}

                    {/* Delivery agency (physical only) */}
                    {isPhysical && (order.deliveryAgency || order.assignedAgent) && (
                      <div className="bg-card rounded-xl border p-4">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5" /> Delivery
                        </p>
                        {order.deliveryAgency && (
                          <div className="mb-2">
                            <p className="text-xs text-muted-foreground">Agency</p>
                            <p className="text-sm font-medium">{order.deliveryAgency.name}</p>
                            {order.deliveryAgency.address && (
                              <p className="text-xs text-muted-foreground mt-0.5">{order.deliveryAgency.address}</p>
                            )}
                          </div>
                        )}
                        {order.assignedAgent && (
                          <div className={cn(order.deliveryAgency && 'pt-2 border-t mt-2')}>
                            <p className="text-xs text-muted-foreground">Assigned Agent</p>
                            <p className="text-sm font-medium">{order.assignedAgent.name}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Order summary */}
                    <div className="bg-card rounded-xl border p-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                        Order Summary
                      </p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Subtotal</span>
                          <span>{formatCurrency(order.subtotal, order.currency)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Tax</span>
                          <span>{formatCurrency(order.tax, order.currency)}</span>
                        </div>
                        {isPhysical && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Shipping</span>
                            <span>{order.shipping === 0 ? 'Free' : formatCurrency(order.shipping, order.currency)}</span>
                          </div>
                        )}
                        {order.discount > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Discount</span>
                            <span className="text-green-600">-{formatCurrency(order.discount, order.currency)}</span>
                          </div>
                        )}
                        <div className="pt-2 border-t flex justify-between">
                          <span className="font-medium">Total</span>
                          <span className="font-bold text-base">{formatCurrency(order.total, order.currency)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="h-4" />
                  </div>
                )}

                {/* ── Items ── */}
                {activeTab === 'items' && (
                  <div className="p-4 space-y-3">
                    {order.items.map((item) => (
                      <div key={item.id} className="bg-card rounded-xl border p-3 flex items-center gap-3">
                        {item.image && (
                          <img src={item.image} alt={item.name} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{item.name}</p>
                          {item.sku && <p className="text-xs text-muted-foreground">{item.sku}</p>}
                          {isDigital && (
                            <Badge variant="outline" className="mt-1 text-xs gap-1 border-violet-300 text-violet-700 bg-violet-50">
                              <Download className="w-2.5 h-2.5" />Digital
                            </Badge>
                          )}
                          <p className="text-xs text-muted-foreground mt-0.5">Qty: {item.quantity}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-semibold text-sm">{formatCurrency(item.total, order.currency)}</p>
                          <p className="text-xs text-muted-foreground">{formatCurrency(item.price, order.currency)} each</p>
                        </div>
                      </div>
                    ))}
                    <div className="h-4" />
                  </div>
                )}

                {/* ── Timeline ── */}
                {activeTab === 'timeline' && (
                  <div className="p-4">
                    {order.timeline.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">No timeline events yet</p>
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
                                <p className="font-medium text-sm">{event.message}</p>
                                {fetchingNoteId === event.id
                                  ? <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Loading note…</p>
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
                      <p className="font-medium text-sm mb-3">Add Internal Note</p>
                      <div className="flex gap-2">
                        <Textarea
                          placeholder="Add a note visible only to you..."
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
                          Add
                        </Button>
                      </div>
                    </div>
                    <div className="h-4" />
                  </div>
                )}

                {/* ── Payment ── */}
                {activeTab === 'payment' && (
                  <div className="p-4 space-y-4">
                    <div className="bg-card rounded-xl border p-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5" /> Payment Information
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Status</p>
                          <Badge
                            variant={order.paymentStatus === 'paid' ? 'default' : 'secondary'}
                            className={cn('capitalize text-xs', order.paymentStatus === 'paid' && 'bg-black text-white hover:bg-black/90')}
                          >
                            {order.paymentStatus}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Order Type</p>
                          <p className="text-sm font-medium capitalize">{order.orderType}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Currency</p>
                          <p className="text-sm font-medium">{order.currency}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Placed At</p>
                          <p className="text-sm font-medium">{formatDate(order.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                    <div className="h-4" />
                  </div>
                )}

                {/* ── Entitlements (digital only) ── */}
                {activeTab === 'entitlements' && hasEntitlements && (
                  <div className="p-4 space-y-3">
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-violet-50 border border-violet-200 text-xs text-violet-800">
                      <Shield className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-violet-600" />
                      <p>Manage customer access to digital products. Revoke or restore entitlements as needed.</p>
                    </div>

                    {order.entitlements!.map((entitlement) => {
                      const maxDl = entitlement.maxDownloads;
                      const downloadPct = maxDl === null ? 0
                        : Math.min(100, Math.round((entitlement.downloadsUsed / maxDl) * 100));

                      return (
                        <div key={entitlement.id} className="bg-card rounded-xl border p-4 space-y-3">
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
                                  {entitlement.isRevoked ? 'Revoked' : entitlement.isExpired ? 'Expired' : 'Active'}
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
                                <RotateCcw className="w-3 h-3" />Restore
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 h-7 text-xs flex-shrink-0 text-red-600 border-red-200 hover:bg-red-50"
                                onClick={() => openRevokeDialog(entitlement)}
                              >
                                <Ban className="w-3 h-3" />Revoke
                              </Button>
                            )}
                          </div>

                          {/* Download progress */}
                          <div>
                            <div className="flex justify-between text-xs mb-1.5">
                              <span className="text-muted-foreground">Downloads Used</span>
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
                            <span className="text-muted-foreground">Expires</span>
                            <span className="font-medium">{formatDate(entitlement.expiresAt)}</span>
                          </div>

                          {/* Revoke info */}
                          {entitlement.isRevoked && entitlement.revokedAt && (
                            <div className="p-2.5 rounded-md bg-red-50 border border-red-100 text-xs">
                              <p className="font-medium text-red-700 mb-0.5">Revoked At</p>
                              <p className="text-red-800">{formatDate(entitlement.revokedAt)}</p>
                              {entitlement.revokeReason && (
                                <>
                                  <p className="font-medium text-red-700 mt-2 mb-0.5">Reason</p>
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
              <div className="px-4 py-3 border-t flex-shrink-0">
                {nextStatuses.length > 0 ? (
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button className="w-full gap-2" disabled={statusLoading}>
                        {statusLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                        Update Status
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
                          {STATUS_LABELS[s] ?? s}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <div className="text-center text-sm text-muted-foreground py-1 capitalize">
                    Order {order.status} — no further actions
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
              <h3 className="text-base font-bold">Customer Info</h3>
            </div>
            <div className="overflow-y-auto max-h-[70vh]">
              <div className="p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <img
                    src={customer.avatar || `https://i.pravatar.cc/150?u=${customer.id}`}
                    alt={customer.name}
                    className="w-14 h-14 rounded-full object-cover flex-shrink-0 border"
                  />
                  <div>
                    <p className="font-semibold text-base">{customer.name}</p>
                    <p className="text-sm text-muted-foreground">{customer.email}</p>
                  </div>
                </div>

                <div className="bg-card rounded-xl border divide-y">
                  {customer.phone && (
                    <div className="flex items-center gap-3 px-4 py-3">
                      <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Phone</p>
                        <p className="text-sm font-medium">{customer.phone}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="text-sm font-medium">{customer.email}</p>
                    </div>
                  </div>
                  {customer.defaultAddress && (
                    <div className="flex items-start gap-3 px-4 py-3">
                      <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Address</p>
                        <p className="text-sm font-medium">
                          {customer.defaultAddress.address1}, {customer.defaultAddress.city},{' '}
                          {customer.defaultAddress.province}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-card rounded-xl border p-3 text-center">
                    <p className="text-2xl font-bold">{customer.orderCount}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Orders (this vendor)</p>
                  </div>
                  <div className="bg-card rounded-xl border p-3 text-center">
                    <p className="text-2xl font-bold">{formatCurrency(customer.totalSpent, order.currency)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Total Spent</p>
                  </div>
                </div>

                <Button className="w-full gap-2">
                  <UserPlus className="w-4 h-4" />
                  Add to Customers
                </Button>
                <div className="h-2" />
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
              {actionDialog?.type === 'revoke' ? 'Revoke Entitlement' : 'Restore Entitlement'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {actionDialog?.type === 'revoke'
                ? `This will immediately stop "${actionDialog.entitlement.productTitle}" from being downloadable.`
                : `This will restore access to "${actionDialog?.entitlement.productTitle}".`}
            </p>
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Reason <span className="text-destructive">*</span>
              </label>
              <Textarea
                placeholder={actionDialog?.type === 'revoke' ? 'e.g. Customer requested refund' : 'e.g. Issue resolved'}
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button
              variant={actionDialog?.type === 'revoke' ? 'destructive' : 'default'}
              onClick={handleEntitlementAction}
              disabled={!actionReason.trim() || actionLoading}
            >
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {actionDialog?.type === 'revoke' ? 'Revoke Access' : 'Restore Access'}
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
              <DialogTitle>Cancel Order?</DialogTitle>
            </div>
            <DialogDescription className="pt-3 space-y-3" asChild>
              <div>
                <p className="text-foreground text-sm">
                  Are you sure you want to cancel order <span className="font-semibold text-foreground">{order.orderNumber}</span>? This action cannot be undone.
                </p>
                <div className="space-y-2 pt-2">
                  <label htmlFor="mobile-cancel-confirm-input" className="text-xs font-semibold text-muted-foreground block">
                    Please type <span className="font-bold text-destructive">cancel</span> to confirm:
                  </label>
                  <Input
                    id="mobile-cancel-confirm-input"
                    placeholder='Type "cancel"'
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
              <Button variant="outline">Keep Order</Button>
            </DialogClose>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white font-medium focus:ring-red-500"
              disabled={cancelConfirmationText.trim().toLowerCase() !== 'cancel'}
              onClick={confirmCancelOrder}
            >
              Yes, Cancel Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
