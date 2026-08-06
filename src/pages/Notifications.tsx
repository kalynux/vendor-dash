import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Check,
  Settings,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNotificationStore } from '@/store';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobilePageHeader } from '@/components/layout/MobilePageHeader';
import { cn } from '@/lib/utils';
import { notificationRoute, notificationVisual, notificationTimeAgo, notificationActionLabel } from '@/lib/notifications.utils';
import { PushPermissionBanner } from '@/components/notifications/PushPermissionBanner';
import type { VendorNotification } from '@/types/notifications.types';
import { useFormatters, useTranslation } from '@/i18n';

export function Notifications() {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const { notifications, unreadCount, fetchNotifications, markAsRead, markAllAsRead } = useNotificationStore();
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  // Re-fetch the full feed whenever the vendor opens this tab.
  useEffect(() => {
    fetchNotifications({ page: 1, limit: 50 });
  }, [fetchNotifications]);

  const unreadNotifications = notifications.filter((n) => !n.isRead);
  const readNotifications = notifications.filter((n) => n.isRead);

  const openNotification = (n: VendorNotification) => {
    if (!n.isRead) markAsRead(n.id);
    navigate(notificationRoute(n));
  };

  const NotificationItem = ({ notification }: { notification: VendorNotification }) => {
    const { Icon, iconWrap } = notificationVisual(notification);
    // Clicking the notification opens the entity that triggered it (and marks it
    // read). Notifications with no associated screen aren't clickable.
    const hasTarget = Boolean(notification.aggregateType);
    const actionLabel = notificationActionLabel(notification);

    return (
      <div
        role={hasTarget ? 'button' : undefined}
        tabIndex={hasTarget ? 0 : undefined}
        onClick={hasTarget ? () => openNotification(notification) : undefined}
        onKeyDown={
          hasTarget
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openNotification(notification);
                }
              }
            : undefined
        }
        className={cn(
          'flex items-start gap-4 p-4 rounded-lg transition-colors',
          !notification.isRead && 'bg-primary/5',
          hasTarget && 'cursor-pointer',
          'hover:bg-muted/50'
        )}
      >
        <div className={cn('p-2 rounded-lg flex-shrink-0', iconWrap)}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className={cn('font-medium', !notification.isRead && 'text-primary')}>
                {notification.title}
              </p>
              <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
            </div>
            <span className="text-xs text-muted-foreground flex-shrink-0">
              {notificationTimeAgo(notification.createdAt, t, (iso) => fmt.date(iso))}
            </span>
          </div>
          {hasTarget && (
            <Button
              variant="link"
              size="sm"
              className="p-0 h-auto mt-2 gap-1"
              onClick={(e) => {
                e.stopPropagation();
                openNotification(notification);
              }}
            >
              {actionLabel}
              <ArrowRight className="w-3 h-3" />
            </Button>
          )}
        </div>
        {!notification.isRead && (
          <Button
            variant="ghost"
            size="icon"
            className="flex-shrink-0 h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              markAsRead(notification.id);
            }}
            aria-label={t('notifications.actions.markRead')}
          >
            <Check className="w-4 h-4" />
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className={cn('animate-fade-in', isMobile ? '-mx-6 -mt-6' : 'space-y-6')}>
      {isMobile ? (
        <MobilePageHeader
          title={t('notifications.title')}
          actions={
            <>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAllAsRead()}
                  aria-label={t('notifications.actions.markAllRead')}
                  className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent transition-colors"
                >
                  <Check className="w-5 h-5" />
                </button>
              )}
              <button
                type="button"
                aria-label={t('notifications.settings.title')}
                onClick={() => navigate('/dashboard/settings/notifications')}
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent transition-colors"
              >
                <Settings className="w-5 h-5" />
              </button>
            </>
          }
        />
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{t('notifications.title')}</h1>
            <p className="text-muted-foreground">{t('notifications.subtitle')}</p>
          </div>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <Button variant="outline" onClick={() => markAllAsRead()}>
                <Check className="w-4 h-4 mr-2" />
                {t('notifications.actions.markAllRead')}
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              aria-label={t('notifications.settings.title')}
              onClick={() => navigate('/dashboard/settings/notifications')}
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      <PushPermissionBanner className={cn(isMobile && 'mx-4 mt-3')} />

      {/* Stats (desktop only) */}
      {!isMobile && (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('notifications.stats.unread')}</p>
                <p className="text-2xl font-bold">{unreadCount}</p>
              </div>
              <div className="p-3 bg-primary/10 rounded-lg">
                <Bell className="w-5 h-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('notifications.stats.total')}</p>
                <p className="text-2xl font-bold">{notifications.length}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Check className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      )}

      {/* Notifications List */}
      <Tabs defaultValue="all" className={cn('w-full', isMobile && 'px-4 pt-3 pb-28')}>
        <TabsList>
          <TabsTrigger value="all" className="gap-2">
            {t('notifications.tabs.all')}
            <Badge variant="secondary">{notifications.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="unread" className="gap-2">
            {t('notifications.tabs.unread')}
            {unreadCount > 0 && <Badge variant="destructive">{unreadCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="read">{t('notifications.tabs.read')}</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {notifications.length === 0 ? (
                <div className="py-12 text-center">
                  <Bell className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">{t('notifications.empty.all')}</p>
                </div>
              ) : (
                <div className="divide-y">
                  {notifications.map((notification) => (
                    <NotificationItem key={notification.id} notification={notification} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="unread" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {unreadNotifications.length === 0 ? (
                <div className="py-12 text-center">
                  <Check className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">{t('notifications.empty.unread')}</p>
                </div>
              ) : (
                <div className="divide-y">
                  {unreadNotifications.map((notification) => (
                    <NotificationItem key={notification.id} notification={notification} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="read" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {readNotifications.length === 0 ? (
                <div className="py-12 text-center">
                  <Bell className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">{t('notifications.empty.read')}</p>
                </div>
              ) : (
                <div className="divide-y">
                  {readNotifications.map((notification) => (
                    <NotificationItem key={notification.id} notification={notification} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
