import {
  User,
  Store,
  CreditCard,
  BarChart3,
  Users,
  Image,
  Bell,
  Shield,
  ChevronRight,
  Settings,
  HelpCircle,
} from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useAuth, useRouter } from '@/App';
import { useNotificationStore } from '@/store';

type LegacyRoute = 'overview' | 'orders' | 'products' | 'product-upload' | 'customers'
  | 'analytics' | 'vendors' | 'notifications' | 'settings' | 'media' | 'support' | 'login';

interface MenuItemProps {
  icon: React.ElementType;
  label: string;
  route: LegacyRoute;
  badge?: number;
  onNavigate: (route: LegacyRoute) => void;
}

function MenuItem({ icon: Icon, label, route, badge, onNavigate }: MenuItemProps) {
  return (
    <button
      onClick={() => onNavigate(route)}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent transition-colors"
    >
      <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <span className="flex-1 text-left text-sm font-medium">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center mr-1">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
      <ChevronRight className="w-4 h-4 text-muted-foreground" />
    </button>
  );
}

function MenuGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-xl mx-4 mb-3 overflow-hidden border">
      {children}
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

  const handleNavigate = (route: LegacyRoute) => {
    navigate(route);
    onOpenChange(false);
  };

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
                onClick={() => handleNavigate('settings')}
                className="flex-shrink-0"
              >
                <Settings className="w-4 h-4" />
              </Button>
            </div>

            {/* Group 1: Account */}
            <MenuGroup>
              <MenuItem icon={User} label="Profile" route="settings" onNavigate={handleNavigate} />
              <div className="border-t" />
              <MenuItem icon={Store} label="Store" route="settings" onNavigate={handleNavigate} />
              <div className="border-t" />
              <MenuItem icon={CreditCard} label="Billing & Payouts" route="settings" onNavigate={handleNavigate} />
            </MenuGroup>

            {/* Group 2: Tools */}
            <MenuGroup>
              <MenuItem icon={BarChart3} label="Analytics" route="analytics" onNavigate={handleNavigate} />
              <div className="border-t" />
              <MenuItem icon={Users} label="Customers" route="customers" onNavigate={handleNavigate} />
              <div className="border-t" />
              <MenuItem icon={Image} label="Media library" route="media" onNavigate={handleNavigate} />
            </MenuGroup>

            {/* Group 3: Settings */}
            <MenuGroup>
              <MenuItem
                icon={Bell}
                label="Notifications"
                route="notifications"
                badge={unreadCount}
                onNavigate={handleNavigate}
              />
              <div className="border-t" />
              <MenuItem icon={Shield} label="Security" route="settings" onNavigate={handleNavigate} />
            </MenuGroup>

            {/* Help */}
            <MenuGroup>
              <MenuItem
                icon={HelpCircle}
                label="Help & Support"
                route="support"
                onNavigate={handleNavigate}
              />
            </MenuGroup>

            <div className="h-8" />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
