import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRouter } from '@/App';
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
import { SignOutDialog } from '@/components/layout/SignOutDialog';
import { QUICK_ACTIONS, type QuickAction } from '@/config/quickActions';
import { notificationRoute, notificationVisual, notificationTimeAgo } from '@/lib/notifications.utils';
import { storePath, storefrontUrl } from '@/lib/storefront/urls';
import { useFormatters, useTranslation } from '@/i18n';

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
  const { t } = useTranslation();
  const fmt = useFormatters();
  const { navigate } = useRouter();
  const reactNavigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotificationStore();
  const { store } = useStoreStore();
  const roleEntity = useOnboarding().session?.role_entity;

  // This is the *user* menu (it links to Profile), so it leads with the vendor's
  // personal identity — `avatar` + `display_name`, both still on the profile. The
  // business logo/name moved to the Store, which the Sidebar renders; they're the
  // fallback here so the menu never goes blank on an account with no avatar set.
  const storeName = roleEntity?.display_name || store?.name || t('nav.sidebar.defaultStoreName');
  const storeLogo = roleEntity?.avatar?.url || store?.logo?.url || null;
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

  // Sample suggestions shown before the vendor types anything.
  const recentSearches = [
    t('nav.header.recentSamples.order'),
    t('nav.header.recentSamples.product'),
    t('nav.header.recentSamples.customer'),
    t('nav.header.recentSamples.store'),
  ];

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
              <span className="hidden sm:inline">{t('nav.header.search')}</span>
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
                <DropdownMenuLabel>{t('nav.quickActions.title')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {QUICK_ACTIONS.map((action) => (
                  <DropdownMenuItem
                    key={action.id}
                    onClick={() => handleQuickAction(action)}
                    className="gap-3"
                  >
                    <action.icon className="w-4 h-4" />
                    <div className="flex flex-col">
                      <span>{t(action.labelKey)}</span>
                      <span className="text-xs text-muted-foreground">{t(action.descriptionKey)}</span>
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
                  <DropdownMenuLabel className="m-0">{t('nav.header.notifications')}</DropdownMenuLabel>
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => markAllAsRead()}
                      className="h-auto py-1 px-2 text-xs"
                    >
                      {t('nav.header.markAllRead')}
                    </Button>
                  )}
                </div>
                <DropdownMenuSeparator />
                {unreadNotifications.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">{t('nav.header.noNewNotifications')}</p>
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
                          {notificationTimeAgo(notification.createdAt, t, (iso) => fmt.date(iso))}
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
                  {t('nav.header.viewAllNotifications')}
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
                  {t('nav.header.profile')}
                </DropdownMenuItem>
                {store?.slug && (
                  <DropdownMenuItem asChild className="gap-2">
                    <a
                      href={storefrontUrl(storePath(store.slug))}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="w-4 h-4" />
                      {t('nav.header.myStore')}
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
                  {t('nav.header.logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Logout confirmation — shared with the mobile profile screen, and the
          reason this stopped calling the `useAuth()` shim. See SignOutDialog. */}
      <SignOutDialog open={logoutOpen} onOpenChange={setLogoutOpen} />

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
                  placeholder={t('nav.header.searchPlaceholder')}
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
                      {t('nav.header.searchResultsFor', { query: searchQuery })}
                    </p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent cursor-pointer">
                        <ShoppingCart className="w-5 h-5 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="font-medium">{t('nav.header.recentSamples.order')}</p>
                          <p className="text-sm text-muted-foreground">{t('nav.header.recentSamples.orderMeta')}</p>
                        </div>
                        <Badge variant="secondary">{t('common.labels.order')}</Badge>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent cursor-pointer">
                        <Package className="w-5 h-5 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="font-medium">{t('nav.header.recentSamples.product')}</p>
                          <p className="text-sm text-muted-foreground">{t('nav.header.recentSamples.productMeta')}</p>
                        </div>
                        <Badge variant="secondary">{t('common.labels.product')}</Badge>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4">
                    {/* Quick Actions */}
                    <div className="mb-6">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                        {t('nav.quickActions.title')}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {QUICK_ACTIONS.map((action) => (
                          <button
                            key={action.id}
                            onClick={() => handleQuickAction(action)}
                            className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent text-left transition-colors"
                          >
                            <action.icon className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm">{t(action.labelKey)}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Recent Searches */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                        {t('nav.header.recentSearches')}
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
                    {t('nav.header.toNavigate')}
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="bg-muted px-1.5 py-0.5 rounded border">↵</kbd>
                    {t('nav.header.toSelect')}
                  </span>
                </div>
                <span className="flex items-center gap-1">
                  <kbd className="bg-muted px-1.5 py-0.5 rounded border">esc</kbd>
                  {t('nav.header.toClose')}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
