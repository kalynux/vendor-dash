import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Package, Menu, Plus, ChevronRight } from 'lucide-react';
import { useRouter } from '@/App';
import { useNotificationStore } from '@/store';
import { cn } from '@/lib/utils';
import { MobileMoreDrawer } from './MobileMoreDrawer';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { QUICK_ACTIONS, type QuickAction } from '@/config/quickActions';
import { useTranslation, type TranslationKey } from '@/i18n';
import { useKeyboardOpen } from '@/platform/shell/keyboard';

type LegacyRoute = 'overview' | 'orders' | 'products' | 'product-upload' | 'customers'
  | 'analytics' | 'notifications' | 'settings' | 'media' | 'tickets'
  | 'services' | 'login' | 'transactions';

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
        'relative flex flex-col items-center justify-center gap-0.5 flex-1 py-1 transition-colors',
        active ? 'text-primary' : 'text-muted-foreground',
      )}
    >
      {active && (
        <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" />
      )}
      <div className="relative">
        <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} />
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

export function MobileTabBar() {
  const { route, navigate } = useRouter();
  const { t } = useTranslation();
  const reactNavigate = useNavigate();
  const { unreadCount } = useNotificationStore();
  const [moreOpen, setMoreOpen] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  // Always false on the web, so the browser build is unchanged (P3.2).
  const keyboardOpen = useKeyboardOpen();

  const handleQuickAction = (action: QuickAction) => {
    reactNavigate(
      `/dashboard/${action.route}`,
      action.intent ? { state: { create: true } } : undefined,
    );
    setQuickActionsOpen(false);
  };

  const tabs: { labelKey: TranslationKey; icon: React.ElementType; route: LegacyRoute; badge?: number }[] = [
    { labelKey: 'nav.items.overview', icon: LayoutDashboard, route: 'overview' },
    { labelKey: 'nav.items.orders', icon: ShoppingCart, route: 'orders', badge: 3 },
  ];

  const rightTabs: { labelKey: TranslationKey; icon: React.ElementType; route: LegacyRoute }[] = [
    { labelKey: 'nav.items.products', icon: Package, route: 'products' },
  ];

  return (
    <>
      {/* Hidden while the on-screen keyboard is up. The bar is `fixed bottom-0`,
          so a resized WebView re-pins it directly on top of the keyboard — a row
          of navigation buttons wedged between the field being typed into and the
          keys. The two overlays below stay mounted either way: unmounting them
          with the bar would close an open sheet the moment a field inside it was
          focused (CAPACITOR-PLAN.md → P3.2). */}
      {!keyboardOpen && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t shadow-[0_-4px_12px_rgba(0,0,0,0.05)] pb-safe">
          <div className="flex items-center justify-around h-16 px-2">
            {tabs.map((tab) => (
              <TabButton
                key={tab.route}
                label={t(tab.labelKey)}
                icon={tab.icon}
                active={route === tab.route}
                badge={tab.badge}
                onClick={() => navigate(tab.route)}
              />
            ))}

            {/* FAB */}
            <button
              onClick={() => setQuickActionsOpen(true)}
              aria-label={t('nav.mobile.quickActions')}
              className="-mt-6 w-14 h-14 rounded-full bg-gradient-to-br from-primary to-emerald-400 text-primary-foreground shadow-brand ring-4 ring-background flex items-center justify-center flex-shrink-0 transition-transform active:scale-95"
            >
              <Plus className="w-6 h-6" strokeWidth={2.5} />
            </button>

            {rightTabs.map((tab) => (
              <TabButton
                key={tab.route}
                label={t(tab.labelKey)}
                icon={tab.icon}
                active={route === tab.route}
                onClick={() => navigate(tab.route)}
              />
            ))}

            <TabButton
              label={t('nav.items.more')}
              icon={Menu}
              active={moreOpen}
              badge={unreadCount > 0 ? unreadCount : undefined}
              onClick={() => setMoreOpen(true)}
            />
          </div>
        </nav>
      )}

      <MobileMoreDrawer open={moreOpen} onOpenChange={setMoreOpen} />

      {/* Quick Actions Sheet */}
      <Sheet open={quickActionsOpen} onOpenChange={setQuickActionsOpen}>
        <SheetContent side="bottom" className="p-0 rounded-t-2xl">
          <div className="px-4 pt-4 pb-2 border-b">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              {t('nav.quickActions.title')}
            </p>
          </div>
          <div className="py-2">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.id}
                onClick={() => handleQuickAction(action)}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-accent transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                  <action.icon className="w-5 h-5" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold">{t(action.labelKey)}</p>
                  <p className="text-xs text-muted-foreground">{t(action.descriptionKey)}</p>
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
