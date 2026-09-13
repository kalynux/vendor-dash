import { useCallback, useEffect, useState } from 'react';
import {
  Loader2, Pencil, Check, X, Mail, Phone, MapPin, ShoppingBag, Wallet,
  Tag, Plus, RotateCcw, XCircle, ChevronDown, Package, Download,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { formatPhoneInternational } from '@/lib/phone';
import { CustomerAvatar } from '@/components/customers/CustomerAvatar';
import { FlagBadge, FlagDot } from '@/components/customers/FlagBadge';
import { RefundDialog } from '@/components/customers/RefundDialog';
import { responsiveSheetProps } from '@/components/ui/responsive-sheet';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTranslation, useFormatters, useApiError, type TranslationKey } from '@/i18n';
import {
  fetchCustomerById, isClosedAccount, updateCustomerName, updateCustomerFlags,
} from '@/services/customers.service';
import { fetchOrders } from '@/services/orders.service';
import { ApiError } from '@/types/api';
import type { CustomerDetail, CustomerFlag } from '@/types/customers.types';
import type { Order } from '@/types';

interface CustomerDetailSheetProps {
  customerId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** All of the vendor's flags (for the assignment picker). */
  availableFlags: CustomerFlag[];
  /** Called with the updated detail after a name/flag change so the list can sync. */
  onUpdated: (detail: CustomerDetail) => void;
  /** Opens the flags manager (e.g. when the vendor has no flags yet). */
  onManageFlags: () => void;
}

const ORDERS_PREVIEW_LIMIT = 10;

/** Payment statuses that allow attempting a refund (eligibility re-checked live). */
const REFUNDABLE_PAYMENT = new Set(['paid', 'partially_refunded']);

export function CustomerDetailSheet({
  customerId, open, onOpenChange, availableFlags, onUpdated, onManageFlags,
}: CustomerDetailSheetProps) {
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const fmt = useFormatters();
  const apiError = useApiError();
  const sheet = responsiveSheetProps(isMobile, 'sm:max-w-2xl');

  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Whether this row is an anonymised, closed account.
   *
   * Closure keeps the customer and their order history but erases every
   * identifier, so such a row still appears in the list with its totals and
   * flags intact and nothing to contact. There is no flag on the DTO to branch
   * on — the literal name is the only signal. See api-doc/me/account-closure.md.
   */
  const closedAccount = customer ? isClosedAccount(customer) : false;

  // Name override editing
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [savingName, setSavingName] = useState(false);

  // Flags
  const [flagsBusy, setFlagsBusy] = useState(false);
  const [flagPickerOpen, setFlagPickerOpen] = useState(false);

  // Orders
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [ordersTotal, setOrdersTotal] = useState(0);

  // Refund
  const [refundOrderTarget, setRefundOrderTarget] = useState<Order | null>(null);

  const loadOrders = useCallback((id: string) => {
    setOrdersLoading(true);
    setOrdersError(null);
    fetchOrders({ customerId: id, limit: ORDERS_PREVIEW_LIMIT, sortBy: 'created_at', sortOrder: 'desc' })
      .then((r) => {
        setOrders(r.data);
        setOrdersTotal(r.meta.total);
      })
      .catch((err) => setOrdersError(apiError.resolve(err, { fallbackKey: 'customers.errors.loadOrdersFailed' })))
      .finally(() => setOrdersLoading(false));
  }, [apiError]);

  useEffect(() => {
    if (!open || !customerId) return;
    let active = true;
    setLoading(true);
    setError(null);
    setEditingName(false);
    setCustomer(null);
    setOrders([]);
    fetchCustomerById(customerId)
      .then((data) => {
        if (!active) return;
        setCustomer(data);
        setDraftName(data.displayName);
      })
      .catch((err) => {
        if (active) setError(apiError.resolve(err, { fallbackKey: 'customers.errors.loadDetailFailed' }));
      })
      .finally(() => active && setLoading(false));
    loadOrders(customerId);
    return () => {
      active = false;
    };
  }, [open, customerId, loadOrders, apiError]);

  function applyDetail(detail: CustomerDetail) {
    setCustomer(detail);
    setDraftName(detail.displayName);
    onUpdated(detail);
  }

  async function saveName() {
    if (!customer) return;
    const next = draftName.trim();
    setSavingName(true);
    try {
      const updated = await updateCustomerName(customer.customerId, { displayName: next || null });
      applyDetail(updated);
      setEditingName(false);
      toast.success(
        next ? t('customers.toast.nameUpdated') : t('customers.toast.nameReset'),
      );
    } catch (err) {
      apiError.toast(err, { fallbackKey: 'customers.errors.updateNameFailed' });
    } finally {
      setSavingName(false);
    }
  }

  async function clearName() {
    if (!customer) return;
    setSavingName(true);
    try {
      const updated = await updateCustomerName(customer.customerId, { displayName: null });
      applyDetail(updated);
      setEditingName(false);
      toast.success(t('customers.toast.nameReset'));
    } catch (err) {
      apiError.toast(err, { fallbackKey: 'customers.errors.resetNameFailed' });
    } finally {
      setSavingName(false);
    }
  }

  async function toggleFlag(flag: CustomerFlag) {
    if (!customer) return;
    const has = customer.flags.some((f) => f.id === flag.id);
    const nextIds = has
      ? customer.flags.filter((f) => f.id !== flag.id).map((f) => f.id)
      : [...customer.flags.map((f) => f.id), flag.id];
    setFlagsBusy(true);
    try {
      const updated = await updateCustomerFlags(customer.customerId, { flagIds: nextIds });
      applyDetail(updated);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VENDOR_CUSTOMER_FLAG_NOT_FOUND') {
        toast.error(t('customers.flags.stale'));
      } else {
        apiError.toast(err, { fallbackKey: 'customers.errors.updateFlagsFailed' });
      }
    } finally {
      setFlagsBusy(false);
    }
  }

  function handleRefunded() {
    // Refresh the customer (stats may change) and their orders.
    if (!customerId) return;
    fetchCustomerById(customerId).then(applyDetail).catch(() => {});
    loadOrders(customerId);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={sheet.side} className={cn('p-0', sheet.className)}>
        <SheetHeader className="border-b pr-12">
          <SheetTitle>{t('customers.detail.title')}</SheetTitle>
        </SheetHeader>

        <SheetBody className="p-4">
          {loading ? (
            <DetailSkeleton />
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <XCircle className="h-8 w-8 text-destructive" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                {t('common.actions.close')}
              </Button>
            </div>
          ) : customer ? (
            <div className="space-y-6">
              {/* Identity */}
              <section className="flex items-start gap-4">
                <CustomerAvatar name={customer.displayName} avatar={customer.avatar} className="h-16 w-16" />
                <div className="min-w-0 flex-1">
                  {editingName ? (
                    <div className="space-y-2">
                      <Input
                        autoFocus
                        value={draftName}
                        maxLength={120}
                        onChange={(e) => setDraftName(e.target.value)}
                        placeholder={customer.realName}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); saveName(); }
                          if (e.key === 'Escape') { setEditingName(false); setDraftName(customer.displayName); }
                        }}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" onClick={saveName} disabled={savingName}>
                          {savingName ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
                          {t('common.actions.save')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setEditingName(false); setDraftName(customer.displayName); }}
                          disabled={savingName}
                        >
                          <X className="mr-1.5 h-3.5 w-3.5" /> {t('common.actions.cancel')}
                        </Button>
                        {customer.hasNameOverride && (
                          <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={clearName} disabled={savingName}>
                            {t('customers.detail.resetToRealName', { name: customer.realName })}
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <h2 className="truncate text-xl font-bold">
                          {closedAccount ? t('customers.detail.closedName') : customer.displayName}
                        </h2>
                        {/* A closed account can technically still take a name
                            override — the endpoint accepts it — but naming an
                            anonymised row is misleading, so the control is not
                            offered. There is no email, phone or address left on
                            it either. */}
                        {!closedAccount && (
                          <button
                            type="button"
                            onClick={() => { setEditingName(true); setDraftName(customer.hasNameOverride ? customer.displayName : ''); }}
                            aria-label={t('customers.detail.editName')}
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-70 transition hover:bg-accent hover:opacity-100 tap-target"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      {closedAccount && (
                        <p className="text-xs text-muted-foreground">
                          {t('customers.detail.closedNote')}
                        </p>
                      )}
                      {!closedAccount && customer.hasNameOverride && (
                        <p className="text-xs text-muted-foreground">
                          {t('customers.detail.overrideNote', { name: customer.realName })}
                        </p>
                      )}
                      {customer.email && (
                        <p className="truncate text-sm text-muted-foreground">{customer.email}</p>
                      )}
                    </>
                  )}
                </div>
              </section>

              {/* Stats */}
              <section className="grid grid-cols-2 gap-3">
                <StatCard
                  icon={<ShoppingBag className="h-4 w-4" />}
                  label={t('customers.detail.totalOrders')}
                  value={fmt.number(customer.orderCount)}
                />
                <StatCard
                  icon={<Wallet className="h-4 w-4" />}
                  label={t('customers.detail.totalSpent')}
                  value={fmt.currency(customer.totalSpent)}
                />
              </section>

              {/* Flags */}
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{t('customers.detail.flags')}</h3>
                  <Popover open={flagPickerOpen} onOpenChange={setFlagPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-7 gap-1.5" disabled={flagsBusy}>
                        {flagsBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                        {t('customers.detail.assignFlag')}
                        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-64 p-1">
                      {availableFlags.length === 0 ? (
                        <div className="space-y-2 p-3 text-center">
                          <p className="text-sm text-muted-foreground">{t('customers.detail.noFlagsCreated')}</p>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full gap-1.5"
                            onClick={() => { setFlagPickerOpen(false); onManageFlags(); }}
                          >
                            <Tag className="h-3.5 w-3.5" /> {t('customers.list.manageFlags')}
                          </Button>
                        </div>
                      ) : (
                        <ul className="max-h-64 overflow-y-auto">
                          {availableFlags.map((flag) => {
                            const checked = customer.flags.some((f) => f.id === flag.id);
                            return (
                              <li key={flag.id}>
                                <button
                                  type="button"
                                  onClick={() => toggleFlag(flag)}
                                  disabled={flagsBusy}
                                  className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-accent disabled:opacity-50"
                                >
                                  <FlagDot color={flag.color} />
                                  <span className="min-w-0 flex-1 truncate">{flag.name}</span>
                                  {checked && <Check className="h-4 w-4 text-primary" />}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>
                {customer.flags.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('customers.detail.noFlagsAssigned')}</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {customer.flags.map((flag) => (
                      <FlagBadge key={flag.id} flag={flag} onRemove={flagsBusy ? undefined : () => toggleFlag(flag)} />
                    ))}
                  </div>
                )}
              </section>

              {/* Contact + address */}
              <section className="space-y-3 border-t pt-4">
                <h3 className="text-sm font-semibold">{t('customers.detail.contact')}</h3>
                <InfoRow icon={<Mail className="h-4 w-4" />} value={customer.email ?? t('common.labels.emptyValue')} />
                <InfoRow icon={<Phone className="h-4 w-4" />} value={customer.phone ? formatPhoneInternational(customer.phone) : t('common.labels.emptyValue')} />
                {customer.shippingAddress ? (
                  <div className="flex items-start gap-3 text-sm">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="text-muted-foreground">
                      <p>{customer.shippingAddress.street}</p>
                      <p>
                        {[customer.shippingAddress.city, customer.shippingAddress.state]
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                      <p>{customer.shippingAddress.country}</p>
                    </div>
                  </div>
                ) : (
                  <InfoRow icon={<MapPin className="h-4 w-4" />} value={t('customers.detail.noAddress')} />
                )}
              </section>

              {/* Orders */}
              <section className="space-y-3 border-t pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{t('customers.detail.orders')}</h3>
                  {ordersTotal > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {orders.length < ordersTotal
                        ? t('customers.detail.latestOf', { shown: orders.length, total: ordersTotal })
                        : t('customers.detail.totalCount', { count: ordersTotal })}
                    </span>
                  )}
                </div>

                {ordersLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
                  </div>
                ) : ordersError ? (
                  <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-8 text-center">
                    <p className="text-sm text-muted-foreground">{ordersError}</p>
                    <Button variant="outline" size="sm" onClick={() => customerId && loadOrders(customerId)}>
                      {t('common.actions.retry')}
                    </Button>
                  </div>
                ) : orders.length === 0 ? (
                  <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                    {t('customers.detail.noOrders')}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {orders.map((order) => (
                      <li key={order.id} className="rounded-lg border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-medium">{order.orderNumber}</span>
                              {order.orderType === 'digital' ? (
                                <Badge variant="outline" className="h-4 gap-1 border-violet-300 bg-violet-50 px-1.5 py-0 text-[10px] text-violet-700">
                                  <Download className="h-2.5 w-2.5" />{t('customers.detail.digital')}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="h-4 gap-1 border-blue-300 bg-blue-50 px-1.5 py-0 text-[10px] text-blue-700">
                                  <Package className="h-2.5 w-2.5" />{t('customers.detail.physical')}
                                </Badge>
                              )}
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">{fmt.date(order.createdAt)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold">{fmt.currency(order.total, order.currency)}</p>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <OrderStatusBadge status={order.status} size="xs" />
                            <PaymentPill status={order.paymentStatus} />
                          </div>
                          {REFUNDABLE_PAYMENT.has(order.paymentStatus) && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 gap-1.5 text-xs"
                              onClick={() => setRefundOrderTarget(order)}
                            >
                              <RotateCcw className="h-3.5 w-3.5" /> {t('customers.detail.refund')}
                            </Button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          ) : null}
        </SheetBody>
      </SheetContent>

      <RefundDialog
        orderId={refundOrderTarget?.id ?? null}
        orderNumber={refundOrderTarget?.orderNumber}
        open={!!refundOrderTarget}
        onOpenChange={(o) => { if (!o) setRefundOrderTarget(null); }}
        onRefunded={handleRefunded}
      />
    </Sheet>
  );
}

// ─── Presentational helpers ───────────────────────────────────────────────────

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

function InfoRow({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-muted-foreground">{icon}</span>
      <span className="min-w-0 truncate">{value}</span>
    </div>
  );
}

const PAYMENT_PILL_CLASSES: Record<string, string> = {
  paid: 'border-green-500 text-green-600 bg-green-50',
  partially_refunded: 'border-amber-500 text-amber-600 bg-amber-50',
  refunded: 'border-border text-muted-foreground bg-muted',
  pending: 'border-amber-500 text-amber-600 bg-amber-50',
  authorized: 'border-blue-500 text-blue-600 bg-blue-50',
  disputed: 'border-orange-500 text-orange-600 bg-orange-50',
  failed: 'border-red-500 text-red-600 bg-red-50',
};

const PAYMENT_PILL_KEYS: Record<string, TranslationKey> = {
  paid: 'customers.paymentStatus.paid',
  partially_refunded: 'customers.paymentStatus.partially_refunded',
  refunded: 'customers.paymentStatus.refunded',
  pending: 'customers.paymentStatus.pending',
  authorized: 'customers.paymentStatus.authorized',
  disputed: 'customers.paymentStatus.disputed',
  failed: 'customers.paymentStatus.failed',
};

function PaymentPill({ status }: { status: string }) {
  const { t } = useTranslation();
  const labelKey = PAYMENT_PILL_KEYS[status];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium',
        PAYMENT_PILL_CLASSES[status] ?? 'border-border text-muted-foreground',
      )}
    >
      {labelKey ? t(labelKey) : status}
    </span>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-52" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
      <Skeleton className="h-20 w-full rounded-lg" />
      <Skeleton className="h-32 w-full rounded-lg" />
    </div>
  );
}
