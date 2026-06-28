import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays, List, ChevronRight, Loader2, CalendarClock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia,
} from '@/components/ui/empty';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useInfiniteList } from '@/hooks/use-infinite-list';
import { ApiError } from '@/types/api';
import { fetchBookings } from '@/services/services.service';
import { BookingStatusBadge, PaymentStatusBadge } from '@/components/services/StatusBadges';
import { BookingCalendar } from '@/components/services/BookingCalendar';
import { BookingDetailSheet } from '@/components/services/BookingDetailSheet';
import { formatDateTime, formatMinor } from '@/components/services/service.constants';
import type {
  Booking, BookingListMeta, BookingsQueryParams, BookingStatus, PaymentStatus,
} from '@/types/services.types';

const PAGE_LIMIT = 20;
const ALL = '__all__';

const STATUS_OPTIONS: { value: BookingStatus | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'completed', label: 'Completed' },
  { value: 'no-show', label: 'No-show' },
  { value: 'cancelled', label: 'Cancelled' },
];

const PAYMENT_OPTIONS: { value: PaymentStatus | ''; label: string }[] = [
  { value: '', label: 'All payments' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'disputed', label: 'Disputed' },
  { value: 'failed', label: 'Failed' },
  { value: 'refunded', label: 'Refunded' },
];

function productTitle(b: Booking): string {
  return typeof b.productId === 'object' ? b.productId.title : 'Service';
}
function customerEmail(b: Booking): string {
  return typeof b.userId === 'object' ? b.userId.login_email ?? '—' : '—';
}

export function BookingsPanel({ openBookingId }: { openBookingId?: string | null } = {}) {
  const isMobile = useIsMobile();
  const [view, setView] = useState<'list' | 'calendar'>('list');

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [meta, setMeta] = useState<BookingListMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<BookingStatus | ''>('');
  const [paymentFilter, setPaymentFilter] = useState<PaymentStatus | ''>('');
  const [page, setPage] = useState(1);

  const [detailId, setDetailId] = useState<string | null>(null);
  // Bumped after any mutation so list + calendar refetch.
  const [reloadToken, setReloadToken] = useState(0);
  const bump = useCallback(() => setReloadToken((t) => t + 1), []);

  // Deep-link from a notification (`?view=<id>`): open that booking's detail.
  useEffect(() => {
    if (openBookingId) setDetailId(openBookingId);
  }, [openBookingId]);

  const queryParams: BookingsQueryParams = useMemo(() => ({
    status: statusFilter || undefined,
    paymentStatus: paymentFilter || undefined,
    page,
    limit: PAGE_LIMIT,
  }), [statusFilter, paymentFilter, page]);

  const load = useCallback(async (params: BookingsQueryParams) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchBookings(params);
      setBookings(result.data);
      setMeta(result.meta);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load bookings');
      setBookings([]);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isMobile || view !== 'list') return;
    load(queryParams);
  }, [isMobile, view, queryParams, load, reloadToken]);

  // Mobile infinite list.
  const fetchPage = useCallback(
    (pageArg: number, limit: number) =>
      fetchBookings({
        status: statusFilter || undefined,
        paymentStatus: paymentFilter || undefined,
        page: pageArg,
        limit,
      }).then((r) => ({ items: r.data, total: r.meta.total, totalPages: r.meta.totalPages })),
    [statusFilter, paymentFilter],
  );

  const infinite = useInfiniteList<Booking>({
    fetchPage,
    rowHeight: 80,
    enabled: isMobile && view === 'list',
    deps: [statusFilter, paymentFilter, reloadToken],
  });

  const filtersNode = (
    <div className="flex flex-wrap gap-2">
      <Select
        value={statusFilter || ALL}
        onValueChange={(v) => { setStatusFilter(v === ALL ? '' : (v as BookingStatus)); setPage(1); }}
      >
        <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((o) => (
            <SelectItem key={o.value || ALL} value={o.value || ALL}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={paymentFilter || ALL}
        onValueChange={(v) => { setPaymentFilter(v === ALL ? '' : (v as PaymentStatus)); setPage(1); }}
      >
        <SelectTrigger className="w-40"><SelectValue placeholder="Payment" /></SelectTrigger>
        <SelectContent>
          {PAYMENT_OPTIONS.map((o) => (
            <SelectItem key={o.value || ALL} value={o.value || ALL}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const viewToggle = (
    <div className="inline-flex overflow-hidden rounded-lg border">
      <button
        type="button"
        onClick={() => setView('list')}
        className={cn('flex items-center gap-1.5 px-3 py-1.5 text-sm', view === 'list' ? 'bg-accent' : 'hover:bg-muted/50')}
      >
        <List className="h-4 w-4" /> List
      </button>
      <button
        type="button"
        onClick={() => setView('calendar')}
        className={cn('flex items-center gap-1.5 border-l px-3 py-1.5 text-sm', view === 'calendar' ? 'bg-accent' : 'hover:bg-muted/50')}
      >
        <CalendarDays className="h-4 w-4" /> Calendar
      </button>
    </div>
  );

  const emptyNode = (
    <Empty className="py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon"><CalendarClock className="h-6 w-6" /></EmptyMedia>
        <EmptyTitle>No bookings</EmptyTitle>
        <EmptyDescription>
          Bookings appear here once customers reserve a time for your services.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );

  const renderMobileRow = (b: Booking) => (
    <button
      key={b._id}
      onClick={() => setDetailId(b._id)}
      className="flex w-full items-center gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-muted/30"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{productTitle(b)}</p>
        <p className="truncate text-xs text-muted-foreground">{customerEmail(b)}</p>
        <p className="truncate text-xs text-muted-foreground">{formatDateTime(b.startAt)}</p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <BookingStatusBadge status={b.status} />
        <span className="text-xs font-medium">{formatMinor(b.priceSnapshot, b.currency)}</span>
      </div>
    </button>
  );

  return (
    <div className="space-y-4">
      {!isMobile && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {filtersNode}
          {viewToggle}
        </div>
      )}

      {view === 'calendar' ? (
        <BookingCalendar onOpenBooking={setDetailId} reloadToken={reloadToken} />
      ) : isMobile ? (
        <div className="-mx-4">
          {infinite.loading ? (
            <ListSkeleton mobile />
          ) : infinite.error ? (
            <ErrorState message={infinite.error} onRetry={infinite.reload} />
          ) : infinite.items.length === 0 ? (
            emptyNode
          ) : (
            <div>
              {infinite.items.map(renderMobileRow)}
              <div ref={infinite.sentinelRef} className="h-1" />
              {infinite.loadingMore && (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          )}
        </div>
      ) : loading ? (
        <ListSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={() => load(queryParams)} />
      ) : bookings.length === 0 ? (
        emptyNode
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Service</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="w-8 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr
                    key={b._id}
                    onClick={() => setDetailId(b._id)}
                    className="group cursor-pointer border-b last:border-0 hover:bg-muted/40"
                  >
                    <td className="px-4 py-3 font-medium">{productTitle(b)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{customerEmail(b)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDateTime(b.startAt)}</td>
                    <td className="px-4 py-3"><BookingStatusBadge status={b.status} /></td>
                    <td className="px-4 py-3"><PaymentStatusBadge status={b.paymentStatus} /></td>
                    <td className="px-4 py-3 text-right font-medium">{formatMinor(b.priceSnapshot, b.currency)}</td>
                    <td className="px-4 py-3 text-right">
                      <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {meta && (
            <div className="flex flex-col items-center justify-between gap-3 text-sm text-muted-foreground sm:flex-row">
              <span>Showing {bookings.length} of {meta.total} booking{meta.total !== 1 ? 's' : ''}</span>
              {meta.totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={meta.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    Previous
                  </Button>
                  <span>Page {meta.page} of {meta.totalPages}</span>
                  <Button variant="outline" size="sm" disabled={meta.page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>
                    Next
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <BookingDetailSheet
        bookingId={detailId}
        open={!!detailId}
        onOpenChange={(o) => { if (!o) setDetailId(null); }}
        onChanged={bump}
      />
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
      <CalendarClock className="h-10 w-10 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>
    </div>
  );
}

function ListSkeleton({ mobile }: { mobile?: boolean }) {
  if (mobile) {
    return (
      <div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-b px-4 py-3">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-2/5" />
              <Skeleton className="h-3 w-3/5" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b p-4 last:border-0">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}
