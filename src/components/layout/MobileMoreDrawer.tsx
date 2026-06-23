import { useState } from 'react';
import {
  User,
  Store,
  CreditCard,
  BarChart3,
  Users,
  Image as ImageIcon,
  Bell,
  Shield,
  ChevronRight,
  ChevronDown,
  Settings,
  Ticket,
  CalendarClock,
  CalendarDays,
  CalendarCheck,
  type LucideIcon,
} from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useAuth, useRouter } from '@/App';
import { useNotificationStore, useUIStore } from '@/store';
import { cn } from '@/lib/utils';

type LegacyRoute = 'overview' | 'orders' | 'products' | 'product-upload' | 'customers'
  | 'analytics' | 'vendors' | 'notifications' | 'settings' | 'media' | 'tickets'
  | 'services' | 'login';

interface MenuChild {
  label: string;
  icon: LucideIcon;
  /** Selects a tab on the parent's page. */
  tabId?: string;
  /** Navigates to its own route. */
  route?: LegacyRoute;
  badge?: number;
  disabled?: boolean;
}

interface MenuItemDef {
  label: string;
  icon: LucideIcon;
  route?: LegacyRoute;
  badge?: number;
  children?: MenuChild[];
}

interface MenuGroupDef {
  items: MenuItemDef[];
}

interface NavHandlers {
  navigateRoute: (route: LegacyRoute) => void;
  selectTab: (route: LegacyRoute, tabId: string) => void;
}

function MenuRow({
  item,
  handlers,
}: {
  item: MenuItemDef;
  handlers: NavHandlers;
}) {
  const Icon = item.icon;
  const hasChildren = !!item.children?.length;
  const [open, setOpen] = useState(false);

  const onClick = () => {
    if (hasChildren) setOpen((o) => !o);
    else if (item.route) handlers.navigateRoute(item.route);
  };

  return (
    <div>
      <button
        onClick={onClick}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent transition-colors"
      >
        <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4" />
        </div>
        <span className="flex-1 text-left text-sm font-medium">{item.label}</span>
        {item.badge !== undefined && item.badge > 0 && (
          <span className="w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center mr-1">
            {item.badge > 9 ? '9+' : item.badge}
          </span>
        )}
        {hasChildren ? (
          <ChevronDown
            className={cn('w-4 h-4 text-muted-foreground transition-transform', open && 'rotate-180')}
          />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {hasChildren && open && (
        <div className="bg-muted/30 border-t animate-in slide-in-from-top-1 duration-200">
          {item.children!.map((child) => {
            const ChildIcon = child.icon;
            return (
              <button
                key={child.label}
                disabled={child.disabled}
                onClick={() => {
                  if (child.disabled) return;
                  if (child.tabId && item.route) handlers.selectTab(item.route, child.tabId);
                  else if (child.route) handlers.navigateRoute(child.route);
                }}
                className={cn(
                  'w-full flex items-center gap-3 pl-8 pr-4 py-2.5 hover:bg-accent transition-colors',
                  child.disabled && 'opacity-50 cursor-not-allowed hover:bg-transparent',
                )}
              >
                <div className="w-7 h-7 rounded-lg bg-card border flex items-center justify-center flex-shrink-0">
                  <ChildIcon className="w-3.5 h-3.5" />
                </div>
                <span className="flex-1 text-left text-sm">{child.label}</span>
                {child.badge !== undefined && child.badge > 0 && (
                  <span className="w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                    {child.badge > 9 ? '9+' : child.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MenuGroup({ group, handlers }: { group: MenuGroupDef; handlers: NavHandlers }) {
  return (
    <div className="bg-card rounded-xl mx-4 mb-3 overflow-hidden border divide-y">
      {group.items.map((item) => (
        <MenuRow key={item.label} item={item} handlers={handlers} />
      ))}
    </div>
  );
}

interface MobileMoreDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileMoreDrawer({ open, onOpenChange }: MobileMoreDrawerProps) {
  const { user } = useAuth();
  const { navigate } = useRouter();
  const { unreadCount } = useNotificationStore();
  const { setSettingsTab, setServicesTab } = useUIStore();

  const handlers: NavHandlers = {
    navigateRoute: (route) => {
      navigate(route);
      onOpenChange(false);
    },
    selectTab: (route, tabId) => {
      if (route === 'settings') setSettingsTab(tabId);
      else if (route === 'services') setServicesTab(tabId);
      navigate(route);
      onOpenChange(false);
    },
  };

  // Mirrors the desktop sidebar: Bookings and Settings expose their sub-tabs.
  const groups: MenuGroupDef[] = [
    {
      items: [
        {
          label: 'Settings',
          icon: Settings,
          route: 'settings',
          children: [
            { label: 'Profile', icon: User, tabId: 'profile' },
            { label: 'Store', icon: Store, tabId: 'store' },
            { label: 'Notifications', icon: Bell, tabId: 'notifications' },
            { label: 'Security', icon: Shield, tabId: 'security', disabled: true },
            { label: 'Billing & Payouts', icon: CreditCard, tabId: 'billing', disabled: false },
          ],
        },
      ],
    },
    {
      items: [
        {
          label: 'Bookings',
          icon: CalendarClock,
          route: 'services',
          children: [
            { label: 'Services', icon: CalendarClock, tabId: 'services' },
            { label: 'Appointments', icon: CalendarDays, tabId: 'bookings' },
            { label: 'Calendar', icon: CalendarCheck, tabId: 'calendar' },
          ],
        },
        { label: 'Analytics', icon: BarChart3, route: 'analytics' },
        { label: 'Customers', icon: Users, route: 'customers' },
        { label: 'Media library', icon: ImageIcon, route: 'media' },
        { label: 'Tickets', icon: Ticket, route: 'tickets' },
      ],
    },
    {
      items: [
        { label: 'Notifications', icon: Bell, route: 'notifications', badge: unreadCount },
      ],
    },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] p-0 rounded-t-2xl">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="px-4 py-4 border-b flex-shrink-0">
            <h2 className="text-xl font-bold">More</h2>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            {/* Vendor profile card */}
            <div className="mx-4 mt-4 mb-4 p-4 bg-card rounded-xl border flex items-center gap-3">
              <img
                src={user?.avatar || `https://i.pravatar.cc/150?u=${user?.id}`}
                alt={user?.name}
                className="w-12 h-12 rounded-full flex-shrink-0 object-cover"
              />
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{user?.name}</p>
                <p className="text-sm text-muted-foreground">
                  {user?.name ?? 'My Store'} · Vendor
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handlers.navigateRoute('settings')}
                className="flex-shrink-0"
              >
                <Settings className="w-4 h-4" />
              </Button>
            </div>

            {groups.map((group, i) => (
              <MenuGroup key={i} group={group} handlers={handlers} />
            ))}

            <div className="h-8" />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
