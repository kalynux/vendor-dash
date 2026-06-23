import { createContext, useContext, useState, useCallback } from 'react';
import type {
  User, Store, Product, Order, Vendor,
  Notification, AnalyticsMetrics, DateRange
} from '@/types';
import {
  mockUsers, mockStores,
  mockVendors, mockNotifications,
  mockAnalytics, mockSalesData, mockCategoryBreakdown
} from '@/data/mockData';
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
  settingsTab: string;
  servicesTab: string;
  toggleSidebar: () => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setSettingsTab: (tab: string) => void;
  setServicesTab: (tab: string) => void;
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
  notifications: Notification[];
  unreadCount: number;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationStoreContext = createContext<NotificationState | null>(null);

// Analytics Store Context
interface AnalyticsState {
  metrics: AnalyticsMetrics;
  salesData: typeof mockSalesData;
  categoryBreakdown: typeof mockCategoryBreakdown;
  dateRange: DateRange;
  isLoading: boolean;
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
  const [settingsTab, setSettingsTab] = useState('profile');
  const [servicesTab, setServicesTab] = useState('services');

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

  // Notification State
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);

  const fetchNotifications = useCallback(async () => {
    await new Promise(resolve => setTimeout(resolve, 300));
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    await new Promise(resolve => setTimeout(resolve, 200));
    setNotifications(prev => prev.map(n =>
      n.id === id ? { ...n, read: true } : n
    ));
  }, []);

  const markAllAsRead = useCallback(async () => {
    await new Promise(resolve => setTimeout(resolve, 300));
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Analytics State
  const [analyticsMetrics] = useState<AnalyticsMetrics>(mockAnalytics);
  const [salesData] = useState<typeof mockSalesData>(mockSalesData);
  const [categoryBreakdown] = useState<typeof mockCategoryBreakdown>(mockCategoryBreakdown);
  const [analyticsDateRange, setAnalyticsDateRange] = useState<DateRange>({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    to: new Date(),
    label: 'Last 7 days',
  });
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 800));
    setAnalyticsLoading(false);
  }, []);

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
        settingsTab,
        servicesTab,
        toggleSidebar,
        setTheme,
        setSettingsTab,
        setServicesTab
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
                  fetchNotifications,
                  markAsRead,
                  markAllAsRead
                }}>
                  <AnalyticsStoreContext.Provider value={{
                    metrics: analyticsMetrics,
                    salesData,
                    categoryBreakdown,
                    dateRange: analyticsDateRange,
                    isLoading: analyticsLoading,
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
