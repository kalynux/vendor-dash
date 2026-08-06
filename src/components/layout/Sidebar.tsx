import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUI } from '@/App';
import { useNotificationStore, useStoreStore } from '@/store';
import {
  ChevronLeft,
  ChevronRight,
  Store,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlatformStatus } from '@/components/layout/PlatformStatus';
import { PRIMARY_NAV, FOOTER_NAV, type NavItem, type NavChild, type NavBadge } from '@/config/navigation';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

/** Left accent bar marking the active row (solid) or a parent-of-active (faded). */
function ActiveBar({ show, faded }: { show: boolean; faded?: boolean }) {
  if (!show) return null;
  return (
    <span
      className={cn(
        'absolute left-0 top-1/2 h-6 w-1.5 -translate-y-1/2 rounded-r-full',
        faded ? 'bg-primary/40' : 'bg-primary',
      )}
    />
  );
}

// Wizard routes highlight their parent menu (e.g. product-edit → Products).
function normalizePath(pathname: string): string {
  if (pathname.startsWith('/dashboard/product-')) return '/dashboard/products';
  if (pathname.startsWith('/dashboard/service-')) return '/dashboard/services';
  return pathname;
}

function isPathActive(itemPath: string, pathname: string): boolean {
  if (itemPath === '/dashboard') return pathname === '/dashboard' || pathname === '/dashboard/';
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

// For a leaf child whose path equals the parent's (the index sub-tab), only mark
// it active on an exact match so siblings don't all light up.
function isLeafActive(child: NavChild, parent: NavItem, pathname: string): boolean {
  return child.path === parent.path
    ? pathname === child.path
    : isPathActive(child.path, pathname);
}

function hasActiveChild(item: NavItem, pathname: string): boolean {
  return item.children?.some((c) => isLeafActive(c, item, pathname)) ?? false;
}

const rowBase =
  'relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground';

// Footer nav geometry — keep in sync with the wrapper's `py-3` and the rows'
// `space-y-1`. Used to floor the drag at exactly the two main rows.
const FOOTER_PAD_Y = 24; // py-3 top + bottom
const ROW_GAP = 4; // space-y-1

// Grace period before a hovered flyout closes, so the pointer can cross the gap
// between the rail and the panel.
const FLYOUT_CLOSE_DELAY = 140;

/**
 * A row of the collapsed icon rail (the pinned layout on tablets).
 *
 * The rail hides labels and cannot expand a sub-menu inline, so both live in a
 * right-side flyout: a label chip for leaf rows, a labelled sub-menu panel for
 * parents. Hover opens it on pointer devices and tap opens it on touch — the
 * rail is the tablet default, where hover does not exist.
 */
function RailItem({
  item,
  badgeCount,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  badgeCount: number;
  pathname: string;
  onNavigate: (path: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);

  const cancelClose = () => {
    if (closeTimer.current != null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const openNow = () => {
    cancelClose();
    setOpen(true);
  };
  const closeSoon = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), FLYOUT_CLOSE_DELAY);
  };
  useEffect(() => cancelClose, []);

  const Icon = item.icon;
  const label = t(item.labelKey);
  const children = item.children ?? [];
  const hasChildren = children.length > 0;
  const parentActive = isPathActive(item.path, pathname);
  const childActive = hasActiveChild(item, pathname);
  const solid = parentActive && !childActive;

  const onClick = () => {
    if (item.disabled) return;
    // Parents open their sub-menu instead of navigating — same as the expanded
    // sidebar, and the only way to reach the children from the rail.
    if (hasChildren) {
      cancelClose();
      // Toggle against the state *before* this press: an already-open panel is
      // dismissed by Radix on pointer-down (the trigger sits outside it), so
      // reading `open` here would always see false and re-open it.
      setOpen(!wasOpenRef.current);
      return;
    }
    cancelClose();
    setOpen(false);
    onNavigate(item.path);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <button
          onClick={onClick}
          onPointerDown={() => {
            wasOpenRef.current = open;
          }}
          onPointerEnter={(e) => e.pointerType !== 'touch' && openNow()}
          onPointerLeave={(e) => e.pointerType !== 'touch' && closeSoon()}
          onFocus={openNow}
          onBlur={(e) => {
            // Keep it open while focus moves into the panel itself.
            if (!contentRef.current?.contains(e.relatedTarget as Node | null)) closeSoon();
          }}
          onKeyDown={(e) => {
            // Keyboard route into the sub-menu. Handling the key ourselves
            // suppresses the synthetic click, so this does not also toggle.
            if (!hasChildren || item.disabled) return;
            if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'ArrowRight') return;
            e.preventDefault();
            cancelClose();
            setOpen(true);
            requestAnimationFrame(() => contentRef.current?.focus());
          }}
          disabled={item.disabled}
          aria-label={label}
          aria-haspopup={hasChildren ? 'menu' : undefined}
          aria-expanded={hasChildren ? open : undefined}
          className={cn(
            rowBase,
            'justify-center',
            solid && 'bg-primary/10 text-primary font-semibold',
            childActive && !solid && 'bg-accent/60 text-accent-foreground',
            item.disabled && 'opacity-50 cursor-not-allowed hover:bg-transparent hover:text-foreground',
          )}
        >
          <ActiveBar show={parentActive || childActive} faded={childActive && !solid} />
          <div className="relative">
            <Icon className="w-5 h-5 flex-shrink-0" />
            {badgeCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                {badgeCount > 9 ? '9+' : badgeCount}
              </span>
            )}
          </div>
        </button>
      </PopoverAnchor>

      <PopoverContent
        ref={contentRef}
        side="right"
        align="start"
        sideOffset={8}
        collisionPadding={8}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onPointerEnter={cancelClose}
        onPointerLeave={closeSoon}
        className={cn('p-0 shadow-lg', hasChildren ? 'w-56' : 'w-auto')}
      >
        {hasChildren ? (
          <>
            <p className="px-3 pt-2.5 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <div className="space-y-1 p-1.5">
              {children.map((child) => {
                const ChildIcon = child.icon;
                const cActive = isLeafActive(child, item, pathname);
                return (
                  <button
                    key={child.id}
                    onClick={() => {
                      if (child.disabled) return;
                      cancelClose();
                      setOpen(false);
                      onNavigate(child.path);
                    }}
                    disabled={child.disabled}
                    className={cn(
                      rowBase,
                      'py-2',
                      cActive && 'bg-primary/10 text-primary font-semibold',
                      child.disabled &&
                      'opacity-50 cursor-not-allowed hover:bg-transparent hover:text-foreground',
                    )}
                  >
                    <ActiveBar show={cActive} />
                    <ChildIcon className="w-4 h-4 flex-shrink-0" />
                    <span className="whitespace-nowrap overflow-hidden">{t(child.labelKey)}</span>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <span className="block px-3 py-1.5 text-sm font-medium whitespace-nowrap">{label}</span>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, collapsible } = useUI();
  const { t } = useTranslation();
  const { unreadCount } = useNotificationStore();
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = normalizePath(location.pathname);
  const { store } = useStoreStore();

  const storeName = store?.name || t('nav.sidebar.defaultStoreName');
  const storeDescription = store?.description || null;
  const storeLogo = store?.logo?.url || null;

  // Per-item manual expand overrides; otherwise a group auto-opens when a child
  // is active. Works for any item with children.
  const [manualExpanded, setManualExpanded] = useState<Record<string, boolean>>({});

  // ─── Resizable footer nav ───────────────────────────────────────────────────
  // The footer group has a draggable top edge. `footerHeight` is the user-chosen
  // height (null = natural/auto). `contentHeight` tracks the group's full natural
  // height (grows/shrinks as sub-menus expand) so we can clamp and avoid gaps.
  const footerContentRef = useRef<HTMLElement>(null);
  const [footerHeight, setFooterHeight] = useState<number | null>(null);
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    const el = footerContentRef.current;
    if (!el) return;
    const update = () => setContentHeight(el.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Drag the top edge: up grows the footer (down to the natural full height),
  // down shrinks it (floor = the two main rows). Bounds are read fresh on each
  // grab so an expand/collapse in between is respected.
  const startFooterResize = (e: React.PointerEvent) => {
    if (sidebarCollapsed) return;
    e.preventDefault();
    const contentEl = footerContentRef.current;
    const naturalH = contentEl?.offsetHeight ?? 0;
    const rowH =
      (contentEl?.querySelector('button') as HTMLElement | null)?.offsetHeight ?? 40;
    const minH = FOOTER_PAD_Y + rowH * 2 + ROW_GAP;
    const startY = e.clientY;
    const startH = footerHeight ?? naturalH;

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'row-resize';

    const onMove = (ev: PointerEvent) => {
      const delta = startY - ev.clientY; // drag up → positive → taller
      setFooterHeight(Math.min(Math.max(startH + delta, minH), naturalH));
    };
    const onUp = () => {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // Never taller than the content needs (avoids empty space when sub-menus close)
  // and only applied in the expanded sidebar.
  const footerStyle =
    !sidebarCollapsed && footerHeight != null
      ? { height: Math.min(footerHeight, contentHeight || footerHeight) }
      : undefined;

  const getBadgeCount = (badge?: NavBadge) => {
    if (badge === 'notifications') return unreadCount;
    if (badge === 'orders') return 3;
    return 0;
  };

  const isExpanded = (item: NavItem) =>
    manualExpanded[item.id] ?? hasActiveChild(item, pathname);
  const toggleExpanded = (item: NavItem) =>
    setManualExpanded((m) => ({
      ...m,
      [item.id]: !(m[item.id] ?? hasActiveChild(item, pathname)),
    }));

  const selectChild = (child: NavChild) => {
    if (child.disabled) return;
    navigate(child.path);
  };

  const renderItem = (item: NavItem) => {
    const badgeCount = getBadgeCount(item.badge);

    // Collapsed rail — labels and sub-menus move into a right-side flyout.
    if (sidebarCollapsed) {
      return (
        <RailItem
          key={item.id}
          item={item}
          badgeCount={badgeCount}
          pathname={pathname}
          onNavigate={navigate}
        />
      );
    }

    const Icon = item.icon;
    const hasChildren = !!item.children?.length;
    const parentActive = isPathActive(item.path, pathname);
    const childActive = hasChildren && hasActiveChild(item, pathname);
    const open = hasChildren && isExpanded(item);

    const onClick = () => {
      if (item.disabled) return;
      if (hasChildren) toggleExpanded(item);
      else navigate(item.path);
    };

    // Solid highlight when the row itself is the current page; faded when only one
    // of its children is active (and the group is collapsed/closed).
    const solid = parentActive && !childActive;
    const showBar = parentActive || childActive;

    return (
      <div key={item.id} className="space-y-1">
        <button
          onClick={onClick}
          disabled={item.disabled}
          className={cn(
            rowBase,
            solid && 'bg-primary/10 text-primary font-semibold',
            childActive && !solid && 'bg-accent/60 text-accent-foreground',
            item.disabled && 'opacity-50 cursor-not-allowed hover:bg-transparent hover:text-foreground',
          )}
        >
          <ActiveBar show={showBar} faded={childActive && !solid} />
          <div className="relative">
            <Icon className="w-5 h-5 flex-shrink-0" />
            {badgeCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                {badgeCount > 9 ? '9+' : badgeCount}
              </span>
            )}
          </div>
          <span className="flex-1 text-left whitespace-nowrap overflow-hidden">
            {t(item.labelKey)}
          </span>
          {hasChildren && (
            <ChevronDown
              className={cn('w-4 h-4 transition-transform', open && 'rotate-180')}
            />
          )}
        </button>

        {open && (
          <div className="ml-5 border-l pl-2 space-y-1 animate-in slide-in-from-top-2 duration-200">
            {item.children!.map((child) => {
              const ChildIcon = child.icon;
              const cActive = isLeafActive(child, item, pathname);
              return (
                <button
                  key={child.id}
                  onClick={() => selectChild(child)}
                  disabled={child.disabled}
                  className={cn(
                    rowBase,
                    'py-2',
                    cActive && 'bg-primary/10 text-primary font-semibold',
                    child.disabled &&
                    'opacity-50 cursor-not-allowed hover:bg-transparent hover:text-foreground',
                  )}
                >
                  <ActiveBar show={cActive} />
                  <ChildIcon className="w-4 h-4 flex-shrink-0" />
                  <span className="whitespace-nowrap overflow-hidden">{t(child.labelKey)}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-card border-r',
        'flex flex-col transition-all duration-300 ease-in-out',
        sidebarCollapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* Top — store name + description */}
      <div className="h-16 flex items-center gap-2.5 px-4 border-b flex-shrink-0">
        <div className="w-9 h-9 rounded-xl overflow-hidden bg-gradient-to-br from-primary to-emerald-400 shadow-brand ring-1 ring-primary/20 flex items-center justify-center flex-shrink-0">
          {storeLogo ? (
            <img src={storeLogo} alt={storeName} crossOrigin="use-credentials" className="w-full h-full object-cover" />
          ) : (
            <Store className="w-5 h-5 text-white" />
          )}
        </div>
        {!sidebarCollapsed && (
          <div className="flex-1 min-w-0">
            <p className="font-display font-bold text-sm leading-tight tracking-tight truncate">{storeName}</p>
            {storeDescription && (
              <p className="text-xs text-muted-foreground leading-tight truncate">
                {storeDescription}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Primary navigation — scrolls between top and the pinned footer group */}
      <ScrollArea className="flex-1 min-h-0 py-4">
        <nav className="space-y-1 px-2">
          {PRIMARY_NAV.map(renderItem)}
        </nav>
      </ScrollArea>

      {/* Footer navigation — Account + Settings, resizable from the top edge and
          pinned just above Platform Status */}
      <div
        className={cn('relative border-t flex-shrink-0', footerStyle && 'overflow-hidden')}
        style={footerStyle}
      >
        {!sidebarCollapsed && (
          <div
            role="separator"
            aria-orientation="horizontal"
            onPointerDown={startFooterResize}
            title={t('nav.sidebar.dragToResize')}
            className="group absolute -top-1.5 left-0 right-0 z-10 flex h-3 cursor-row-resize items-center justify-center"
          >
            <span className="h-2 w-12 rounded-full bg-border transition-colors group-hover:bg-primary/50" />
          </div>
        )}
        <ScrollArea className={cn('h-full', footerStyle && 'overflow-y-auto')}>
          <nav ref={footerContentRef} className="space-y-1 px-2 py-4">
            {FOOTER_NAV.map(renderItem)}
          </nav>
        </ScrollArea>
      </div>

      {/* Footer — JoviMall platform + health, then the collapse toggle */}
      <div className="border-t flex-shrink-0">
        {sidebarCollapsed ? (
          <div className="flex justify-center py-3">
            <div className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-emerald-400 shadow-brand flex items-center justify-center">
              <Store className="w-4 h-4 text-white" />
              <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-card p-0.5">
                <PlatformStatus compact />
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-4 py-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-emerald-400 shadow-brand flex items-center justify-center flex-shrink-0">
              <Store className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-display font-bold tracking-tight leading-tight">wi-mall</p>
              <PlatformStatus />
            </div>
          </div>
        )}

        {collapsible && (
          <Button
            variant="ghost"
            onClick={toggleSidebar}
            className={cn(
              'w-full h-10 rounded-none border-t text-xs text-muted-foreground gap-2',
              sidebarCollapsed && 'px-0'
            )}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" />
                {t('nav.sidebar.collapse')}
              </>
            )}
          </Button>
        )}
      </div>
    </aside>
  );
}
