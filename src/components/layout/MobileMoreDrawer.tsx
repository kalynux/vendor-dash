import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronDown, Settings } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { AppLogo } from '@/components/layout/AppLogo';
import { PlatformStatus } from '@/components/layout/PlatformStatus';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { nameInitials } from '@/components/customers/customer.constants';
import { useAuth } from '@/App';
import { useNotificationStore } from '@/store';
import { PRIMARY_NAV, FOOTER_NAV, type NavItem, type NavChild, type NavBadge } from '@/config/navigation';
import { cn } from '@/lib/utils';
import { useKycNeedsAttention } from '@/hooks/use-kyc-attention';
import { useTranslation } from '@/i18n';

// Items already present in the bottom tab bar — hidden from "More".
const TAB_BAR_PATHS = new Set(['/dashboard', '/dashboard/orders', '/dashboard/products']);

interface NavHandlers {
  go: (path: string) => void;
  badgeCount: (badge?: NavBadge) => number;
}

function MenuRow({ item, handlers }: { item: NavItem; handlers: NavHandlers }) {
  const { t } = useTranslation();
  const Icon = item.icon;
  const hasChildren = !!item.children?.length;
  const [open, setOpen] = useState(false);
  const badge = handlers.badgeCount(item.badge);

  const onClick = () => {
    if (item.disabled) return;
    if (hasChildren) setOpen((o) => !o);
    else handlers.go(item.path);
  };

  return (
    <div>
      <button
        onClick={onClick}
        disabled={item.disabled}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-3 hover:bg-accent transition-colors',
          item.disabled && 'opacity-50 cursor-not-allowed hover:bg-transparent',
        )}
      >
        <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4" />
        </div>
        <span className="flex-1 text-left text-sm font-medium">{t(item.labelKey)}</span>
        {badge > 0 && (
          <span className="w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center mr-1">
            {badge > 9 ? '9+' : badge}
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
          {item.children!.map((child: NavChild) => {
            const ChildIcon = child.icon;
            const childBadge = handlers.badgeCount(child.badge);
            return (
              <button
                key={child.id}
                disabled={child.disabled}
                onClick={() => {
                  if (child.disabled) return;
                  handlers.go(child.path);
                }}
                className={cn(
                  'w-full flex items-center gap-3 pl-8 pr-4 py-2.5 hover:bg-accent transition-colors',
                  child.disabled && 'opacity-50 cursor-not-allowed hover:bg-transparent',
                )}
              >
                <div className="w-7 h-7 rounded-lg bg-card border flex items-center justify-center flex-shrink-0">
                  <ChildIcon className="w-3.5 h-3.5" />
                </div>
                <span className="flex-1 text-left text-sm">{t(child.labelKey)}</span>
                {childBadge > 0 && (
                  <span className="w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                    {childBadge > 9 ? '9+' : childBadge}
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

function MenuGroup({ items, handlers }: { items: NavItem[]; handlers: NavHandlers }) {
  if (!items.length) return null;
  return (
    <div className="bg-card rounded-xl mx-4 mb-3 overflow-hidden border divide-y">
      {items.map((item) => (
        <MenuRow key={item.id} item={item} handlers={handlers} />
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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { unreadCount } = useNotificationStore();
  const kycNeedsAttention = useKycNeedsAttention();

  const handlers: NavHandlers = {
    go: (path) => {
      navigate(path);
      onOpenChange(false);
    },
    badgeCount: (badge) => {
      if (badge === 'notifications') return unreadCount;
      if (badge === 'orders') return 3;
      // Not a count — 1 means "a rejected identity submission is waiting".
      if (badge === 'verification') return kycNeedsAttention ? 1 : 0;
      return 0;
    },
  };

  // Primary items not already in the bottom tab bar.
  const primaryItems = PRIMARY_NAV.filter((item) => !TAB_BAR_PATHS.has(item.path));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85dvh] p-0 rounded-t-2xl">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="px-4 py-4 border-b flex-shrink-0">
            <h2 className="text-xl font-bold">{t('nav.mobile.more')}</h2>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 pb-safe">
            {/* Vendor profile card */}
            <div className="mx-4 mt-4 mb-4 p-4 bg-card rounded-xl border flex items-center gap-3">
              <Avatar className="w-12 h-12 flex-shrink-0">
                {user?.avatar && <AvatarImage src={user.avatar} alt={user.name} className="object-cover" />}
                <AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">
                  {nameInitials(user?.name ?? '')}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{user?.name}</p>
                <p className="text-sm text-muted-foreground">
                  {user?.name ?? t('nav.sidebar.defaultStoreName')} · {t('nav.header.vendor')}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handlers.go('/dashboard/account/profile')}
                className="flex-shrink-0"
              >
                <Settings className="w-4 h-4" />
              </Button>
            </div>

            <MenuGroup items={primaryItems} handlers={handlers} />
            <MenuGroup items={FOOTER_NAV} handlers={handlers} />

            {/* Platform identity + health. Counterpart to the sidebar footer,
                which mobile never renders — this drawer is the only place the
                vendor sees who they are signed in to and whether it is up. */}
            <div className="flex items-center justify-center gap-2 px-4 py-6">
              <AppLogo className="w-5 h-5" />
              <span className="text-sm font-display font-bold tracking-tight leading-none">
                Wi-Mall
              </span>
              <span aria-hidden className="text-muted-foreground/50">·</span>
              <PlatformStatus />
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
