import { useState } from 'react';
import { LayoutDashboard, ShoppingCart, Package, Menu, Plus, Box, ShoppingBag, UserPlus, Image, ChevronRight } from 'lucide-react';
import { useRouter } from '@/App';
import { useNotificationStore } from '@/store';
import { cn } from '@/lib/utils';
import { MobileMoreDrawer } from './MobileMoreDrawer';
import { Sheet, SheetContent } from '@/components/ui/sheet';

type LegacyRoute = 'overview' | 'orders' | 'products' | 'product-upload' | 'customers'
  | 'analytics' | 'vendors' | 'notifications' | 'settings' | 'media' | 'support' | 'login';

interface TabButtonProps {
  label: string;
  icon: React.ElementType;
  active?: boolean;
  badge?: number;
  onClick: () => void;
}

function TabButton({ label, icon: Icon, active, badge, onClick }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center justify-center gap-0.5 flex-1 py-1',
        active ? 'text-foreground' : 'text-muted-foreground',
      )}
    >
      <div className="relative">
        <Icon className="w-5 h-5" />
        {badge !== undefined && badge > 0 && (
          <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </div>
      <span className={cn('text-[10px]', active && 'font-semibold')}>{label}</span>
    </button>
  );
}

const quickActions = [
  {
    icon: Box,
    label: 'Add Product',
    description: 'Create a new listing',
    route: 'product-upload' as LegacyRoute,
  },
  {
    icon: ShoppingBag,
    label: 'Create Order',
    description: 'Draft an order for a customer',
    route: 'orders' as LegacyRoute,
  },
  {
    icon: UserPlus,
    label: 'Add Customer',
    description: 'Save a new contact',
    route: 'customers' as LegacyRoute,
  },
  {
    icon: Image,
    label: 'Upload Media',
    description: 'Add product photos or banners',
    route: 'media' as LegacyRoute,
  },
];

export function MobileTabBar() {
  const { route, navigate } = useRouter();
  const { unreadCount } = useNotificationStore();
  const [moreOpen, setMoreOpen] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);

  const tabs: { label: string; icon: React.ElementType; route: LegacyRoute; badge?: number }[] = [
    { label: 'Overview', icon: LayoutDashboard, route: 'overview' },
    { label: 'Orders', icon: ShoppingCart, route: 'orders', badge: 3 },
  ];

  const rightTabs: { label: string; icon: React.ElementType; route: LegacyRoute }[] = [
    { label: 'Products', icon: Package, route: 'products' },
  ];

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t h-16 safe-area-inset-bottom">
        <div className="flex items-center justify-around h-full px-2">
          {tabs.map((tab) => (
            <TabButton
              key={tab.route}
              label={tab.label}
              icon={tab.icon}
              active={route === tab.route}
              badge={tab.badge}
              onClick={() => navigate(tab.route)}
            />
          ))}

          {/* FAB */}
          <button
            onClick={() => setQuickActionsOpen(true)}
            className="-mt-5 w-14 h-14 rounded-full bg-black text-white shadow-lg flex items-center justify-center flex-shrink-0"
          >
            <Plus className="w-6 h-6" />
          </button>

          {rightTabs.map((tab) => (
            <TabButton
              key={tab.route}
              label={tab.label}
              icon={tab.icon}
              active={route === tab.route}
              onClick={() => navigate(tab.route)}
            />
          ))}

          <TabButton
            label="More"
            icon={Menu}
            active={moreOpen}
            badge={unreadCount > 0 ? unreadCount : undefined}
            onClick={() => setMoreOpen(true)}
          />
        </div>
      </nav>

      <MobileMoreDrawer open={moreOpen} onOpenChange={setMoreOpen} />

      {/* Quick Actions Sheet */}
      <Sheet open={quickActionsOpen} onOpenChange={setQuickActionsOpen}>
        <SheetContent side="bottom" className="p-0 rounded-t-2xl">
          <div className="px-4 pt-4 pb-2 border-b">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              Quick Actions
            </p>
          </div>
          <div className="py-2">
            {quickActions.map((action) => (
              <button
                key={action.route}
                onClick={() => {
                  navigate(action.route);
                  setQuickActionsOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-accent transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                  <action.icon className="w-5 h-5" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold">{action.label}</p>
                  <p className="text-xs text-muted-foreground">{action.description}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </button>
            ))}
          </div>
          <div className="h-safe-bottom pb-2" />
        </SheetContent>
      </Sheet>
    </>
  );
}
