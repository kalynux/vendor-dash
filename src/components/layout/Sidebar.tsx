import { useState } from 'react';
import { useUI, useRouter } from '@/App';
import { useNotificationStore, useUIStore } from '@/store';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Store,
  Bell,
  Shield,
  ChevronDown,
  User,
  CreditCard,
  Image as ImageIcon,
  Ticket,
  CalendarClock,
  CalendarDays,
  CalendarCheck,
  Wallet,
  Truck,
  ScrollText,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlatformStatus } from '@/components/layout/PlatformStatus';
import { cn } from '@/lib/utils';

type LegacyRoute =
  | 'overview' | 'orders' | 'products' | 'media' | 'customers'
  | 'analytics' | 'notifications' | 'settings' | 'tickets' | 'services';

interface NavChild {
  name: string;
  icon: LucideIcon;
  /** Settings-style child: selects a tab on the parent's page. */
  tabId?: string;
  /** Route-style child: navigates to its own route. */
  route?: LegacyRoute;
  disabled?: boolean;
}

interface NavItem {
  name: string;
  icon: LucideIcon;
  route?: LegacyRoute;
  badge?: 'orders' | 'notifications';
  children?: NavChild[];
}

// Data-driven menu — any item may declare `children` to get a submenu.
const navigation: NavItem[] = [
  { name: 'Overview', route: 'overview', icon: LayoutDashboard },
  { name: 'Orders', route: 'orders', icon: ShoppingCart, badge: 'orders' },
  { name: 'Products', route: 'products', icon: Package },
  {
    name: 'Bookings',
    route: 'services',
    icon: CalendarClock,
    children: [
      { name: 'Services', tabId: 'services', icon: CalendarClock },
      { name: 'Appointments', tabId: 'bookings', icon: CalendarDays },
      { name: 'Calendar', tabId: 'calendar', icon: CalendarCheck },
    ],
  },
  { name: 'Media', route: 'media', icon: ImageIcon },
  { name: 'Customers', route: 'customers', icon: Users },
  { name: 'Analytics', route: 'analytics', icon: BarChart3 },
  { name: 'Notifications', route: 'notifications', icon: Bell, badge: 'notifications' },
  { name: 'Tickets', route: 'tickets', icon: Ticket },
  {
    name: 'Settings',
    route: 'settings',
    icon: Settings,
    children: [
      { name: 'Profile', tabId: 'profile', icon: User },
      { name: 'Store', tabId: 'store', icon: Store },
      { name: 'Basic Setup', tabId: 'basic', icon: Wallet },
      { name: 'Delivery', tabId: 'delivery', icon: Truck },
      { name: 'Branding', tabId: 'branding', icon: ImageIcon },
      { name: 'Policies', tabId: 'policies', icon: ScrollText },
      { name: 'Notifications', tabId: 'notifications', icon: Bell },
      { name: 'Security', tabId: 'security', icon: Shield, disabled: true },
      { name: 'Billing', tabId: 'billing', icon: CreditCard, disabled: false },
    ],
  },
];

/** Left accent bar marking the active row (solid) or a parent-of-active (faded). */
function ActiveBar({ show, faded }: { show: boolean; faded?: boolean }) {
  if (!show) return null;
  return (
    <span
      className={cn(
        'absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full',
        faded ? 'bg-primary/40' : 'bg-primary',
      )}
    />
  );
}

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUI();
  const { setSettingsTab, settingsTab, setServicesTab, servicesTab } = useUIStore();
  const { unreadCount } = useNotificationStore();
  const { route, navigate } = useRouter();
  const roleEntity = useOnboarding().session?.role_entity;

  const storeName = roleEntity?.display_name || roleEntity?.business_name || 'My Store';
  const storeLogo = roleEntity?.branding?.logo_url || null;

  // Per-item manual expand overrides; otherwise a group auto-opens when a child
  // is active. Works for any item with children, not just Settings.
  const [manualExpanded, setManualExpanded] = useState<Record<string, boolean>>({});

  const isActive = (itemRoute?: string) => !!itemRoute && route === itemRoute;

  // Tab-style children select a tab on the parent's page. The active tab lives in
  // a per-route store value (settings → settingsTab, services → servicesTab).
  const activeTabFor = (itemRoute?: string): string | null => {
    if (itemRoute === 'settings') return settingsTab;
    if (itemRoute === 'services') return servicesTab;
    return null;
  };
  const setTabFor = (itemRoute: string, tabId: string) => {
    if (itemRoute === 'settings') setSettingsTab(tabId);
    else if (itemRoute === 'services') setServicesTab(tabId);
  };

  const isChildActive = (item: NavItem, child: NavChild): boolean => {
    if (child.tabId && item.route) {
      return route === item.route && activeTabFor(item.route) === child.tabId;
    }
    if (child.route) return route === child.route;
    return false;
  };
  const hasActiveChild = (item: NavItem) =>
    item.children?.some((c) => isChildActive(item, c)) ?? false;
  const isExpanded = (item: NavItem) =>
    manualExpanded[item.name] ?? hasActiveChild(item);
  const toggleExpanded = (item: NavItem) =>
    setManualExpanded((m) => ({ ...m, [item.name]: !(m[item.name] ?? hasActiveChild(item)) }));

  const selectChild = (item: NavItem, child: NavChild) => {
    if (child.disabled) return;
    if (child.tabId && item.route) {
      setTabFor(item.route, child.tabId);
      navigate(item.route);
    } else if (child.route) {
      navigate(child.route);
    }
  };

  const getBadgeCount = (badgeType?: string) => {
    if (badgeType === 'notifications') return unreadCount;
    if (badgeType === 'orders') return 3;
    return 0;
  };

  const rowBase =
    'relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground';

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-card border-r',
        'flex flex-col transition-all duration-300 ease-in-out',
        sidebarCollapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* Top — store / business name */}
      <div className="h-16 flex items-center gap-2 px-4 border-b flex-shrink-0">
        <div className="w-8 h-8 rounded-lg overflow-hidden bg-[#22C55E] flex items-center justify-center flex-shrink-0">
          {storeLogo ? (
            <img src={storeLogo} alt={storeName} className="w-full h-full object-cover" />
          ) : (
            <Store className="w-5 h-5 text-white" />
          )}
        </div>
        {!sidebarCollapsed && (
          <span className="font-bold text-base truncate">{storeName}</span>
        )}
      </div>

      {/* Navigation — the entire menu scrolls between top and footer */}
      <ScrollArea className="flex-1 min-h-0 py-4">
        <nav className="space-y-1 px-2">
          {navigation.map((item) => {
            const Icon = item.icon;
            const badgeCount = getBadgeCount(item.badge);
            const hasChildren = !!item.children?.length;
            const parentActive = isActive(item.route);
            const childActive = hasChildren && hasActiveChild(item);
            const open = hasChildren && isExpanded(item) && !sidebarCollapsed;

            const onClick = () => {
              if (hasChildren && !sidebarCollapsed) toggleExpanded(item);
              else if (item.route) navigate(item.route);
            };

            // Solid highlight when the row itself is the current page; faded when
            // only one of its children is active (and the group is collapsed/closed).
            const solid = parentActive && !childActive;
            const showBar = parentActive || childActive;

            return (
              <div key={item.name} className="space-y-1">
                <button
                  onClick={onClick}
                  className={cn(
                    rowBase,
                    solid && 'bg-accent text-accent-foreground',
                    childActive && !solid && 'bg-accent/50 text-accent-foreground',
                    sidebarCollapsed && 'justify-center'
                  )}
                >
                  <ActiveBar show={showBar} faded={childActive && !solid} />
                  <div className="relative">
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {badgeCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                        {badgeCount > 9 ? '9+' : badgeCount}
                      </span>
                    )}
                  </div>
                  {!sidebarCollapsed && (
                    <span className="flex-1 text-left whitespace-nowrap overflow-hidden">
                      {item.name}
                    </span>
                  )}
                  {!sidebarCollapsed && hasChildren && (
                    <ChevronDown
                      className={cn('w-4 h-4 transition-transform', open && 'rotate-180')}
                    />
                  )}
                </button>

                {open && (
                  <div className="ml-5 border-l pl-2 space-y-1 animate-in slide-in-from-top-2 duration-200">
                    {item.children!.map((child) => {
                      const ChildIcon = child.icon;
                      const cActive = isChildActive(item, child);
                      return (
                        <button
                          key={child.name}
                          onClick={() => selectChild(item, child)}
                          disabled={child.disabled}
                          className={cn(
                            rowBase,
                            'py-2',
                            cActive && 'bg-accent text-accent-foreground',
                            child.disabled &&
                              'opacity-50 cursor-not-allowed hover:bg-transparent hover:text-foreground'
                          )}
                        >
                          <ActiveBar show={cActive} />
                          <ChildIcon className="w-4 h-4 flex-shrink-0" />
                          <span className="whitespace-nowrap overflow-hidden">{child.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Footer — JoviMall platform + health, then the collapse toggle */}
      <div className="border-t flex-shrink-0">
        {sidebarCollapsed ? (
          <div className="flex justify-center py-3">
            <div className="relative w-8 h-8 rounded-md bg-[#22C55E] flex items-center justify-center">
              <Store className="w-4 h-4 text-white" />
              <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-card p-0.5">
                <PlatformStatus compact />
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-4 py-3">
            <div className="w-8 h-8 rounded-md bg-[#22C55E] flex items-center justify-center flex-shrink-0">
              <Store className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-tight">JoviMall</p>
              <PlatformStatus />
            </div>
          </div>
        )}

        <Button
          variant="ghost"
          onClick={toggleSidebar}
          className={cn(
            'w-full h-10 rounded-none border-t text-xs text-muted-foreground gap-2',
            sidebarCollapsed && 'px-0'
          )}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              Collapse
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
