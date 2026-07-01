import { createContext, useContext, useState, useCallback } from 'react';
import type {
  User, Store, Product, Order, Vendor,
  AnalyticsMetrics, MetricWithChange, SalesDataPoint, TopProduct,
  CustomerMetrics, BookingMetrics, DateRange
} from '@/types';
import type { VendorNotification, NotificationListParams } from '@/types/notifications.types';
import {
  mockUsers, mockStores,
  mockVendors,
} from '@/data/mockData';
import {
  fetchDashboard,
  fetchSalesDaily,
  fetchTopProducts,
  fetchCustomerMetrics,
  previousRange,
  toISODate,
  isAggregationNotReady,
  getAnalyticsErrorMessage,
  type DashboardMetrics,
} from '@/services/analytics.service';
import {
  fetchNotifications as apiFetchNotifications,
  markNotificationRead as apiMarkNotificationRead,
  markAllNotificationsRead as apiMarkAllNotificationsRead,
} from '@/services/notifications.service';
import {
  fetchOrders as apiFetchOrders,
  fetchOrderById as apiFetchOrderById,
  updateOrderStatus as apiUpdateOrderStatus,
  getOrderErrorMessage,
  type PaginationMeta,
} from '@/services/orders.service';
import { toast } from 'sonner';
import { ApiError } from '@/types/api';
import {
  fetchProducts as apiFetchProducts,
  updateProductStatus as apiUpdateProductStatus,
} from '@/services/products.service';
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

// Auth Store Context
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  setUser: (user: User | null) => void;
}

const AuthStoreContext = createContext<AuthState | null>(null);

// UI Store Context
interface UIState {
  sidebarCollapsed: boolean;
  theme: 'light' | 'dark' | 'system';
  toggleSidebar: () => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

const UIStoreContext = createContext<UIState | null>(null);

// Store Store Context
interface StoreState {
  stores: Store[];
  currentStore: Store | null;
  setCurrentStore: (store: Store | null) => void;
  fetchStores: () => Promise<void>;
}

const StoreStoreContext = createContext<StoreState | null>(null);

// Product Store Context
interface ProductState {
  products: ProductListItem[];
  selectedProducts: string[];
  isLoading: boolean;
  pagination: ProductListMeta | null;
  fetchProducts: (params?: ProductsQueryParams) => Promise<void>;
  // createProduct / updateProduct are no-ops — the wizard pages handle their own saves
  createProduct: (product: Partial<Product>) => Promise<void>;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  toggleProductSelection: (id: string) => void;
  selectAllProducts: (ids: string[]) => void;
  clearSelection: () => void;
}

const ProductStoreContext = createContext<ProductState | null>(null);

// Order Store Context
interface OrderState {
  orders: Order[];
  selectedOrders: string[];
  isLoading: boolean;
  pagination: PaginationMeta | null;
  filters: {
    status?: string[];
    dateRange?: DateRange;
    search?: string;
  };
  fetchOrders: ({ page, limit }: { page?: number, limit?: number }) => Promise<void>;
  fetchOrderById: (id: string) => Promise<Order>;
  updateOrderStatus: (id: string, status: string) => Promise<void>;
  toggleOrderSelection: (id: string) => void;
  selectAllOrders: (ids: string[]) => void;
  clearSelection: () => void;
  setFilters: (filters: Partial<OrderState['filters']>) => void;
}

const OrderStoreContext = createContext<OrderState | null>(null);

// Vendor Store Context
interface VendorState {
  vendors: Vendor[];
  isLoading: boolean;
  fetchVendors: () => Promise<void>;
  approveVendor: (id: string) => Promise<void>;
  suspendVendor: (id: string) => Promise<void>;
  updateCommission: (id: string, rate: number) => Promise<void>;
}

const VendorStoreContext = createContext<VendorState | null>(null);

// Notification Store Context
interface NotificationState {
  notifications: VendorNotification[];
  unreadCount: number;
  isLoading: boolean;
  fetchNotifications: (params?: NotificationListParams) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  /** Prepend a live (push) notification and bump the unread badge. */
  prependNotification: (n: VendorNotification) => void;
}

const NotificationStoreContext = createContext<NotificationState | null>(null);

// Analytics Store Context
interface AnalyticsState {
  metrics: AnalyticsMetrics;
  salesData: SalesDataPoint[];
  topProducts: TopProduct[];
  customerMetrics: CustomerMetrics | null;
  bookings: BookingMetrics | null;
  dateRange: DateRange;
  isLoading: boolean;
  /** True when the backend has no aggregated data for the range yet (503). */
  notReady: boolean;
  fetchAnalytics: () => Promise<void>;
  setDateRange: (range: DateRange) => void;
}

const AnalyticsStoreContext = createContext<AnalyticsState | null>(null);

// Note: Media is no longer in the global store. The Media Library
// (src/pages/MediaGallery.tsx) and MediaPicker talk to the backend File
// Management Service directly via src/services/files.service.ts.

// Provider Component
export function StoreProvider({ children }: { children: React.ReactNode }) {
  // Auth State
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setAuthLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));

    const user = mockUsers.find(u => u.email === email);
    if (user && password === 'password') {
      setAuthUser(user);
      setAuthLoading(false);
      return true;
    }
    setAuthLoading(false);
    return false;
  }, []);

  const logout = useCallback(() => {
    setAuthUser(null);
  }, []);

  // UI State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('light');

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => !prev);
  }, []);

  // Store State
  const [stores] = useState<Store[]>(mockStores);
  const [currentStore, setCurrentStore] = useState<Store | null>(mockStores[0]);

  const fetchStores = useCallback(async () => {
    await new Promise(resolve => setTimeout(resolve, 500));
  }, []);

  // Product State
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [productLoading, setProductLoading] = useState(false);
  const [productPagination, setProductPagination] = useState<ProductListMeta | null>(null);

  const fetchProducts = useCallback(async (params?: ProductsQueryParams) => {
    setProductLoading(true);
    try {
      const result = await apiFetchProducts(params ?? {});
      setProducts(result.data);
      setProductPagination(result.meta);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load products.');
    } finally {
      setProductLoading(false);
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
      toast.error(err instanceof ApiError ? err.message : 'Failed to delete product.');
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

  const fetchOrders = useCallback(async ({ page = 1, limit = 20 }) => {
    setOrderLoading(true);
    try {
      const result = await apiFetchOrders({ page, limit });
      setOrders(result.data);
      setOrderPagination(result.meta);
    } catch (err) {
      toast.error(getOrderErrorMessage(err));
    } finally {
      setOrderLoading(false);
    }
  }, []);

  const fetchOrderById = useCallback(async (id: string): Promise<Order> => {
    return apiFetchOrderById(id);
  }, []);

  const updateOrderStatus = useCallback(async (id: string, status: string) => {
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

  // Vendor State
  const [vendors, setVendors] = useState<Vendor[]>(mockVendors);
  const [vendorLoading, setVendorLoading] = useState(false);

  const fetchVendors = useCallback(async () => {
    setVendorLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    setVendorLoading(false);
  }, []);

  const approveVendor = useCallback(async (id: string) => {
    setVendorLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    setVendors(prev => prev.map(v =>
      v.id === id ? { ...v, status: 'active' as const } : v
    ));
    setVendorLoading(false);
  }, []);

  const suspendVendor = useCallback(async (id: string) => {
    setVendorLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    setVendors(prev => prev.map(v =>
      v.id === id ? { ...v, status: 'suspended' as const } : v
    ));
    setVendorLoading(false);
  }, []);

  const updateCommission = useCallback(async (id: string, rate: number) => {
    setVendorLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    setVendors(prev => prev.map(v =>
      v.id === id ? { ...v, commissionRate: rate } : v
    ));
    setVendorLoading(false);
  }, []);

  // Notification State — real data from GET /vendor/notifications.
  const [notifications, setNotifications] = useState<VendorNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  const fetchNotifications = useCallback(async (params?: NotificationListParams) => {
    setNotificationsLoading(true);
    try {
      const res = await apiFetchNotifications(params);
      setNotifications(res.data);
      setUnreadCount(res.unreadCount);
    } catch (err) {
      // Non-fatal: the badge/list just won't refresh. Avoid a toast on every
      // background reconciliation; surface only unexpected errors.
      if (err instanceof ApiError && err.status >= 500) {
        toast.error('Could not load notifications.');
      }
    } finally {
      setNotificationsLoading(false);
    }
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    let wasUnread = false;
    setNotifications(prev => prev.map(n => {
      if (n.id === id && !n.isRead) wasUnread = true;
      return n.id === id ? { ...n, isRead: true } : n;
    }));
    if (wasUnread) setUnreadCount(c => Math.max(0, c - 1));
    try {
      await apiMarkNotificationRead(id);
    } catch (err) {
      // Revert on failure.
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: false } : n));
      if (wasUnread) setUnreadCount(c => c + 1);
      toast.error(err instanceof ApiError ? err.message : 'Could not mark as read.');
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
      toast.error(err instanceof ApiError ? err.message : 'Could not mark all as read.');
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
  const [bookings, setBookings] = useState<BookingMetrics | null>(null);
  const [analyticsDateRange, setAnalyticsDateRange] = useState<DateRange>({
    from: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
    to: new Date(),
    label: 'Last 7 days',
  });
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsNotReady, setAnalyticsNotReady] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    setAnalyticsNotReady(false);

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
        totalSales: computeChange(s.gmv, p?.gmv),
        totalOrders: computeChange(s.orderCount, p?.orderCount),
        netRevenue: computeChange(s.netRevenue, p?.netRevenue),
        averageOrderValue: computeChange(s.aov, p?.aov),
      });
      setSalesData(salesDaily);
      setTopProducts(products.topByRevenue);
      setCustomerMetrics(customers);
      setBookings(dashboard.bookings);
    } catch (err) {
      if (isAggregationNotReady(err)) {
        setAnalyticsNotReady(true);
        setAnalyticsMetrics(EMPTY_METRICS);
        setSalesData([]);
        setTopProducts([]);
        setCustomerMetrics(null);
        setBookings(null);
      } else {
        toast.error(getAnalyticsErrorMessage(err));
      }
    } finally {
      setAnalyticsLoading(false);
    }
  }, [analyticsDateRange]);

  return (
    <AuthStoreContext.Provider value={{
      user: authUser,
      isAuthenticated: !!authUser,
      isLoading: authLoading,
      login,
      logout,
      setUser: setAuthUser
    }}>
      <UIStoreContext.Provider value={{
        sidebarCollapsed,
        theme,
        toggleSidebar,
        setTheme
      }}>
        <StoreStoreContext.Provider value={{
          stores,
          currentStore,
          setCurrentStore,
          fetchStores
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
              <VendorStoreContext.Provider value={{
                vendors,
                isLoading: vendorLoading,
                fetchVendors,
                approveVendor,
                suspendVendor,
                updateCommission
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
                    bookings,
                    dateRange: analyticsDateRange,
                    isLoading: analyticsLoading,
                    notReady: analyticsNotReady,
                    fetchAnalytics,
                    setDateRange: setAnalyticsDateRange
                  }}>
                    {children}
                  </AnalyticsStoreContext.Provider>
                </NotificationStoreContext.Provider>
              </VendorStoreContext.Provider>
            </OrderStoreContext.Provider>
          </ProductStoreContext.Provider>
        </StoreStoreContext.Provider>
      </UIStoreContext.Provider>
    </AuthStoreContext.Provider>
  );
}

// Hooks
export function useAuthStore() {
  const context = useContext(AuthStoreContext);
  if (!context) throw new Error('useAuthStore must be used within StoreProvider');
  return context;
}

export function useUIStore() {
  const context = useContext(UIStoreContext);
  if (!context) throw new Error('useUIStore must be used within StoreProvider');
  return context;
}

export function useStoreStore() {
  const context = useContext(StoreStoreContext);
  if (!context) throw new Error('useStoreStore must be used within StoreProvider');
  return context;
}

export function useProductStore() {
  const context = useContext(ProductStoreContext);
  if (!context) throw new Error('useProductStore must be used within StoreProvider');
  return context;
}

export function useOrderStore() {
  const context = useContext(OrderStoreContext);
  if (!context) throw new Error('useOrderStore must be used within StoreProvider');
  return context;
}

export function useVendorStore() {
  const context = useContext(VendorStoreContext);
  if (!context) throw new Error('useVendorStore must be used within StoreProvider');
  return context;
}

export function useNotificationStore() {
  const context = useContext(NotificationStoreContext);
  if (!context) throw new Error('useNotificationStore must be used within StoreProvider');
  return context;
}

export function useAnalyticsStore() {
  const context = useContext(AnalyticsStoreContext);
  if (!context) throw new Error('useAnalyticsStore must be used within StoreProvider');
  return context;
}
