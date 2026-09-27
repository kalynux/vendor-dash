/**
 * Store contexts, state shapes and the `useXxxStore` hooks.
 *
 * Kept apart from `StoreProvider` (in `index.tsx`) so that file exports only
 * a component and React Fast Refresh keeps working. Import from `@/store`.
 */
import { createContext, useContext } from 'react';
import type {
  Product, Order,
  AnalyticsMetrics, SalesDataPoint, TopProduct,
  CustomerMetrics, DateRange, VendorSettableStatus
} from '@/types';
import type { VendorNotification, NotificationListParams } from '@/types/notifications.types';
import type { VendorStore } from '@/types/store.types';
import type { DashboardMetrics } from '@/services/analytics.service';
import type { PaginationMeta, OrdersQueryParams } from '@/services/orders.service';
import type { ProductListItem, ProductListMeta, ProductsQueryParams } from '@/types/product.types';

// UI Store Context
export type Theme = 'light' | 'dark' | 'system';

export interface UIState {
  sidebarCollapsed: boolean;
  theme: Theme;
  toggleSidebar: () => void;
  setTheme: (theme: Theme) => void;
}

export const UIStoreContext = createContext<UIState | null>(null);

// Store Store Context — the vendor's single storefront profile (GET /api/vendor/store).
export interface StoreState {
  store: VendorStore | null;
  isLoading: boolean;
  fetchStore: () => Promise<void>;
  /** Replace the cached store after a successful save (avoids a re-fetch). */
  applyStore: (store: VendorStore) => void;
}

export const StoreStoreContext = createContext<StoreState | null>(null);

// Product Store Context
export interface ProductState {
  products: ProductListItem[];
  selectedProducts: string[];
  isLoading: boolean;
  pagination: ProductListMeta | null;
  /**
   * `silent`: background refresh — no `isLoading` (so no skeleton) and no
   * error toast; on failure the rows already shown stay.
   */
  fetchProducts: (params?: ProductsQueryParams, opts?: { silent?: boolean }) => Promise<void>;
  // createProduct / updateProduct are no-ops — the wizard pages handle their own saves
  createProduct: (product: Partial<Product>) => Promise<void>;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  toggleProductSelection: (id: string) => void;
  selectAllProducts: (ids: string[]) => void;
  clearSelection: () => void;
}

export const ProductStoreContext = createContext<ProductState | null>(null);

// Order Store Context
export interface OrderState {
  orders: Order[];
  selectedOrders: string[];
  isLoading: boolean;
  pagination: PaginationMeta | null;
  filters: {
    status?: string[];
    dateRange?: DateRange;
    search?: string;
  };
  /**
   * `silent`: background refresh — no `isLoading` (so no skeleton), and the
   * error is thrown to the caller instead of toasted; the rows shown stay.
   */
  fetchOrders: (params?: OrdersQueryParams, opts?: { silent?: boolean }) => Promise<void>;
  fetchOrderById: (id: string) => Promise<Order>;
  updateOrderStatus: (id: string, status: VendorSettableStatus) => Promise<void>;
  toggleOrderSelection: (id: string) => void;
  selectAllOrders: (ids: string[]) => void;
  clearSelection: () => void;
  setFilters: (filters: Partial<OrderState['filters']>) => void;
}

export const OrderStoreContext = createContext<OrderState | null>(null);

// Notification Store Context
export interface NotificationState {
  notifications: VendorNotification[];
  unreadCount: number;
  isLoading: boolean;
  fetchNotifications: (params?: NotificationListParams) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  /** Prepend a live (push) notification and bump the unread badge. */
  prependNotification: (n: VendorNotification) => void;
}

export const NotificationStoreContext = createContext<NotificationState | null>(null);

// Analytics Store Context
export interface AnalyticsState {
  metrics: AnalyticsMetrics;
  salesData: SalesDataPoint[];
  topProducts: TopProduct[];
  customerMetrics: CustomerMetrics | null;
  /** The dashboard endpoint's money summary: sales deductions, bookings, net earnings. */
  summary: DashboardMetrics | null;
  dateRange: DateRange;
  isLoading: boolean;
  fetchAnalytics: () => Promise<void>;
  setDateRange: (range: DateRange) => void;
}

export const AnalyticsStoreContext = createContext<AnalyticsState | null>(null);

// Hooks
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
