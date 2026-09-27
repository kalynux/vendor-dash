import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  Product, Order,
  AnalyticsMetrics, MetricWithChange, SalesDataPoint, TopProduct,
  CustomerMetrics, DateRange, VendorSettableStatus
} from '@/types';
import type { VendorNotification, NotificationListParams } from '@/types/notifications.types';
import type { VendorStore } from '@/types/store.types';
import { fetchStore as apiFetchStore } from '@/services/store.service';
import {
  fetchDashboard,
  fetchSalesDaily,
  fetchTopProducts,
  fetchCustomerMetrics,
  previousRange,
  toISODate,
  getAnalyticsErrorMessage,
  type DashboardMetrics,
} from '@/services/analytics.service';
import {
  fetchNotificationFeed as apiFetchNotificationFeed,
  markNotificationRead as apiMarkNotificationRead,
  markAllNotificationsRead as apiMarkAllNotificationsRead,
} from '@/services/notifications.service';
import {
  fetchOrders as apiFetchOrders,
  fetchOrderById as apiFetchOrderById,
  updateOrderStatus as apiUpdateOrderStatus,
  getOrderErrorMessage,
  type PaginationMeta,
  type OrdersQueryParams,
} from '@/services/orders.service';
import { toast } from 'sonner';
import { ApiError } from '@/types/api';
import { apiErrorMessage, tStatic } from '@/i18n';
import {
  fetchProducts as apiFetchProducts,
  updateProductStatus as apiUpdateProductStatus,
} from '@/services/products.service';
import {
  UIStoreContext, StoreStoreContext, ProductStoreContext, OrderStoreContext,
  NotificationStoreContext, AnalyticsStoreContext, type Theme, type OrderState,
} from './contexts';
import type { ProductListItem, ProductListMeta, ProductsQueryParams } from '@/types/product.types';

// ─── Analytics helpers ──────────────────────────────────────────────────────

const EMPTY_METRIC: MetricWithChange = { value: 0, change: 0, changeType: 'neutral' };

const EMPTY_METRICS: AnalyticsMetrics = {
  totalSales: EMPTY_METRIC,
  totalOrders: EMPTY_METRIC,
  netRevenue: EMPTY_METRIC,
  averageOrderValue: EMPTY_METRIC,
};

/**
 * Build a MetricWithChange from the current value and the previous period's
 * value. When no baseline exists (undefined or zero), the delta is reported as
 * neutral 0% rather than a misleading +100%.
 */
function computeChange(current: number, previous: number | undefined): MetricWithChange {
  if (previous === undefined || previous === 0) {
    return { value: current, change: 0, changeType: 'neutral' };
  }
  const pct = Math.round(((current - previous) / previous) * 1000) / 10;
  const changeType = pct > 0 ? 'increase' : pct < 0 ? 'decrease' : 'neutral';
  return { value: current, change: pct, changeType };
}

// Note: Media is no longer in the global store. The Media Library
// (src/pages/MediaGallery.tsx) and MediaPicker talk to the backend File
// Management Service directly via src/services/files.service.ts.

// Theme — persisted so a reload doesn't drop the vendor back into light mode.
const THEME_KEY = 'vendor-dash:theme';

function readStoredTheme(): Theme {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    // Private mode / storage disabled — fall through to the default.
  }
  return 'light';
}

// Provider Component
export function StoreProvider({ children }: { children: React.ReactNode }) {
  // UI State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<Theme>(readStoredTheme);

  // The `dark` class has to live on <html>, not on a wrapper div: `body` is
  // styled with `text-foreground`/`bg-background`, so a class further down the
  // tree leaves body resolving the light `:root` values and every element that
  // merely inherits its colour (headings, sidebar rows) renders black-on-black.
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches);
      root.classList.toggle('dark', dark);
      // Keeps native UI (number-input spinners, scrollbars, date pickers,
      // autofill) in step with the theme instead of rendering light-on-dark.
      root.style.colorScheme = dark ? 'dark' : 'light';
    };
    apply();
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Ignore — persistence is a nicety, the applied theme still holds.
    }
    if (theme !== 'system') return;
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => !prev);
  }, []);

  // Store State — the vendor's single storefront profile.
  const [store, setStore] = useState<VendorStore | null>(null);
  const [storeLoading, setStoreLoading] = useState(false);

  const fetchStore = useCallback(async () => {
    setStoreLoading(true);
    try {
      const result = await apiFetchStore();
      setStore(result);
    } catch (err) {
      toast.error(apiErrorMessage(err, { fallbackKey: 'settings.storefront.loadFailed' }));
    } finally {
      setStoreLoading(false);
    }
  }, []);

  const applyStore = useCallback((next: VendorStore) => setStore(next), []);

  // Product State
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [productLoading, setProductLoading] = useState(false);
  const [productPagination, setProductPagination] = useState<ProductListMeta | null>(null);

  // Latest call wins: a slow background refresh must not land on top of the
  // page or search the vendor asked for after it started.
  const productRequestId = useRef(0);

  const fetchProducts = useCallback(async (
    params?: ProductsQueryParams,
    opts?: { silent?: boolean },
  ) => {
    const silent = opts?.silent ?? false;
    const id = ++productRequestId.current;
    if (!silent) setProductLoading(true);
    try {
      const result = await apiFetchProducts(params ?? {});
      if (id !== productRequestId.current) return;
      setProducts(result.data);
      setProductPagination(result.meta);
    } catch (err) {
      if (!silent) toast.error(apiErrorMessage(err, { fallbackKey: 'products.errors.loadFailed' }));
    } finally {
      if (!silent) setProductLoading(false);
    }
  }, []);

  // No-op — the product wizard pages handle their own saves directly via the service
  const createProduct = useCallback(async (_product: Partial<Product>) => {}, []);
  const updateProduct = useCallback(async (_id: string, _updates: Partial<Product>) => {}, []);

  const deleteProduct = useCallback(async (id: string) => {
    setProductLoading(true);
    try {
      await apiUpdateProductStatus(id, 'archived');
      setProducts(prev => prev.filter(p => p.id !== id));
      setSelectedProducts(prev => prev.filter(pid => pid !== id));
    } catch (err) {
      toast.error(apiErrorMessage(err, { fallbackKey: 'products.errors.deleteFailed' }));
    } finally {
      setProductLoading(false);
    }
  }, []);

  const toggleProductSelection = useCallback((id: string) => {
    setSelectedProducts(prev =>
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    );
  }, []);

  const selectAllProducts = useCallback((ids: string[]) => {
    setSelectedProducts(ids);
  }, []);

  const clearProductSelection = useCallback(() => {
    setSelectedProducts([]);
  }, []);

  // Order State
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderPagination, setOrderPagination] = useState<PaginationMeta | null>(null);
  const [orderFilters, setOrderFilters] = useState<OrderState['filters']>({});
  const orderRequestId = useRef(0);

  const fetchOrders = useCallback(async (
    params: OrdersQueryParams = {},
    opts?: { silent?: boolean },
  ) => {
    const silent = opts?.silent ?? false;
    // Latest call wins, same as products: a slow refresh must not land on top
    // of the page or filter asked for after it started.
    const id = ++orderRequestId.current;
    if (!silent) setOrderLoading(true);
    try {
      const result = await apiFetchOrders({ page: 1, limit: 20, ...params });
      if (id !== orderRequestId.current) return;
      setOrders(result.data);
      setOrderPagination(result.meta);
    } catch (err) {
      if (silent) throw err;
      toast.error(getOrderErrorMessage(err));
    } finally {
      if (!silent) setOrderLoading(false);
    }
  }, []);

  const fetchOrderById = useCallback(async (id: string): Promise<Order> => {
    return apiFetchOrderById(id);
  }, []);

  const updateOrderStatus = useCallback(async (id: string, status: VendorSettableStatus) => {
    const updated = await apiUpdateOrderStatus(id, status);
    setOrders(prev => prev.map(o => o.id === id ? updated : o));
  }, []);

  const toggleOrderSelection = useCallback((id: string) => {
    setSelectedOrders(prev =>
      prev.includes(id) ? prev.filter(oid => oid !== id) : [...prev, id]
    );
  }, []);

  const selectAllOrders = useCallback((ids: string[]) => {
    setSelectedOrders(ids);
  }, []);

  const clearOrderSelection = useCallback(() => {
    setSelectedOrders([]);
  }, []);

  const setFilters = useCallback((filters: Partial<OrderState['filters']>) => {
    setOrderFilters(prev => ({ ...prev, ...filters }));
  }, []);

  // Notification State — real data from GET /vendor/notifications.
  const [notifications, setNotifications] = useState<VendorNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  const fetchNotifications = useCallback(async (params?: NotificationListParams) => {
    setNotificationsLoading(true);
    try {
      const res = await apiFetchNotificationFeed(params);
      setNotifications(res.data);
      setUnreadCount(res.unreadCount);
    } catch (err) {
      // Non-fatal: the badge/list just won't refresh. Avoid a toast on every
      // background reconciliation; surface only unexpected errors.
      if (err instanceof ApiError && err.status >= 500) {
        toast.error(tStatic('notifications.errors.loadFailed'));
      }
    } finally {
      setNotificationsLoading(false);
    }
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    let wasUnread = false;
    /**
     * ⚠ `PATCH /:id/read` is NOT idempotent in `readAt` — calling it on an
     * already-read row re-stamps the timestamp to now. So a row we can see is
     * already read gets no round trip.
     *
     * Note which way this is written: it records "definitely already read",
     * not "was unread". A `useState` updater is not guaranteed to run
     * synchronously, so if it has not run by the time the flag is read, this
     * stays `false` and the request goes out — the old behaviour, one
     * unnecessary write. Testing `wasUnread` instead would fail the other way
     * and silently drop the request, leaving the row unread on the server while
     * the UI showed it read.
     */
    let knownRead = false;
    setNotifications(prev => prev.map(n => {
      if (n.id === id) {
        if (n.isRead) knownRead = true;
        else wasUnread = true;
      }
      return n.id === id ? { ...n, isRead: true } : n;
    }));
    if (knownRead) return;
    if (wasUnread) setUnreadCount(c => Math.max(0, c - 1));
    try {
      await apiMarkNotificationRead(id);
    } catch (err) {
      // Revert on failure.
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: false } : n));
      if (wasUnread) setUnreadCount(c => c + 1);
      toast.error(apiErrorMessage(err, { fallbackKey: 'notifications.errors.markReadFailed' }));
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    const snapshot = notifications;
    const prevUnread = unreadCount;
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try {
      await apiMarkAllNotificationsRead();
    } catch (err) {
      setNotifications(snapshot);
      setUnreadCount(prevUnread);
      toast.error(apiErrorMessage(err, { fallbackKey: 'notifications.errors.markAllReadFailed' }));
    }
  }, [notifications, unreadCount]);

  const prependNotification = useCallback((n: VendorNotification) => {
    setNotifications(prev => (prev.some(p => p.id === n.id) ? prev : [n, ...prev]));
    if (!n.isRead) setUnreadCount(c => c + 1);
  }, []);

  // Analytics State
  const [analyticsMetrics, setAnalyticsMetrics] = useState<AnalyticsMetrics>(EMPTY_METRICS);
  const [salesData, setSalesData] = useState<SalesDataPoint[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [customerMetrics, setCustomerMetrics] = useState<CustomerMetrics | null>(null);
  const [analyticsSummary, setAnalyticsSummary] = useState<DashboardMetrics | null>(null);
  const [analyticsDateRange, setAnalyticsDateRange] = useState<DateRange>({
    from: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
    to: new Date(),
    label: 'Last 7 days',
  });
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // `from`/`to` go out as local `YYYY-MM-DD` days, both included — no "+1 day".
  // An empty period is a 200 with zeros, so there is no "not ready" branch.
  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);

    const range = {
      from: toISODate(analyticsDateRange.from),
      to: toISODate(analyticsDateRange.to),
    };
    const prev = previousRange(analyticsDateRange.from, analyticsDateRange.to);
    const prevRange = { from: toISODate(prev.from), to: toISODate(prev.to) };

    try {
      const [dashboard, salesDaily, products, customers] = await Promise.all([
        fetchDashboard(range),
        fetchSalesDaily(range),
        fetchTopProducts(range, 5),
        fetchCustomerMetrics(range),
      ]);

      // Previous period is best-effort — deltas fall back to neutral if it's
      // unavailable (e.g. a new vendor with no prior data).
      let prevDash: DashboardMetrics | null = null;
      try {
        prevDash = await fetchDashboard(prevRange);
      } catch {
        prevDash = null;
      }

      const s = dashboard.sales;
      const p = prevDash?.sales;
      setAnalyticsMetrics({
        totalSales: computeChange(s.grossSales, p?.grossSales),
        totalOrders: computeChange(s.orderCount, p?.orderCount),
        netRevenue: computeChange(s.netRevenue, p?.netRevenue),
        averageOrderValue: computeChange(s.aov, p?.aov),
      });
      setSalesData(salesDaily.daily);
      setTopProducts(products.topByRevenue);
      setCustomerMetrics(customers);
      setAnalyticsSummary(dashboard);
    } catch (err) {
      toast.error(getAnalyticsErrorMessage(err));
    } finally {
      setAnalyticsLoading(false);
    }
  }, [analyticsDateRange]);

  return (
    <UIStoreContext.Provider value={{
      sidebarCollapsed,
      theme,
      toggleSidebar,
      setTheme
    }}>
      <StoreStoreContext.Provider value={{
        store,
        isLoading: storeLoading,
        fetchStore,
        applyStore
      }}>
        <ProductStoreContext.Provider value={{
          products,
          selectedProducts,
          isLoading: productLoading,
          pagination: productPagination,
          fetchProducts,
          createProduct,
          updateProduct,
          deleteProduct,
          toggleProductSelection,
          selectAllProducts,
          clearSelection: clearProductSelection
        }}>
          <OrderStoreContext.Provider value={{
            orders,
            selectedOrders,
            isLoading: orderLoading,
            pagination: orderPagination,
            filters: orderFilters,
            fetchOrders,
            fetchOrderById,
            updateOrderStatus,
            toggleOrderSelection,
            selectAllOrders,
            clearSelection: clearOrderSelection,
            setFilters,
          }}>
            <NotificationStoreContext.Provider value={{
              notifications,
              unreadCount,
              isLoading: notificationsLoading,
              fetchNotifications,
              markAsRead,
              markAllAsRead,
              prependNotification
            }}>
              <AnalyticsStoreContext.Provider value={{
                metrics: analyticsMetrics,
                salesData,
                topProducts,
                customerMetrics,
                summary: analyticsSummary,
                dateRange: analyticsDateRange,
                isLoading: analyticsLoading,
                fetchAnalytics,
                setDateRange: setAnalyticsDateRange
              }}>
                {children}
              </AnalyticsStoreContext.Provider>
            </NotificationStoreContext.Provider>
          </OrderStoreContext.Provider>
        </ProductStoreContext.Provider>
      </StoreStoreContext.Provider>
    </UIStoreContext.Provider>
  );
}
