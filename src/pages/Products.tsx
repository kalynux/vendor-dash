import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Grid3X3,
  List,
  Plus,
  MoreHorizontal,
  Edit,
  Eye,
  Trash2,
  Share2,
  Package,
  Image as ImageIcon,
  FileDigit,
  Sparkles,
  RotateCw,
  Wand2,
  Loader2,
  CheckCircle2,
  XCircle,
  Send,
  Pencil,
  ArchiveRestore,
  TriangleAlert,
  Globe,
  EyeOff,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  ActiveFilterChips,
  FilterMultiChips,
  FilterSection,
  FilterSheet,
  SearchFilterBar,
} from '@/components/filters';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useProductStore } from '@/store';
import { useRouter } from '@/App';
import { useIsMobile } from '@/hooks/use-mobile';
import { useInfiniteList } from '@/hooks/use-infinite-list';
import { useScrollRestoration } from '@/hooks/use-scroll-restoration';
import { getListCache, setListCache } from '@/lib/listCache';
import { MobilePageHeader } from '@/components/layout/MobilePageHeader';
import { MobileListFooter } from '@/components/layout/MobileListFooter';
import { ConvertToAdvancedDialog } from '@/components/products/simple/ConvertToAdvancedDialog';
import { ShareProductDialog } from '@/components/products/ShareProductDialog';
import { useOpenPreview } from '@/components/preview';
import {
  fetchProducts as apiFetchProducts,
  setVectorisationEnabled,
  retryVectorisation,
  updateProductStatus,
  runActivationPreflight,
  getAllowedStatusTransitions,
  bulkArchiveProducts,
  bulkUpdateProductStatus,
  ACTIVATION_ERROR_KEYS,
  BulkPartialError,
  type StatusTransition,
  type StatusTransitionIntent,
} from '@/services/products.service';
import { ApiError } from '@/types/api';
import type {
  ProductListItem,
  ApiVectorisationStatus,
  BulkArchiveResult,
} from '@/types/product.types';
import { cn } from '@/lib/utils';
import { Trans, useApiError, useTranslation, type TranslationKey } from '@/i18n';

const STATUS_OPTIONS: { value: string; labelKey: TranslationKey }[] = [
  { value: 'active', labelKey: 'products.status.active' },
  { value: 'draft', labelKey: 'products.status.draft' },
  { value: 'archived', labelKey: 'products.status.archived' },
  { value: 'pending_review', labelKey: 'products.status.pendingReview' },
  { value: 'suspended', labelKey: 'products.status.suspended' },
];

const STATUS_TRANSITION_META: Record<
  StatusTransitionIntent,
  {
    Icon: React.ComponentType<{ className?: string }>;
    defaultConfirmKey: TranslationKey;
    confirmCtaKey: TranslationKey;
  }
> = {
  activate: {
    Icon: Send,
    defaultConfirmKey: 'products.transitions.confirm.activate',
    confirmCtaKey: 'products.transitions.cta.activate',
  },
  demote_to_draft: {
    Icon: Pencil,
    defaultConfirmKey: 'products.transitions.confirm.demote_to_draft',
    confirmCtaKey: 'products.transitions.cta.demote_to_draft',
  },
  restore: {
    Icon: ArchiveRestore,
    defaultConfirmKey: 'products.transitions.confirm.restore',
    confirmCtaKey: 'products.transitions.cta.restore',
  },
  archive: {
    Icon: Trash2,
    defaultConfirmKey: 'products.transitions.confirm.archive',
    confirmCtaKey: 'products.transitions.cta.archive',
  },
};

/** Maps a backend product status onto its catalog key. */
const STATUS_LABEL_KEYS: Record<string, TranslationKey> = {
  active: 'products.status.active',
  draft: 'products.status.draft',
  archived: 'products.status.archived',
  pending_review: 'products.status.pendingReview',
  suspended: 'products.status.suspended',
};

const TYPE_LABEL_KEYS: Record<string, TranslationKey> = {
  physical: 'products.type.physical',
  digital: 'products.type.digital',
  service: 'products.type.service',
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  draft: 'bg-muted text-muted-foreground',
  archived: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  pending_review: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  suspended: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE_CLASSES[status] ?? 'bg-muted text-muted-foreground'}`}
    >
      {STATUS_LABEL_KEYS[status] ? t(STATUS_LABEL_KEYS[status]) : status}
    </span>
  );
}

/** Product type, translated — a capitalized raw enum is English-only. */
function TypeLabel({ type }: { type: string }) {
  const { t } = useTranslation();
  return <>{TYPE_LABEL_KEYS[type] ? t(TYPE_LABEL_KEYS[type]) : type}</>;
}

const VECTORISATION_META: Record<
  ApiVectorisationStatus,
  { labelKey: TranslationKey; className: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  not_started: {
    labelKey: 'products.ai.notIndexed',
    className: 'bg-muted text-muted-foreground',
    Icon: Sparkles,
  },
  pending: {
    labelKey: 'products.ai.indexing',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    Icon: Loader2,
  },
  completed: {
    labelKey: 'products.ai.ready',
    className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    Icon: CheckCircle2,
  },
  failed: {
    labelKey: 'products.ai.failed',
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    Icon: XCircle,
  },
};

function VectorisationBadge({
  enabled,
  status,
}: {
  enabled: boolean;
  status: ApiVectorisationStatus;
}) {
  const { t } = useTranslation();
  if (!enabled) return null;
  const meta = VECTORISATION_META[status];
  const { Icon } = meta;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${meta.className}`}
    >
      <Icon className={`w-3 h-3 ${status === 'pending' ? 'animate-spin' : ''}`} />
      {t(meta.labelKey)}
    </span>
  );
}

// Persist the desktop view-mode toggle across tab switches (mirrors the Media
// Library's listCache usage) — otherwise returning to this page always resets
// to grid since viewMode is local component state.
const PRODUCTS_VIEW_KEY = 'products-view-mode';

export function Products() {
  const { t } = useTranslation();
  const apiError = useApiError();
  const {
    products,
    selectedProducts,
    isLoading,
    pagination,
    fetchProducts,
    toggleProductSelection,
    selectAllProducts,
    clearSelection,
    deleteProduct,
  } = useProductStore();
  const { navigate: legacyNavigate } = useRouter();
  const navigate = useNavigate();
  const openPreview = useOpenPreview();
  const isMobile = useIsMobile();

  // Desktop: has the first fetch settled yet? Seeded true when the store already
  // has products (cached), so returning to the tab shows them with no skeleton.
  // Gating the skeleton on this stops the empty state from flashing for one
  // frame before loading starts.
  const [didInitialLoad, setDidInitialLoad] = useState(() => products.length > 0);

  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewModeState] = useState<'grid' | 'list'>(
    () => getListCache<'grid' | 'list'>(PRODUCTS_VIEW_KEY) ?? 'grid',
  );
  const setViewMode = useCallback((mode: 'grid' | 'list') => {
    setViewModeState(mode);
    setListCache(PRODUCTS_VIEW_KEY, mode);
  }, []);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [actionsSheetProduct, setActionsSheetProduct] = useState<ProductListItem | null>(null);
  const [productToDelete, setProductToDelete] = useState<ProductListItem | null>(null);
  const [productToConvert, setProductToConvert] = useState<ProductListItem | null>(null);
  // Just the id — the dialog fetches the detail it needs, since a list row does
  // not carry the slug, description or price a chat message is built from.
  const [productToShare, setProductToShare] = useState<string | null>(null);
  const [transitionState, setTransitionState] = useState<{
    product: ProductListItem;
    transition: StatusTransition;
    /** Catalog keys, resolved in the dialog — see runActivationPreflight. */
    preflightErrors?: TranslationKey[];
    loading?: boolean;
  } | null>(null);

  // Debounced server-side search
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  // Last search term the debounce effect has acted on. Comparing the *value*
  // (rather than flipping a boolean on first run) keeps the "skip initial load"
  // guard idempotent under StrictMode's double-invoked effects — a boolean flag
  // gets flipped true by the first setup and then treats StrictMode's second
  // setup as a real change, scheduling a spurious refetch. `null` = never run.
  const lastHandledSearch = useRef<string | null>(null);
  // Guards the mount fetch against StrictMode's double setup so we don't fire
  // two identical initial requests.
  const didInitialFetch = useRef(false);

  useScrollRestoration('products');

  // Desktop uses the store + page-number pagination; mobile uses infinite scroll.
  // Returning to the tab (or back from product-edit) shows the rows already in
  // the store at once, then refreshes them quietly — an edit, a new product or a
  // status change made elsewhere must show up without a manual reload.
  useEffect(() => {
    if (isMobile) return;
    // StrictMode invokes this effect twice on mount; the ref makes the fetch
    // fire only once (still re-runs the initial load if the viewport later
    // crosses into desktop, since the ref is only set here).
    if (didInitialFetch.current) {
      setDidInitialLoad(true);
      return;
    }
    didInitialFetch.current = true;
    if (products.length === 0) {
      fetchProducts().finally(() => setDidInitialLoad(true));
    } else {
      setDidInitialLoad(true);
      // Same page the vendor left; the search box starts empty, so no `q`.
      fetchProducts({ page: pagination?.page }, { silent: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile]);

  useEffect(() => {
    const q = searchQuery.trim();
    // First run: record the baseline query and don't fetch — the mount effect
    // handles the initial load. (StrictMode re-invokes this with the same value,
    // which the equality check below then no-ops.)
    if (lastHandledSearch.current === null) {
      lastHandledSearch.current = q;
      return;
    }
    // No real change — e.g. StrictMode's second setup, or isMobile toggling
    // without the query changing. Skip so we don't schedule a spurious refetch.
    if (lastHandledSearch.current === q) return;
    lastHandledSearch.current = q;

    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(q);
      if (!isMobile) fetchProducts({ q: q || undefined });
    }, 400);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, isMobile]);

  // Mobile infinite scroll
  const fetchProductsPage = useCallback(
    (page: number, limit: number) =>
      apiFetchProducts({ page, limit, q: debouncedSearch || undefined }).then((r) => ({
        items: r.data,
        total: r.meta.total,
        totalPages: r.meta.totalPages,
      })),
    [debouncedSearch],
  );

  const infinite = useInfiniteList<ProductListItem>({
    fetchPage: fetchProductsPage,
    rowHeight: 84,
    enabled: isMobile,
    deps: [debouncedSearch],
    cacheKey: 'products',
    revalidateOnRestore: true,
  });

  const reloadList = useCallback(() => {
    if (isMobile) infinite.reload();
    else fetchProducts();
  }, [isMobile, infinite, fetchProducts]);

  const handleEdit = useCallback(
    (product: ProductListItem) => {
      if (product.vectorisationStatus === 'pending') {
        toast.error(t('products.ai.indexingToast'));
        return;
      }
      // All four Edit entry points funnel through here, so the branch lands
      // everywhere at once. `mode` defaults to 'advanced' in adaptToListItem.
      navigate(
        product.mode === 'simple'
          ? `/dashboard/product-edit/${product.id}/simple`
          : `/dashboard/product-edit/${product.id}`,
      );
    },
    [navigate, t],
  );

  const confirmDelete = useCallback(async () => {
    if (!productToDelete) return;
    const id = productToDelete.id;
    setProductToDelete(null);
    await deleteProduct(id);
    if (isMobile) infinite.reload();
  }, [productToDelete, deleteProduct, isMobile, infinite]);

  // Bulk archive through the backend bulk endpoint — it archives draft/active
  // products and skips the rest (suspended/pending_review/archived), reporting
  // counts instead of failing per-item 422s.
  /**
   * Which bulk action is in flight, so the whole bar disables together rather
   * than letting a second action race the first over the same selection.
   */
  const [bulkBusy, setBulkBusy] = useState<'archive' | 'active' | 'draft' | null>(null);
  const isBulkArchiving = bulkBusy === 'archive';

  /**
   * Report a bulk outcome.
   *
   * `failed` is the count; `errors[]` is "details where available" and is NOT the
   * same length. Only the `active` path explains every failure — which is also
   * the path where the explanation matters most, because "why won't these
   * publish" is answered by the activation gate and nothing else surfaces it. The
   * first few reasons go in the toast; the rest stay in the count.
   */
  const reportBulk = useCallback(
    (result: BulkArchiveResult, doneKey: TranslationKey) => {
      if (result.failed === 0) {
        toast.success(t(doneKey, { count: result.success }));
        return;
      }
      const detail = result.errors.slice(0, 3).map((e) => e.reason).join(' · ');
      toast.warning(
        t('products.bulk.partial', {
          success: result.success,
          total: result.total,
          failed: result.failed,
        }),
        detail ? { description: detail } : undefined,
      );
    },
    [t],
  );

  /**
   * A bulk run that stopped partway. `bulk/status` with `draft` is quota-gated and
   * refuses the WHOLE request with 403, so on a selection past one 50-id chunk the
   * earlier chunks have already applied. Saying "that failed" would send the vendor
   * looking for changes that did happen.
   */
  const reportBulkFailure = useCallback(
    (err: unknown, fallbackKey: TranslationKey) => {
      const partial = err instanceof BulkPartialError ? err : null;
      const message = apiError.resolve(partial ? partial.cause : err, { fallbackKey });
      if (partial && partial.totals.success > 0) {
        toast.warning(
          t('products.bulk.stoppedPartway', { success: partial.totals.success }),
          { description: message },
        );
        return;
      }
      toast.error(message);
    },
    [apiError, t],
  );

  const handleBulkArchive = useCallback(async () => {
    if (bulkBusy || selectedProducts.length === 0) return;
    if (!confirm(t('products.bulk.confirm', { count: selectedProducts.length }))) return;
    setBulkBusy('archive');
    try {
      reportBulk(await bulkArchiveProducts(selectedProducts), 'products.bulk.done');
      clearSelection();
      reloadList();
    } catch (err: unknown) {
      reportBulkFailure(err, 'products.errors.bulkArchiveFailed');
    } finally {
      setBulkBusy(null);
    }
  }, [bulkBusy, selectedProducts, clearSelection, reloadList, reportBulk, reportBulkFailure, t]);

  /**
   * Bulk publish / unpublish through POST /vendor/products/bulk/status.
   *
   * Publishing runs the full activation gate per product, so a partial result is
   * the normal outcome on a mixed selection rather than an error — a draft
   * missing a price or an agency simply stays a draft and says why.
   */
  const handleBulkStatus = useCallback(
    async (status: 'active' | 'draft') => {
      if (bulkBusy || selectedProducts.length === 0) return;
      setBulkBusy(status);
      try {
        reportBulk(
          await bulkUpdateProductStatus(selectedProducts, status),
          status === 'active' ? 'products.bulk.published' : 'products.bulk.unpublished',
        );
        clearSelection();
        reloadList();
      } catch (err: unknown) {
        reportBulkFailure(err, 'products.errors.bulkStatusFailed');
      } finally {
        setBulkBusy(null);
      }
    },
    [bulkBusy, selectedProducts, clearSelection, reloadList, reportBulk, reportBulkFailure],
  );

  const requestStatusTransition = useCallback(
    async (product: ProductListItem, transition: StatusTransition) => {
      if (transition.intent === 'archive') {
        setProductToDelete(product);
        return;
      }
      if (transition.needsPreflight) {
        setTransitionState({ product, transition, loading: true });
        try {
          const errors = await runActivationPreflight(product.id);
          if (errors.length > 0) {
            setTransitionState({ product, transition, preflightErrors: errors });
            return;
          }
          setTransitionState({ product, transition });
        } catch (err: unknown) {
          toast.error(apiError.resolve(err, { fallbackKey: 'products.errors.validateFailed' }));
          setTransitionState(null);
        }
        return;
      }
      setTransitionState({ product, transition });
    },
    [apiError],
  );

  const confirmStatusTransition = useCallback(async () => {
    if (!transitionState || transitionState.preflightErrors) return;
    const { product, transition } = transitionState;
    setTransitionState({ ...transitionState, loading: true });
    try {
      await updateProductStatus(product.id, transition.target);
      toast.success(
        t('products.toast.statusChanged', {
          name: product.title,
          status: t(STATUS_LABEL_KEYS[transition.target] ?? 'products.status.draft'),
        }),
      );
      setTransitionState(null);
      reloadList();
    } catch (err: unknown) {
      const activationKey =
        err instanceof ApiError ? ACTIVATION_ERROR_KEYS[err.code] : undefined;
      toast.error(
        activationKey
          ? t(activationKey)
          : apiError.resolve(err, { fallbackKey: 'products.errors.statusChangeFailed' }),
      );
      setTransitionState(null);
    }
  }, [transitionState, reloadList, t, apiError]);

  const handleVectorisationAction = useCallback(
    async (id: string, action: 'enable' | 'disable' | 'retry') => {
      try {
        if (action === 'enable') {
          await setVectorisationEnabled(id, true);
          toast.success(t('products.ai.enabled'));
        } else if (action === 'disable') {
          await setVectorisationEnabled(id, false);
          toast.success(t('products.ai.disabled'));
        } else {
          await retryVectorisation(id);
          toast.success(t('products.ai.retryQueued'));
        }
        reloadList();
      } catch (err: unknown) {
        toast.error(apiError.resolve(err, { fallbackKey: 'products.ai.updateFailed' }));
      }
    },
    [reloadList, t, apiError],
  );

  const toggleStatusFilter = useCallback((status: string) => {
    setStatusFilter((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status],
    );
  }, []);

  // Service products live in their own Services tab — exclude them here so they
  // don't appear under Products. (Minor: server pagination counts still include
  // services; acceptable as services are few.)
  const nonServiceProducts = products.filter((p) => (p.type as string) !== 'service');

  // Client-side status filter (server search already filters by text)
  const filteredProducts = statusFilter.length === 0
    ? nonServiceProducts
    : nonServiceProducts.filter((p) => statusFilter.includes(p.status));

  // Mobile infinite list — same service exclusion, same status filter.
  const mobileItems = infinite.items.filter(
    (p) =>
      (p.type as string) !== 'service' &&
      (statusFilter.length === 0 || statusFilter.includes(p.status)),
  );

  // ── Filter sheet plumbing (shared by desktop + mobile) ──────────────────────
  const activeFilterCount = statusFilter.length;

  const productFilterSheet = (
    <FilterSheet
      open={filterSheetOpen}
      onOpenChange={setFilterSheetOpen}
      title={t('products.search.filterTitle')}
      activeCount={activeFilterCount}
      onClear={() => setStatusFilter([])}
      applyLabel={t('products.search.applyLabel')}
    >
      <FilterSection title={t('products.columns.status')}>
        <FilterMultiChips
          options={STATUS_OPTIONS}
          values={statusFilter}
          onToggle={toggleStatusFilter}
        />
      </FilterSection>
    </FilterSheet>
  );

  const productFilterChips = (
    <ActiveFilterChips
      chips={statusFilter.map((value) => {
        const labelKey = STATUS_OPTIONS.find((o) => o.value === value)?.labelKey;
        return {
          key: value,
          label: labelKey ? t(labelKey) : value,
          onRemove: () => toggleStatusFilter(value),
        };
      })}
      onClearAll={() => setStatusFilter([])}
    />
  );

  const allSelected =
    filteredProducts.length > 0 && selectedProducts.length === filteredProducts.length;

  // First-load skeleton gate (desktop). `isLoading` covers later fetches
  // (search, pagination, status changes); `!didInitialLoad` covers the initial
  // frame before the mount fetch flips loading on.
  const showListSkeleton = isLoading || !didInitialLoad;

  // ─── Mobile ─────────────────────────────────────────────────────────────────

  const transitionDialog = (() => {
    if (!transitionState) return null;
    const { product, transition, preflightErrors, loading } = transitionState;
    const meta = STATUS_TRANSITION_META[transition.intent];
    const isErrorState = !!preflightErrors && preflightErrors.length > 0;
    return (
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open && !loading) setTransitionState(null);
        }}
      >
        <DialogContent>
          <DialogHeader className="text-left">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                  isErrorState
                    ? 'bg-orange-100 text-orange-600'
                    : transition.destructive
                      ? 'bg-red-100 text-red-600'
                      : 'bg-primary/10 text-primary',
                )}
              >
                {isErrorState ? (
                  <TriangleAlert className="w-5 h-5" />
                ) : (
                  <meta.Icon className="w-5 h-5" />
                )}
              </div>
              <DialogTitle>
                {isErrorState
                  ? t('products.activation.cannotPublishTitle')
                  : t('products.transitions.confirmTitle', { action: t(transition.labelKey) })}
              </DialogTitle>
            </div>
            <DialogDescription className="pt-3 text-left">
              {isErrorState ? (
                <Trans
                  i18nKey="products.activation.cannotPublishDescription"
                  params={{ name: product.title }}
                  components={[<span className="font-semibold text-foreground" />]}
                />
              ) : (
                <>
                  <span className="font-semibold text-foreground">
                    {product.title}
                  </span>
                  {' — '}
                  {t(transition.confirmKey ?? meta.defaultConfirmKey)}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {isErrorState && (
            <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
              {preflightErrors!.map((key, i) => (
                <li key={i}>{t(key)}</li>
              ))}
            </ul>
          )}
          <DialogFooter>
            {isErrorState ? (
              <DialogClose asChild onClick={() => setTransitionState(null)}>
                <Button variant="outline">{t('common.actions.gotIt')}</Button>
              </DialogClose>
            ) : (
              <>
                <DialogClose asChild disabled={loading}>
                  <Button variant="outline">{t('common.actions.cancel')}</Button>
                </DialogClose>
                <Button
                  disabled={loading}
                  onClick={(e) => {
                    e.preventDefault();
                    confirmStatusTransition();
                  }}
                  variant={transition.destructive ? "destructive" : "default"}
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    t(meta.confirmCtaKey)
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  })();

  const shareDialog = (
    <ShareProductDialog
      productId={productToShare}
      onOpenChange={(open) => {
        if (!open) setProductToShare(null);
      }}
    />
  );

  const convertDialog = (
    <ConvertToAdvancedDialog
      open={!!productToConvert}
      productId={productToConvert?.id ?? null}
      productTitle={productToConvert?.title}
      onOpenChange={(open) => {
        if (!open) setProductToConvert(null);
      }}
      onConverted={() => {
        setProductToConvert(null);
        reloadList();
      }}
    />
  );

  const archiveDialog = (
    <Dialog
      open={!!productToDelete}
      onOpenChange={(open) => {
        if (!open) setProductToDelete(null);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-left">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 flex-shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <DialogTitle>{t('products.archiveDialog.title')}</DialogTitle>
          </div>
          <DialogDescription className="pt-3 text-left">
            <Trans
              i18nKey="products.archiveDialog.description"
              params={{ name: productToDelete?.title ?? '' }}
              components={[<span className="font-semibold text-foreground" />]}
            />
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex sm:justify-end gap-2 pt-2">
          <DialogClose asChild>
            <Button variant="outline">{t('products.archiveDialog.keep')}</Button>
          </DialogClose>
          <Button variant="destructive" onClick={confirmDelete}>
            {t('products.archiveDialog.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (isMobile) {
    return (
      <div className="-mx-6 -mt-6">
        <MobilePageHeader
          title={t('products.title')}
          description={t('products.subtitle')}
          actions={[
            {
              id: 'add',
              icon: Plus,
              label: t('products.actions.addProduct'),
              onClick: () => legacyNavigate('product-upload'),
            },
          ]}
          subheader={
            <div className="space-y-3">
              <SearchFilterBar
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder={t('products.search.placeholder')}
                activeFilterCount={activeFilterCount}
                onOpenFilters={() => setFilterSheetOpen(true)}
                filterLabel={t('products.search.filterTitle')}
              />
              {productFilterChips}
            </div>
          }
        />

        <div className="pb-28">
          {infinite.loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 border-b">
                <div className="w-16 h-16 rounded-xl bg-muted animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-muted animate-pulse rounded w-3/4" />
                  <div className="h-3 bg-muted animate-pulse rounded w-1/3" />
                  <div className="h-3 bg-muted animate-pulse rounded w-1/2" />
                </div>
              </div>
            ))
          ) : infinite.error ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <TriangleAlert className="w-10 h-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{infinite.error}</p>
              <Button variant="outline" size="sm" onClick={infinite.reload}>{t('common.actions.retry')}</Button>
            </div>
          ) : mobileItems.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <Package className="w-12 h-12 text-muted-foreground" />
              <p className="text-muted-foreground">{t('products.empty.title')}</p>
            </div>
          ) : (
            <>
              {mobileItems.map((product) => {
                const editLocked = product.vectorisationStatus === 'pending';
                const openEdit = () => {
                  if (editLocked) {
                    toast.error(t('products.ai.editLockedToast'));
                    return;
                  }
                  handleEdit(product);
                };
                return (
                  <div
                    key={product.id}
                    role="button"
                    tabIndex={0}
                    onClick={openEdit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openEdit();
                      }
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 border-b hover:bg-muted/30 transition-colors text-left cursor-pointer"
                  >
                    <ProductThumbnail product={product} size="lg" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{product.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5"><TypeLabel type={product.type} /></p>
                      <p className="text-xs text-muted-foreground mt-0.5">{product.category}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <div className="flex flex-col items-end gap-1">
                        <StatusBadge status={product.status} />
                        <VectorisationBadge
                          enabled={product.vectorisationEnabled}
                          status={product.vectorisationStatus}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActionsSheetProduct(product);
                        }}
                        className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full hover:bg-accent transition-colors -mr-1 tap-target"
                        aria-label={t('products.actions.productActions')}
                      >
                        <MoreHorizontal className="w-5 h-5 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                );
              })}
              <div ref={infinite.sentinelRef} className="h-1" />
              {infinite.loadingMore && (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
            </>
          )}
        </div>

        <MobileListFooter shown={mobileItems.length} total={infinite.total} nounKey="common.units.products" />

        {productFilterSheet}

        {/* Mobile actions bottom sheet */}
        <Sheet
          open={!!actionsSheetProduct}
          onOpenChange={(open) => {
            if (!open) setActionsSheetProduct(null);
          }}
        >
          <SheetContent side="bottom" className="p-0 pb-[env(safe-area-inset-bottom)]">
            {actionsSheetProduct && (() => {
              const p = actionsSheetProduct;
              const close = () => setActionsSheetProduct(null);
              const editLocked = p.vectorisationStatus === 'pending';
              const showEnable = !p.vectorisationEnabled;
              const showDisable =
                p.vectorisationEnabled && p.vectorisationStatus !== 'pending';
              const showRetry =
                p.vectorisationEnabled && p.vectorisationStatus === 'failed';

              const transitions = getAllowedStatusTransitions(p.status);
              const nonArchiveTransitions = transitions.filter(
                (t) => t.intent !== 'archive',
              );
              const archiveTransition = transitions.find((t) => t.intent === 'archive');

              return (
                <>
                  <SheetHeader className="border-b">
                    <SheetTitle className="truncate pr-8 text-base">{p.title}</SheetTitle>
                  </SheetHeader>
                  <div className="flex flex-col py-2 pb-6">
                    <SheetActionButton
                      icon={<Edit className="w-5 h-5" />}
                      label={editLocked ? t('products.ai.editLocked') : t('common.actions.edit')}
                      disabled={editLocked}
                      onClick={() => { close(); handleEdit(p); }}
                    />
                    <SheetActionButton
                      icon={<Eye className="w-5 h-5" />}
                      label={t('products.preview.action')}
                      onClick={() => { close(); openPreview(`/preview/product/${p.id}`); }}
                    />
                    <SheetActionButton
                      icon={<Share2 className="w-5 h-5" />}
                      label={t('products.share.action')}
                      onClick={() => { close(); setProductToShare(p.id); }}
                    />
                    {p.mode === 'simple' && (
                      <SheetActionButton
                        icon={<Wand2 className="w-5 h-5" />}
                        label={t('products.actions.convertToAdvanced')}
                        onClick={() => { close(); setProductToConvert(p); }}
                      />
                    )}
                    {nonArchiveTransitions.map((transition) => {
                      const meta = STATUS_TRANSITION_META[transition.intent];
                      const Icon = meta.Icon;
                      return (
                        <SheetActionButton
                          key={transition.intent}
                          icon={<Icon className="w-5 h-5" />}
                          label={t(transition.labelKey)}
                          onClick={() => {
                            close();
                            requestStatusTransition(p, transition);
                          }}
                        />
                      );
                    })}
                    {showEnable && (
                      <SheetActionButton
                        icon={<Sparkles className="w-5 h-5" />}
                        label={t('products.ai.enable')}
                        onClick={() => { close(); handleVectorisationAction(p.id, 'enable'); }}
                      />
                    )}
                    {showRetry && (
                      <SheetActionButton
                        icon={<RotateCw className="w-5 h-5" />}
                        label={t('products.ai.retry')}
                        onClick={() => { close(); handleVectorisationAction(p.id, 'retry'); }}
                      />
                    )}
                    {showDisable && (
                      <SheetActionButton
                        icon={<XCircle className="w-5 h-5" />}
                        label={t('products.ai.disable')}
                        onClick={() => { close(); handleVectorisationAction(p.id, 'disable'); }}
                      />
                    )}
                    {archiveTransition && (
                      <SheetActionButton
                        icon={<Trash2 className="w-5 h-5" />}
                        label={t(archiveTransition.labelKey)}
                        destructive
                        onClick={() => {
                          close();
                          requestStatusTransition(p, archiveTransition);
                        }}
                      />
                    )}
                  </div>
                </>
              );
            })()}
          </SheetContent>
        </Sheet>

        {archiveDialog}
        {transitionDialog}
        {convertDialog}
        {shareDialog}
      </div>
    );
  }

  // ─── Desktop ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('products.title')}</h1>
          <p className="text-muted-foreground">{t('products.subtitle')}</p>
        </div>
        <Button onClick={() => legacyNavigate('product-upload')} className="gap-2">
          <Plus className="w-4 h-4" />
          {t('products.actions.addProduct')}
        </Button>
      </div>

      {/* Search + Filters */}
      <div className="space-y-3">
        <SearchFilterBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t('products.search.placeholder')}
          activeFilterCount={activeFilterCount}
          onOpenFilters={() => setFilterSheetOpen(true)}
          filterLabel={t('products.search.filterTitle')}
          trailing={
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'grid' | 'list')}>
              <TabsList className="h-11 rounded-xl">
                <TabsTrigger value="grid" aria-label={t('products.actions.gridView')}>
                  <Grid3X3 className="w-4 h-4" />
                </TabsTrigger>
                <TabsTrigger value="list" aria-label={t('products.actions.listView')}>
                  <List className="w-4 h-4" />
                </TabsTrigger>
              </TabsList>
            </Tabs>
          }
        />
        {productFilterChips}
      </div>

      {productFilterSheet}

      {/* Bulk action bar */}
      {selectedProducts.length > 0 && (
        <div className="flex items-center gap-2 p-4 bg-muted/50 rounded-lg">
          <span className="text-sm text-muted-foreground">
            {t('common.pagination.selected', { count: selectedProducts.length })}
          </span>
          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={bulkBusy !== null}
            onClick={() => void handleBulkStatus('active')}
          >
            {bulkBusy === 'active' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Globe className="w-4 h-4" />
            )}
            {t('products.actions.publishSelected')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={bulkBusy !== null}
            onClick={() => void handleBulkStatus('draft')}
          >
            {bulkBusy === 'draft' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <EyeOff className="w-4 h-4" />
            )}
            {t('products.actions.unpublishSelected')}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="gap-2"
            disabled={bulkBusy !== null}
            onClick={handleBulkArchive}
          >
            {isBulkArchiving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            {t('products.actions.archiveSelected')}
          </Button>
        </div>
      )}

      {/* Grid view */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {showListSkeleton
            ? Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="aspect-square" />
                <CardContent className="p-4 space-y-3">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-6 w-1/3" />
                </CardContent>
              </Card>
            ))
            : filteredProducts.length === 0
              ? (
                <div className="col-span-full py-12 text-center">
                  <Package className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">{t('products.empty.title')}</p>
                  <Button
                    variant="outline"
                    onClick={() => { setSearchQuery(''); setStatusFilter([]); }}
                  >
                    {t('products.actions.clearFilters')}
                  </Button>
                </div>
              )
              : filteredProducts.map((product) => (
                <ProductGridCard
                  key={product.id}
                  product={product}
                  selected={selectedProducts.includes(product.id)}
                  onToggleSelect={() => toggleProductSelection(product.id)}
                  onEdit={() => handleEdit(product)}
                  onVectorisationAction={(action) =>
                    handleVectorisationAction(product.id, action)
                  }
                  onStatusTransition={(transition) =>
                    requestStatusTransition(product, transition)
                  }
                  onConvertToAdvanced={() => setProductToConvert(product)}
                  onPreview={() => openPreview(`/preview/product/${product.id}`)}
                  onShare={() => setProductToShare(product.id)}
                />
              ))}
        </div>
      ) : (
        /* List view */
        <Card>
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="w-12 p-4">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={(checked) => {
                        selectAllProducts(checked ? filteredProducts.map((p) => p.id) : []);
                      }}
                    />
                  </th>
                  <th className="text-left p-4 text-sm font-medium">{t('products.columns.product')}</th>
                  <th className="text-left p-4 text-sm font-medium">{t('products.columns.status')}</th>
                  <th className="text-left p-4 text-sm font-medium">{t('products.columns.type')}</th>
                  {/* <th className="text-left p-4 text-sm font-medium">Variants</th> */}
                  <th className="w-12 p-4" />
                </tr>
              </thead>
              <tbody>
                {showListSkeleton
                  ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      <td colSpan={6} className="p-4">
                        <div className="h-12 bg-muted animate-pulse rounded" />
                      </td>
                    </tr>
                  ))
                  : filteredProducts.length === 0
                    ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center">
                          <Package className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                          <p className="text-muted-foreground">{t('products.empty.title')}</p>
                        </td>
                      </tr>
                    )
                    : filteredProducts.map((product) => (
                      <tr
                        key={product.id}
                        onClick={() => handleEdit(product)}
                        className="border-b hover:bg-muted/50 transition-colors"
                      >
                        <td className="p-4" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedProducts.includes(product.id)}
                            onCheckedChange={() => toggleProductSelection(product.id)}
                          />
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <ProductThumbnail product={product} size="md" />
                            <div>
                              <p className="font-medium">{product.title}</p>
                              <p className="text-xs text-muted-foreground">{product.category}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col gap-1 items-start">
                            <StatusBadge status={product.status} />
                            <VectorisationBadge
                              enabled={product.vectorisationEnabled}
                              status={product.vectorisationStatus}
                            />
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="text-sm"><TypeLabel type={product.type} /></span>
                        </td>
                        {/* <td className="p-4">
                        {product.hasVariants ? (
                          <Badge variant="outline" className="text-xs">
                            Has variants
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td> */}
                        <td className="p-4">
                          <ProductActionsMenu
                            product={product}
                            onEdit={() => handleEdit(product)}
                            onVectorisationAction={(action) =>
                              handleVectorisationAction(product.id, action)
                            }
                            onStatusTransition={(transition) =>
                              requestStatusTransition(product, transition)
                            }
                            onConvertToAdvanced={() => setProductToConvert(product)}
                            onPreview={() => openPreview(`/preview/product/${product.id}`)}
                            onShare={() => setProductToShare(product.id)}
                          />
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {archiveDialog}
      {transitionDialog}
      {convertDialog}
        {shareDialog}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{t('common.units.products', { count: pagination.total })}</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => fetchProducts({ page: pagination.page - 1 })}
            >
              {t('common.pagination.previous')}
            </Button>
            <span>
              {t('common.pagination.pageOf', {
                page: pagination.page,
                total: pagination.totalPages,
              })}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => fetchProducts({ page: pagination.page + 1 })}
            >
              {t('common.pagination.next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProductThumbnail({ product, size }: { product: ProductListItem; size: 'md' | 'lg' }) {
  const { t } = useTranslation();
  const dim = size === 'lg' ? 'w-16 h-16 rounded-xl' : 'w-12 h-12 rounded';
  // `firstFileAccess` is why the URL is missing. Without it a photo the vendor's
  // storage plan is hiding looks exactly like a product that has no photo.
  const blocked = product.firstFileAccess === 'quota_blocked';
  return (
    <div className={`${dim} bg-muted flex-shrink-0 flex items-center justify-center overflow-hidden`}>
      {product.firstFileUrl ? (
        <img
          src={product.firstFileUrl}
          alt={product.title}
          className="w-full h-full object-cover"
        />
      ) : blocked ? (
        <span className="text-amber-600" title={t('media.blocked.thumbnailHint')}>
          <Lock className="w-5 h-5" />
        </span>
      ) : product.type === 'digital' ? (
        <FileDigit className="w-5 h-5 text-muted-foreground" />
      ) : (
        <Package className="w-5 h-5 text-muted-foreground" />
      )}
    </div>
  );
}

interface ProductGridCardProps {
  product: ProductListItem;
  selected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  onPreview: () => void;
  onVectorisationAction: (action: 'enable' | 'disable' | 'retry') => void;
  onStatusTransition: (transition: StatusTransition) => void;
  onConvertToAdvanced: () => void;
  onShare: () => void;
}

function ProductGridCard({
  product,
  selected,
  onToggleSelect,
  onEdit,
  onPreview,
  onVectorisationAction,
  onStatusTransition,
  onConvertToAdvanced,
  onShare,
}: ProductGridCardProps) {
  const { t } = useTranslation();
  return (
    <div className="animate-fade-in">
      <Card onClick={onEdit} className="group hover:shadow-lg transition-all overflow-hidden gap-0">
        <div className="relative aspect-square bg-muted">
          {product.firstFileUrl ? (
            <img
              src={product.firstFileUrl}
              alt={product.title}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : product.firstFileAccess === 'quota_blocked' ? (
            // The vendor's storage plan is hiding this photo — say so rather than
            // showing the same empty tile a product with no image gets.
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-amber-600"
              title={t('media.blocked.thumbnailHint')}
            >
              <Lock className="w-10 h-10" />
              <span className="text-xs font-medium">{t('media.blocked.badge')}</span>
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              {product.type === 'digital' ? (
                <FileDigit className="w-12 h-12 text-muted-foreground" />
              ) : (
                <ImageIcon className="w-12 h-12 text-muted-foreground" />
              )}
            </div>
          )}
          <div className="absolute top-3 left-3 z-10" onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={selected}
              onCheckedChange={onToggleSelect}
              className="bg-white/90"
            />
          </div>
          <div className="absolute top-3 right-3 flex flex-col items-end gap-1 z-10">
            <StatusBadge status={product.status} />
            <VectorisationBadge
              enabled={product.vectorisationEnabled}
              status={product.vectorisationStatus}
            />
          </div>
        </div>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-medium truncate text-sm">{product.title}</h3>
              <p className="text-xs text-muted-foreground"><TypeLabel type={product.type} /></p>
            </div>
            <ProductActionsMenu
              product={product}
              onEdit={onEdit}
              onPreview={onPreview}
              onVectorisationAction={onVectorisationAction}
              onStatusTransition={onStatusTransition}
              onConvertToAdvanced={onConvertToAdvanced}
              onShare={onShare}
            />
          </div>
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <Badge variant="outline" className="text-xs">
              {product.category}
            </Badge>
            {product.mode === 'simple' && (
              <Badge variant="outline" className="text-xs">
                {t('products.wizard.modeQuick')}
              </Badge>
            )}
            {/* {product.hasVariants && (
              <Badge variant="outline" className="text-xs">
                Variants
              </Badge>
            )} */}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface ProductActionsMenuProps {
  product: ProductListItem;
  onEdit: () => void;
  onPreview: () => void;
  onVectorisationAction: (action: 'enable' | 'disable' | 'retry') => void;
  onStatusTransition: (transition: StatusTransition) => void;
  onConvertToAdvanced: () => void;
  onShare: () => void;
}

function ProductActionsMenu({
  product,
  onEdit,
  onPreview,
  onVectorisationAction,
  onStatusTransition,
  onConvertToAdvanced,
  onShare,
}: ProductActionsMenuProps) {
  const { t } = useTranslation();
  const editLocked = product.vectorisationStatus === 'pending';

  const showEnable = !product.vectorisationEnabled;
  const showDisable =
    product.vectorisationEnabled && product.vectorisationStatus !== 'pending';
  const showRetry =
    product.vectorisationEnabled && product.vectorisationStatus === 'failed';

  const transitions = getAllowedStatusTransitions(product.status);
  const nonArchiveTransitions = transitions.filter((t) => t.intent !== 'archive');
  const archiveTransition = transitions.find((t) => t.intent === 'archive');

  return (
    /**
     * The click trap is load-bearing, not defensive.
     *
     * This menu renders inside a table row and a grid card that each navigate to
     * the editor on click. Radix portals the menu out of the DOM, but React
     * still bubbles its events up the *component* tree — so "Preview" navigated
     * to the preview route and was immediately overwritten by the row's own
     * navigation to the editor, and "Share" opened its dialog on a page that was
     * already unmounting. Stopping here covers the trigger too, which otherwise
     * opened the editor behind the menu.
     */
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={editLocked ? undefined : onEdit}
            disabled={editLocked}
          >
            <Edit className="w-4 h-4 mr-2" />
            {editLocked ? t('products.ai.editLocked') : t('common.actions.edit')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onPreview}>
            <Eye className="w-4 h-4 mr-2" />
            {t('products.preview.action')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onShare}>
            <Share2 className="w-4 h-4 mr-2" />
            {t('products.share.action')}
          </DropdownMenuItem>

          {product.mode === 'simple' && (
            <DropdownMenuItem onClick={onConvertToAdvanced}>
              <Wand2 className="w-4 h-4 mr-2" />
              {t('products.actions.convertToAdvanced')}
            </DropdownMenuItem>
          )}

          {nonArchiveTransitions.map((transition) => {
            const meta = STATUS_TRANSITION_META[transition.intent];
            const Icon = meta.Icon;
            return (
              <DropdownMenuItem
                key={transition.intent}
                onClick={() => onStatusTransition(transition)}
              >
                <Icon className="w-4 h-4 mr-2" />
                {t(transition.labelKey)}
              </DropdownMenuItem>
            );
          })}

          {showEnable && (
            <DropdownMenuItem onClick={() => onVectorisationAction('enable')}>
              <Sparkles className="w-4 h-4 mr-2" />
              {t('products.ai.enable')}
            </DropdownMenuItem>
          )}
          {showRetry && (
            <DropdownMenuItem onClick={() => onVectorisationAction('retry')}>
              <RotateCw className="w-4 h-4 mr-2" />
              {t('products.ai.retry')}
            </DropdownMenuItem>
          )}
          {showDisable && (
            <DropdownMenuItem onClick={() => onVectorisationAction('disable')}>
              <XCircle className="w-4 h-4 mr-2" />
              {t('products.ai.disable')}
            </DropdownMenuItem>
          )}

          {archiveTransition && (
            <DropdownMenuItem
              onClick={() => onStatusTransition(archiveTransition)}
              className="text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {t(archiveTransition.labelKey)}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function SheetActionButton({
  icon,
  label,
  onClick,
  disabled,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center gap-3 px-5 py-3.5 text-sm text-left hover:bg-muted active:bg-muted disabled:opacity-50 disabled:pointer-events-none',
        destructive && 'text-destructive',
      )}
    >
      <span className="flex-shrink-0">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
