import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRouter } from '@/app-context';
import { useNotificationStore, useStoreStore } from '@/store';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import {
  Search,
  Bell,
  Plus,
  ArrowRight,
  LogOut,
  User,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { GlobalSearch } from '@/components/layout/GlobalSearch';
import { QUICK_ACTIONS, type QuickAction } from '@/config/quickActions';
import { notificationRoute, notificationVisual, notificationTimeAgo } from '@/lib/notifications.utils';
import { storePath, storefrontUrl } from '@/lib/storefront/urls';
import { useFormatters, useTranslation } from '@/i18n';

/** "⌘K" on a Mac, "Ctrl K" everywhere else — the shortcut listens for both. */
const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.userAgent);

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

  // ⌘K / Ctrl+K from anywhere on the dashboard — the button has always
  // advertised it; nothing listened until now.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
              <span className="hidden sm:inline">{t('nav.header.search')}</span>
              <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
                {IS_MAC ? '⌘K' : 'Ctrl K'}
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

      <GlobalSearch open={isSearchOpen} onOpenChange={setIsSearchOpen} />
    </>
  );
}
