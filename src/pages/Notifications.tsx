import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Check,
  RefreshCw,
  Settings,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ActiveFilterChips,
  FilterChips,
  FilterSection,
  FilterSheet,
  SearchFilterBar,
  type ActiveFilterChip,
} from '@/components/filters';
import { useNotificationStore } from '@/store';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobilePageHeader } from '@/components/layout/MobilePageHeader';
import { cn } from '@/lib/utils';
import { notificationRoute, notificationVisual, notificationTimeAgo, notificationActionLabel } from '@/lib/notifications.utils';
import { PushPermissionBanner } from '@/components/notifications/PushPermissionBanner';
import type { VendorNotification } from '@/types/notifications.types';
import { useFormatters, useTranslation, type TranslationKey } from '@/i18n';

/** Read state narrows the feed; `undefined` is the "All" chip. */
type ReadFilter = 'unread' | 'read';

const READ_FILTERS: { value: ReadFilter; labelKey: TranslationKey }[] = [
  { value: 'unread', labelKey: 'notifications.filters.unread' },
  { value: 'read', labelKey: 'notifications.filters.read' },
];

export function Notifications() {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const { notifications, unreadCount, isLoading, fetchNotifications, markAsRead, markAllAsRead } = useNotificationStore();
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [readFilter, setReadFilter] = useState<ReadFilter | undefined>(undefined);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  // Re-fetch the full feed whenever the vendor opens this tab.
  useEffect(() => {
    fetchNotifications({ page: 1, limit: 50 });
  }, [fetchNotifications]);

  // Both narrow client-side. The store's fetch already merges the read and
  // unread halves — the endpoint has no "both" value for `isRead`, so it takes
  // two calls — which means this filter has the whole page to work on. Before
  // that merge existed the "Read" option was permanently empty: an
  // unparameterised list call returns unread only.
  const query = searchQuery.trim().toLowerCase();
  const visibleNotifications = useMemo(
    () =>
      notifications.filter((n) => {
        if (readFilter === 'unread' && n.isRead) return false;
        if (readFilter === 'read' && !n.isRead) return false;
        if (!query) return true;
        return n.title.toLowerCase().includes(query) || n.message.toLowerCase().includes(query);
      }),
    [notifications, readFilter, query],
  );

  const openNotification = (n: VendorNotification) => {
    if (!n.isRead) markAsRead(n.id);
    navigate(notificationRoute(n));
  };

  const clearFilters = () => {
    setReadFilter(undefined);
    setSearchQuery('');
  };

  const activeFilterCount = readFilter ? 1 : 0;
  const activeChips: ActiveFilterChip[] = readFilter
    ? [
        {
          key: 'read',
          label: t('notifications.filters.chipStatus', {
            value: t(READ_FILTERS.find((f) => f.value === readFilter)!.labelKey),
          }),
          onRemove: () => setReadFilter(undefined),
        },
      ]
    : [];

  const filtersNode = (
    <div className="space-y-3">
      <SearchFilterBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder={t('notifications.filters.searchPlaceholder')}
        activeFilterCount={activeFilterCount}
        onOpenFilters={() => setFilterSheetOpen(true)}
        filterLabel={t('notifications.filters.title')}
      />
      <ActiveFilterChips chips={activeChips} onClearAll={clearFilters} />
    </div>
  );

  const filterSheet = (
    <FilterSheet
      open={filterSheetOpen}
      onOpenChange={setFilterSheetOpen}
      title={t('notifications.filters.title')}
      activeCount={activeFilterCount}
      onClear={clearFilters}
    >
      <FilterSection title={t('notifications.filters.readStatus')}>
        <FilterChips
          options={READ_FILTERS}
          value={readFilter}
          onChange={setReadFilter}
          allLabel={t('notifications.filters.all')}
        />
      </FilterSection>
    </FilterSheet>
  );

  const refresh = () => fetchNotifications({ page: 1, limit: 50 });

  // Which "nothing here" line to show: a narrowed feed reads differently from an
  // inbox that is genuinely empty.
  const emptyMessage = query
    ? t('notifications.empty.filtered')
    : readFilter === 'unread'
      ? t('notifications.empty.unread')
      : readFilter === 'read'
        ? t('notifications.empty.read')
        : t('notifications.empty.all');

  const NotificationItem = ({ notification }: { notification: VendorNotification }) => {
    const { Icon, iconWrap } = notificationVisual(notification);
    // Clicking the notification opens the entity that triggered it (and marks it
    // read). Notifications with no associated screen aren't clickable.
    const hasTarget = Boolean(notification.aggregateType);
    const actionLabel = notificationActionLabel(notification, t);

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

  const notificationList = (
    <Card>
      <CardContent className="p-0">
        {visibleNotifications.length === 0 ? (
          <div className="py-12 text-center">
            <Bell className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{emptyMessage}</p>
          </div>
        ) : (
          <div className="divide-y">
            {visibleNotifications.map((notification) => (
              <NotificationItem key={notification.id} notification={notification} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className={cn('animate-fade-in', isMobile ? '-mx-6 -mt-6' : 'space-y-6')}>
      {isMobile ? (
        <MobilePageHeader
          title={t('notifications.title')}
          description={t('notifications.subtitle')}
          actions={[
            // Conditional rather than disabled: "mark all read" with nothing
            // unread is not an action that is temporarily unavailable, it is
            // one that does not apply.
            ...(unreadCount > 0
              ? [{
                id: 'mark-all',
                icon: Check,
                label: t('notifications.actions.markAllRead'),
                onClick: () => markAllAsRead(),
              }]
              : []),
            {
              id: 'refresh',
              icon: RefreshCw,
              label: t('common.actions.refresh'),
              onClick: refresh,
              busy: isLoading,
            },
            {
              id: 'settings',
              icon: Settings,
              label: t('notifications.settings.title'),
              onClick: () => navigate('/dashboard/settings/notifications'),
            },
          ]}
          subheader={filtersNode}
        />
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            {/* The unread/total counts read as badges beside the title — they
                replaced a pair of full-width stat cards that pushed the feed
                itself below the fold. */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="text-2xl font-bold">{t('notifications.title')}</h1>
              <div className="flex items-center gap-2">
                <Badge variant={unreadCount > 0 ? 'default' : 'secondary'}>
                  <Bell />
                  <span className="tabular-nums">{unreadCount}</span>
                  {t('notifications.stats.unread')}
                </Badge>
                <Badge variant="outline">
                  <span className="tabular-nums">{notifications.length}</span>
                  {t('notifications.stats.total')}
                </Badge>
              </div>
            </div>
            <p className="text-muted-foreground">{t('notifications.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button variant="outline" onClick={() => markAllAsRead()}>
                <Check className="w-4 h-4 mr-2" />
                {t('notifications.actions.markAllRead')}
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              aria-label={t('common.actions.refresh')}
              title={t('common.actions.refresh')}
              onClick={refresh}
            >
              <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label={t('notifications.settings.title')}
              title={t('notifications.settings.title')}
              onClick={() => navigate('/dashboard/settings/notifications')}
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      <PushPermissionBanner className={cn(isMobile && 'mx-4 mt-3')} />

      {isMobile ? (
        <div className="px-4 pt-3 pb-28">{notificationList}</div>
      ) : (
        <>
          {filtersNode}
          {notificationList}
        </>
      )}

      {filterSheet}
    </div>
  );
}
