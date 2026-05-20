import { useState } from 'react';
import {
  Package,
  Truck,
  CheckCircle,
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useOrderStore } from '@/store';
import { addNote, fetchNote, revokeEntitlement, restoreEntitlement } from '@/services/orders.service';
import type { Order, Entitlement, OrderTimelineEvent } from '@/types';
import { getNextStatuses, STATUS_LABELS } from "@/pages/Orders";

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

// const STATUS_LABELS: Record<string, string> = {
//   processing: 'Mark as Processing',
//   shipped:    'Mark as Shipped',
//   delivered:  'Mark as Delivered',
//   fulfilled:  'Mark as Fulfilled',
//   cancelled:  'Cancel Order',
// };

const timelineIcons: Record<string, React.ElementType> = {
  'order.created':          Clock,
  'payment.updated':        CreditCard,
  'fulfillment.updated':    Package,
  'delivery.agency_updated': Truck,
  'note.added':             MessageSquare,
  'entitlement.revoked':    Ban,
  'entitlement.restored':   RotateCcw,
};

export function OrderDetails({ order, onOrderUpdated }: OrderDetailsProps) {
  const { updateOrderStatus } = useOrderStore();

  // Local state for the current order (so actions can update it without refetching the page)
  const [currentOrder, setCurrentOrder] = useState<Order>(order);

  const [note, setNote] = useState('');
  const [noteLoading, setNoteLoading] = useState(false);
  const [fetchingNoteId, setFetchingNoteId] = useState<string | null>(null);

  const [statusLoading, setStatusLoading] = useState(false);

  // Entitlement action dialog
  const [actionDialog, setActionDialog] = useState<{
    type: 'revoke' | 'restore';
    entitlement: Entitlement;
  } | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const isPhysical = currentOrder.orderType === 'physical';
  const isDigital  = currentOrder.orderType === 'digital';
  const hasEntitlements = (currentOrder.entitlements?.length ?? 0) > 0;
  const nextStatuses = getNextStatuses(currentOrder.status, currentOrder.orderType);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: currentOrder.currency || 'USD' }).format(value);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    });

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleStatusUpdate = async (status: string) => {
    setStatusLoading(true);
    try {
      await updateOrderStatus(currentOrder.id, status);
      const next = { ...currentOrder, status: status as Order['status'] };
      setCurrentOrder(next);
      onOrderUpdated?.(next);
    } finally {
      setStatusLoading(false);
    }
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
        message: 'Note added',
        description: note.trim(),
        createdAt: new Date().toISOString(),
        actor: 'You',
      }
      setCurrentOrder(prev => ({ ...prev, timeline: [pseudoEvent, ...prev.timeline] }));
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
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold">{currentOrder.orderNumber}</h2>
            <Badge
              variant={
                currentOrder.status === 'delivered' || currentOrder.status === 'fulfilled' ? 'default'
                  : currentOrder.status === 'pending' ? 'secondary'
                  : currentOrder.status === 'cancelled' ? 'destructive'
                  : 'outline'
              }
              className="capitalize"
            >
              {currentOrder.status}
            </Badge>
            {isDigital ? (
              <Badge variant="outline" className="gap-1 border-violet-300 text-violet-700 bg-violet-50">
                <Download className="w-3 h-3" />Digital
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 border-blue-300 text-blue-700 bg-blue-50">
                <Package className="w-3 h-3" />Physical
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Placed on {formatDate(currentOrder.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Printer className="w-4 h-4" />
            Print
          </Button>
          {nextStatuses.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="gap-2" disabled={statusLoading}>
                  {statusLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Update Status
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
                    {STATUS_LABELS[s] ?? s}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Badge variant="outline" className="px-3 py-1 capitalize">{currentOrder.status}</Badge>
          )}
        </div>
      </div>

      <Tabs defaultValue="details" className="w-full">
        <TabsList className={`grid w-full ${hasEntitlements ? 'grid-cols-5' : 'grid-cols-4'}`}>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="items">Items ({currentOrder.items.length})</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="payment">Payment</TabsTrigger>
          {hasEntitlements && (
            <TabsTrigger value="entitlements">
              Access ({currentOrder.entitlements!.length})
            </TabsTrigger>
          )}
        </TabsList>

        {/* ── Details tab ── */}
        <TabsContent value="details" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Customer */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <User className="w-4 h-4" /> Customer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <img
                    src={currentOrder.customer.avatar || `https://i.pravatar.cc/150?u=${currentOrder.customer.id}`}
                    alt={currentOrder.customer.name}
                    className="w-12 h-12 rounded-full"
                  />
                  <div>
                    <p className="font-medium">{currentOrder.customer.name}</p>
                    <p className="text-sm text-muted-foreground">{currentOrder.customer.email}</p>
                    {currentOrder.customer.phone && (
                      <p className="text-sm text-muted-foreground">{currentOrder.customer.phone}</p>
                    )}
                  </div>
                </div>
                <div className="pt-4 border-t grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-lg font-semibold">{currentOrder.customer.orderCount}</p>
                    <p className="text-xs text-muted-foreground">Orders (this vendor)</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold">{formatCurrency(currentOrder.customer.totalSpent)}</p>
                    <p className="text-xs text-muted-foreground">Spent (this vendor)</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Shipping / Delivery method */}
            {isDigital ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Download className="w-4 h-4" /> Delivery Method
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-violet-50 border border-violet-200">
                    <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                      <Download className="w-4 h-4 text-violet-700" />
                    </div>
                    <div>
                      <p className="font-medium text-violet-900">Digital Delivery</p>
                      <p className="text-sm text-violet-700">Download links sent to customer's email</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <MapPin className="w-4 h-4" /> Shipping Address
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {currentOrder.customer.defaultAddress ? (
                    <div className="space-y-1 text-sm">
                      <p className="font-medium">
                        {currentOrder.customer.defaultAddress.firstName}{' '}
                        {currentOrder.customer.defaultAddress.lastName}
                      </p>
                      <p>{currentOrder.customer.defaultAddress.address1}</p>
                      <p>
                        {currentOrder.customer.defaultAddress.city},{' '}
                        {currentOrder.customer.defaultAddress.province}
                      </p>
                      <p>{currentOrder.customer.defaultAddress.country}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No address on file</p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Delivery agency (physical only) */}
          {isPhysical && (currentOrder.deliveryAgency || currentOrder.assignedAgent) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Truck className="w-4 h-4" /> Delivery
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 text-sm">
                {currentOrder.deliveryAgency && (
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Agency</p>
                    <p className="font-medium">{currentOrder.deliveryAgency.name}</p>
                    {currentOrder.deliveryAgency.address && (
                      <p className="text-muted-foreground">{currentOrder.deliveryAgency.address}</p>
                    )}
                  </div>
                )}
                {currentOrder.assignedAgent && (
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Assigned Agent</p>
                    <p className="font-medium">{currentOrder.assignedAgent.name}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Order Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Order Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(currentOrder.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span>{formatCurrency(currentOrder.tax)}</span>
                </div>
                {isPhysical && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shipping</span>
                    <span>{currentOrder.shipping === 0 ? 'Free' : formatCurrency(currentOrder.shipping)}</span>
                  </div>
                )}
                {currentOrder.discount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Discount</span>
                    <span className="text-green-600">-{formatCurrency(currentOrder.discount)}</span>
                  </div>
                )}
                <div className="pt-2 border-t flex justify-between">
                  <span className="font-medium">Total</span>
                  <span className="font-bold text-lg">{formatCurrency(currentOrder.total)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Items tab ── */}
        <TabsContent value="items" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-4 text-sm font-medium">Product</th>
                    <th className="text-left p-4 text-sm font-medium">SKU</th>
                    <th className="text-center p-4 text-sm font-medium">Qty</th>
                    <th className="text-right p-4 text-sm font-medium">Price</th>
                    <th className="text-right p-4 text-sm font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {currentOrder.items.map((item) => (
                    <tr key={item.id} className="border-b">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {item.image && (
                            <img src={item.image} alt={item.name} className="w-12 h-12 rounded object-cover" />
                          )}
                          <div>
                            <p className="font-medium">{item.name}</p>
                            {isDigital && (
                              <Badge variant="outline" className="mt-1 text-xs gap-1 border-violet-300 text-violet-700 bg-violet-50">
                                <Download className="w-2.5 h-2.5" />Digital
                              </Badge>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">{item.sku || '—'}</td>
                      <td className="p-4 text-center">{item.quantity}</td>
                      <td className="p-4 text-right">{formatCurrency(item.price)}</td>
                      <td className="p-4 text-right font-medium">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Timeline tab ── */}
        <TabsContent value="timeline" className="space-y-4 mt-4">
          <Card>
            <CardContent className="p-6">
              {currentOrder.timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No timeline events yet</p>
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
                          <p className="font-medium">{event.message}</p>
                          {fetchingNoteId === event.id
                            ? <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Loading note…</p>
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
                <p className="font-medium mb-3">Add Internal Note</p>
                <div className="flex gap-3">
                  <Textarea
                    placeholder="Add a note visible only to you..."
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
                    Add
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Payment tab ── */}
        <TabsContent value="payment" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CreditCard className="w-4 h-4" /> Payment Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground mb-1">Payment Status</p>
                  <Badge
                    variant={currentOrder.paymentStatus === 'paid' ? 'default' : 'secondary'}
                    className="capitalize"
                  >
                    {currentOrder.paymentStatus}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Order Type</p>
                  <p className="font-medium capitalize">{currentOrder.orderType}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Currency</p>
                  <p className="font-medium">{currentOrder.currency}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Placed At</p>
                  <p className="font-medium">{formatDate(currentOrder.createdAt)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Entitlements tab (digital only) ── */}
        {hasEntitlements && (
          <TabsContent value="entitlements" className="space-y-4 mt-4">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-violet-50 border border-violet-200 text-sm text-violet-800">
              <Shield className="w-4 h-4 mt-0.5 flex-shrink-0 text-violet-600" />
              <p>
                Manage customer access to digital products. Revoking stops the customer from
                downloading. Restoring re-enables access (only if not expired).
              </p>
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
                          <p className="font-medium truncate">{entitlement.productTitle}</p>
                          <p className="text-xs text-muted-foreground truncate">{entitlement.assetName}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge
                          variant={entitlement.isRevoked ? 'destructive' : entitlement.isExpired ? 'secondary' : 'outline'}
                          className={!entitlement.isRevoked && !entitlement.isExpired ? 'border-green-300 text-green-700 bg-green-50' : ''}
                        >
                          {entitlement.isRevoked ? 'Revoked' : entitlement.isExpired ? 'Expired' : 'Active'}
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
                            Restore
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 h-8 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                            onClick={() => openRevokeDialog(entitlement)}
                          >
                            <Ban className="w-3.5 h-3.5" />
                            Revoke
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground mb-1.5">Downloads Used</p>
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
                        <p className="text-muted-foreground mb-1">Expires</p>
                        <p className="font-medium">{formatDate(entitlement.expiresAt)}</p>
                      </div>
                      {entitlement.lastDownloadAt && (
                        <div>
                          <p className="text-muted-foreground mb-1">Last Download</p>
                          <p className="font-medium">{formatDate(entitlement.lastDownloadAt)}</p>
                        </div>
                      )}
                    </div>

                    {entitlement.isRevoked && entitlement.revokedAt && (
                      <div className="mt-3 p-3 rounded-md bg-red-50 border border-red-100 text-sm">
                        <p className="text-xs font-medium text-red-700 mb-0.5">Revoked At</p>
                        <p className="text-red-800">{formatDate(entitlement.revokedAt)}</p>
                        {entitlement.revokeReason && (
                          <>
                            <p className="text-xs font-medium text-red-700 mt-2 mb-0.5">Reason</p>
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

      {/* ── Revoke / Restore dialog ── */}
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
                ? `This will immediately stop "${actionDialog.entitlement.productTitle}" from being downloadable by the customer.`
                : `This will restore access to "${actionDialog?.entitlement.productTitle}" so the customer can download it again.`}
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
    </div>
  );
}
