import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useRouter } from '@/App';
import { useNotificationStore, useStoreStore } from '@/store';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import {
  Search,
  Bell,
  Plus,
  Command,
  X,
  ArrowRight,
  ShoppingCart,
  Package,
  LogOut,
  User,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { QUICK_ACTIONS, type QuickAction } from '@/config/quickActions';
import { notificationRoute, notificationVisual, notificationTimeAgo } from '@/lib/notifications.utils';

const recentSearches = [
  'Order #1001',
  'Wireless Headphones',
  'Alice Johnson',
  'Tech Gadgets Pro',
];

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function Header() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [logoutOpen, setLogoutOpen] = useState(false);
  const { logout } = useAuth();
  const { navigate } = useRouter();
  const reactNavigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotificationStore();
  const { currentStore } = useStoreStore();
  const roleEntity = useOnboarding().session?.role_entity;

  const storeName = roleEntity?.display_name || roleEntity?.business_name || 'My Store';
  const storeLogo = roleEntity?.branding?.logo?.url || null;
  const storeEmail = roleEntity?.email ?? '';

  const toggleSearch = () => setIsSearchOpen((v) => !v);

  const handleQuickAction = (action: QuickAction) => {
    setIsSearchOpen(false);
    reactNavigate(
      `/dashboard/${action.route}`,
      action.intent ? { state: { create: true } } : undefined,
    );
  };

  const goToProfile = () => {
    reactNavigate('/dashboard/account/profile');
  };

  const unreadNotifications = notifications.filter((n) => !n.isRead).slice(0, 5);

  const openNotification = (n: typeof notifications[number]) => {
    markAsRead(n.id);
    reactNavigate(notificationRoute(n));
  };

  return (
    <>
      <header className="h-16 border-b bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="h-full px-6 flex items-center justify-between">
          {/* Left - search */}
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              className="h-9 gap-2 text-muted-foreground"
              onClick={toggleSearch}
            >
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">Search...</span>
              <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
                <Command className="w-3 h-3" />
                <span>K</span>
              </kbd>
            </Button>
          </div>

          {/* Right - Actions */}
          <div className="flex items-center gap-3">
            {/* Quick Actions */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9">
                  <Plus className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {QUICK_ACTIONS.map((action) => (
                  <DropdownMenuItem
                    key={action.id}
                    onClick={() => handleQuickAction(action)}
                    className="gap-3"
                  >
                    <action.icon className="w-4 h-4" />
                    <div className="flex flex-col">
                      <span>{action.label}</span>
                      <span className="text-xs text-muted-foreground">{action.description}</span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9 relative">
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <div className="flex items-center justify-between px-3 py-2">
                  <DropdownMenuLabel className="m-0">Notifications</DropdownMenuLabel>
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => markAllAsRead()}
                      className="h-auto py-1 px-2 text-xs"
                    >
                      Mark all read
                    </Button>
                  )}
                </div>
                <DropdownMenuSeparator />
                {unreadNotifications.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No new notifications</p>
                  </div>
                ) : (
                  unreadNotifications.map((notification) => (
                    <DropdownMenuItem
                      key={notification.id}
                      onClick={() => openNotification(notification)}
                      className="flex flex-col items-start gap-1 p-3 cursor-pointer"
                    >
                      <div className="flex items-center gap-2 w-full">
                        <span className={`w-2 h-2 rounded-full ${notificationVisual(notification).dot}`} />
                        <span className="font-medium text-sm flex-1">{notification.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {notificationTimeAgo(notification.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 pl-4">
                        {notification.message}
                      </p>
                    </DropdownMenuItem>
                  ))
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => navigate('notifications')}
                  className="justify-center text-sm text-primary"
                >
                  View all notifications
                  <ArrowRight className="w-4 h-4 ml-1" />
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={storeLogo ?? undefined} alt={storeName} />
                    <AvatarFallback className="text-xs font-semibold">
                      {initialsOf(storeName)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="truncate">{storeName}</span>
                    {storeEmail && (
                      <span className="text-xs text-muted-foreground font-normal truncate">
                        {storeEmail}
                      </span>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={goToProfile} className="gap-2">
                  <User className="w-4 h-4" />
                  Profile
                </DropdownMenuItem>
                {currentStore?.domain && (
                  <DropdownMenuItem asChild className="gap-2">
                    <a
                      href={`https://${currentStore.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="w-4 h-4" />
                      My Store
                    </a>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setLogoutOpen(true);
                  }}
                  className="gap-2 text-destructive focus:text-destructive"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Logout confirmation */}
      <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Log out?</AlertDialogTitle>
            <AlertDialogDescription>
              You&apos;ll need to sign in again to access your dashboard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => logout()}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Log out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Global Search Overlay */}
      {isSearchOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          onClick={() => setIsSearchOpen(false)}
        >
          <div
            className="absolute top-20 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-card rounded-xl shadow-2xl border overflow-hidden">
              {/* Search Input */}
              <div className="flex items-center gap-3 p-4 border-b">
                <Search className="w-5 h-5 text-muted-foreground" />
                <Input
                  id="global-search"
                  placeholder="Search orders, products, customers..."
                  className="flex-1 border-0 bg-transparent text-lg focus-visible:ring-0 placeholder:text-muted-foreground"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <kbd className="hidden sm:inline-flex h-7 select-none items-center gap-1 rounded border bg-muted px-2 font-mono text-xs font-medium">
                  ESC
                </kbd>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setIsSearchOpen(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Search Results */}
              <div className="max-h-[60vh] overflow-auto">
                {searchQuery ? (
                  <div className="p-4">
                    <p className="text-sm text-muted-foreground mb-3">
                      Search results for &quot;{searchQuery}&quot;
                    </p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent cursor-pointer">
                        <ShoppingCart className="w-5 h-5 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="font-medium">Order #1001</p>
                          <p className="text-sm text-muted-foreground">Alice Johnson - $284.97</p>
                        </div>
                        <Badge variant="secondary">Order</Badge>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent cursor-pointer">
                        <Package className="w-5 h-5 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="font-medium">Wireless Bluetooth Headphones</p>
                          <p className="text-sm text-muted-foreground">SKU: WBH-001 - $149.99</p>
                        </div>
                        <Badge variant="secondary">Product</Badge>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4">
                    {/* Quick Actions */}
                    <div className="mb-6">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                        Quick Actions
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {QUICK_ACTIONS.map((action) => (
                          <button
                            key={action.id}
                            onClick={() => handleQuickAction(action)}
                            className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent text-left transition-colors"
                          >
                            <action.icon className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm">{action.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Recent Searches */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                        Recent Searches
                      </p>
                      <div className="space-y-1">
                        {recentSearches.map((search, index) => (
                          <button
                            key={index}
                            onClick={() => setSearchQuery(search)}
                            className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-accent text-left transition-colors"
                          >
                            <ArrowRight className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm">{search}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-t text-xs text-muted-foreground">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <kbd className="bg-muted px-1.5 py-0.5 rounded border">↑↓</kbd>
                    to navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="bg-muted px-1.5 py-0.5 rounded border">↵</kbd>
                    to select
                  </span>
                </div>
                <span className="flex items-center gap-1">
                  <kbd className="bg-muted px-1.5 py-0.5 rounded border">esc</kbd>
                  to close
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
