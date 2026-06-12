import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Search,
  Filter,
  Grid3X3,
  List,
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  Package,
  Image as ImageIcon,
  FileDigit,
  Sparkles,
  RotateCw,
  Loader2,
  CheckCircle2,
  XCircle,
  Send,
  Pencil,
  ArchiveRestore,
  Undo2,
  TriangleAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  SheetTrigger,
} from '@/components/ui/sheet';
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
import {
  setVectorisationEnabled,
  retryVectorisation,
  updateProductStatus,
  runActivationPreflight,
  getAllowedStatusTransitions,
  ACTIVATION_ERROR_MAP,
  type StatusTransition,
  type StatusTransitionIntent,
} from '@/services/products.service';
import { ApiError } from '@/types/api';
import type { ProductListItem, ApiVectorisationStatus } from '@/types/product.types';
import { cn } from '@/lib/utils';

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Draft' },
  { value: 'archived', label: 'Archived' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'suspended', label: 'Suspended' },
];

const STATUS_TRANSITION_META: Record<
  StatusTransitionIntent,
  {
    Icon: React.ComponentType<{ className?: string }>;
    defaultConfirm: string;
    confirmCta: string;
  }
> = {
  activate: {
    Icon: Send,
    defaultConfirm:
      'Publish this product? It will become visible in your storefront immediately.',
    confirmCta: 'Publish',
  },
  demote_to_draft: {
    Icon: Pencil,
    defaultConfirm:
      'Move this product back to draft? It will be removed from your storefront until you republish.',
    confirmCta: 'Demote to draft',
  },
  restore: {
    Icon: ArchiveRestore,
    defaultConfirm:
      'Restore this product from archive? It will be set back to draft so you can edit it.',
    confirmCta: 'Restore',
  },
  cancel_review: {
    Icon: Undo2,
    defaultConfirm:
      'Cancel the pending review and move this product back to draft for editing?',
    confirmCta: 'Cancel review',
  },
  archive: {
    Icon: Trash2,
    defaultConfirm:
      'Archive this product? It will no longer appear in your store.',
    confirmCta: 'Archive',
  },
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  draft: 'bg-muted text-muted-foreground',
  archived: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  pending_review: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  suspended: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_BADGE_CLASSES[status] ?? 'bg-muted text-muted-foreground'}`}
    >
      {status.replace('_', ' ')}
    </span>
  );
}

const VECTORISATION_META: Record<
  ApiVectorisationStatus,
  { label: string; className: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  not_started: {
    label: 'Not indexed',
    className: 'bg-muted text-muted-foreground',
    Icon: Sparkles,
  },
  pending: {
    label: 'Indexing…',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    Icon: Loader2,
  },
  completed: {
    label: 'AI search ready',
    className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    Icon: CheckCircle2,
  },
  failed: {
    label: 'Indexing failed',
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
  if (!enabled) return null;
  const meta = VECTORISATION_META[status];
  const { Icon } = meta;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${meta.className}`}
    >
      <Icon className={`w-3 h-3 ${status === 'pending' ? 'animate-spin' : ''}`} />
      {meta.label}
    </span>
  );
}

export function Products() {
  const {
    products,
    selectedProducts,
    isLoading,
    pagination,
    fetchProducts,
    toggleProductSelection,
    selectAllProducts,
    deleteProduct,
  } = useProductStore();
  const { navigate: legacyNavigate } = useRouter();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [actionsSheetProduct, setActionsSheetProduct] = useState<ProductListItem | null>(null);
  const [productToDelete, setProductToDelete] = useState<ProductListItem | null>(null);
  const [transitionState, setTransitionState] = useState<{
    product: ProductListItem;
    transition: StatusTransition;
    preflightErrors?: string[];
    loading?: boolean;
  } | null>(null);

  // Debounced server-side search
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      fetchProducts({ q: searchQuery || undefined });
    }, 400);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery]);

  const handleEdit = useCallback(
    (product: ProductListItem) => {
      navigate(`/dashboard/product-edit/${product.id}`);
    },
    [navigate],
  );

  const confirmDelete = useCallback(async () => {
    if (!productToDelete) return;
    const id = productToDelete.id;
    setProductToDelete(null);
    await deleteProduct(id);
  }, [productToDelete, deleteProduct]);

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
          const msg =
            err instanceof Error ? err.message : 'Could not validate product.';
          toast.error(msg);
          setTransitionState(null);
        }
        return;
      }
      setTransitionState({ product, transition });
    },
    [],
  );

  const confirmStatusTransition = useCallback(async () => {
    if (!transitionState || transitionState.preflightErrors) return;
    const { product, transition } = transitionState;
    setTransitionState({ ...transitionState, loading: true });
    try {
      await updateProductStatus(product.id, transition.target);
      toast.success(
        `"${product.title}" is now ${transition.target.replace('_', ' ')}.`,
      );
      setTransitionState(null);
      await fetchProducts();
    } catch (err: unknown) {
      const mapped =
        err instanceof ApiError && ACTIVATION_ERROR_MAP[err.code]
          ? ACTIVATION_ERROR_MAP[err.code]
          : err instanceof Error
            ? err.message
            : 'Could not change product status.';
      toast.error(mapped);
      setTransitionState(null);
    }
  }, [transitionState, fetchProducts]);

  const handleVectorisationAction = useCallback(
    async (id: string, action: 'enable' | 'disable' | 'retry') => {
      try {
        if (action === 'enable') {
          await setVectorisationEnabled(id, true);
          toast.success('AI search enabled — indexing started.');
        } else if (action === 'disable') {
          await setVectorisationEnabled(id, false);
          toast.success('AI search disabled.');
        } else {
          await retryVectorisation(id);
          toast.success('Retry queued — indexing started.');
        }
        await fetchProducts();
      } catch (err: unknown) {
        const msg =
          err instanceof ApiError ? err.message : 'Could not update AI search.';
        toast.error(msg);
      }
    },
    [fetchProducts],
  );

  const toggleStatusFilter = useCallback((status: string) => {
    setStatusFilter((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status],
    );
  }, []);

  // Client-side status filter (server search already filters by text)
  const filteredProducts = statusFilter.length === 0
    ? products
    : products.filter((p) => statusFilter.includes(p.status));

  const allSelected =
    filteredProducts.length > 0 && selectedProducts.length === filteredProducts.length;

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
                  ? 'Cannot publish yet'
                  : `${transition.label}?`}
              </DialogTitle>
            </div>
            <DialogDescription className="pt-3 text-left">
              {isErrorState ? (
                <>
                  Fix the following before publishing{' '}
                  <span className="font-semibold text-foreground">
                    {product.title}
                  </span>
                  :
                </>
              ) : (
                <>
                  <span className="font-semibold text-foreground">
                    {product.title}
                  </span>
                  {' — '}
                  {transition.confirmMessage ?? meta.defaultConfirm}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {isErrorState && (
            <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
              {preflightErrors!.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          )}
          <DialogFooter>
            {isErrorState ? (
              <DialogClose asChild onClick={() => setTransitionState(null)}>
                <Button variant="outline">Got it</Button>
              </DialogClose>
            ) : (
              <>
                <DialogClose asChild disabled={loading}>
                  <Button variant="outline">Cancel</Button>
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
                    meta.confirmCta
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  })();

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
            <DialogTitle>Archive Product?</DialogTitle>
          </div>
          <DialogDescription className="pt-3 text-left">
            Archive{' '}
            <span className="font-semibold text-foreground">
              {productToDelete?.title}
            </span>
            ? It will no longer appear in your store.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex sm:justify-end gap-2 pt-2">
          <DialogClose asChild>
            <Button variant="outline">Keep Product</Button>
          </DialogClose>
          <Button variant="destructive" onClick={confirmDelete}>
            Yes, Archive
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (isMobile) {
    return (
      <div className="-mx-6 -mt-6">
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <h1 className="text-xl font-bold">Products</h1>
          <button
            onClick={() => legacyNavigate('product-upload')}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-accent transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 mb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search products"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div>
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 border-b">
                <div className="w-16 h-16 rounded-xl bg-muted animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-muted animate-pulse rounded w-3/4" />
                  <div className="h-3 bg-muted animate-pulse rounded w-1/3" />
                  <div className="h-3 bg-muted animate-pulse rounded w-1/2" />
                </div>
              </div>
            ))
            : filteredProducts.map((product) => {
              const editLocked = product.vectorisationStatus === 'pending';
              const openEdit = () => {
                if (editLocked) {
                  toast.error('Editing is locked while AI indexing is in progress.');
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
                    <p className="text-xs text-muted-foreground mt-0.5 capitalize">{product.type}</p>
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
                      className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full hover:bg-accent transition-colors -mr-1"
                      aria-label="Product actions"
                    >
                      <MoreHorizontal className="w-5 h-5 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              );
            })}
        </div>

        {/* Mobile actions bottom sheet */}
        <Sheet
          open={!!actionsSheetProduct}
          onOpenChange={(open) => {
            if (!open) setActionsSheetProduct(null);
          }}
        >
          <SheetContent side="bottom" className="p-0">
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
                      label={editLocked ? 'Edit (locked — indexing)' : 'Edit'}
                      disabled={editLocked}
                      onClick={() => { close(); handleEdit(p); }}
                    />
                    <SheetActionButton
                      icon={<Eye className="w-5 h-5" />}
                      label="Preview"
                      onClick={close}
                    />
                    {nonArchiveTransitions.map((transition) => {
                      const meta = STATUS_TRANSITION_META[transition.intent];
                      const Icon = meta.Icon;
                      return (
                        <SheetActionButton
                          key={transition.intent}
                          icon={<Icon className="w-5 h-5" />}
                          label={transition.label}
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
                        label="Enable AI search"
                        onClick={() => { close(); handleVectorisationAction(p.id, 'enable'); }}
                      />
                    )}
                    {showRetry && (
                      <SheetActionButton
                        icon={<RotateCw className="w-5 h-5" />}
                        label="Retry AI search"
                        onClick={() => { close(); handleVectorisationAction(p.id, 'retry'); }}
                      />
                    )}
                    {showDisable && (
                      <SheetActionButton
                        icon={<XCircle className="w-5 h-5" />}
                        label="Disable AI search"
                        onClick={() => { close(); handleVectorisationAction(p.id, 'disable'); }}
                      />
                    )}
                    {archiveTransition && (
                      <SheetActionButton
                        icon={<Trash2 className="w-5 h-5" />}
                        label={archiveTransition.label}
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
      </div>
    );
  }

  // ─── Desktop ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-muted-foreground">Manage your product catalog</p>
        </div>
        <Button onClick={() => legacyNavigate('product-upload')} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Product
        </Button>
      </div>

      {/* Search + Filters */}
      <Card className="border-none shadow-none">
        <CardContent className="border-none p-0">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search products…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-3">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Filter className="w-4 h-4" />
                    Filters
                    {statusFilter.length > 0 && (
                      <span className="ml-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                        {statusFilter.length}
                      </span>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Filter Products</SheetTitle>
                  </SheetHeader>
                  <div className="mt-6 space-y-4">
                    <h4 className="text-sm font-medium">Status</h4>
                    {STATUS_OPTIONS.map(({ value, label }) => (
                      <label key={value} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={statusFilter.includes(value)}
                          onCheckedChange={() => toggleStatusFilter(value)}
                        />
                        <span className="text-sm">{label}</span>
                      </label>
                    ))}
                    {statusFilter.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setStatusFilter([])}
                        className="mt-2"
                      >
                        Clear filters
                      </Button>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'grid' | 'list')}>
                <TabsList>
                  <TabsTrigger value="grid">
                    <Grid3X3 className="w-4 h-4" />
                  </TabsTrigger>
                  <TabsTrigger value="list">
                    <List className="w-4 h-4" />
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk action bar */}
      {selectedProducts.length > 0 && (
        <div className="flex items-center gap-2 p-4 bg-muted/50 rounded-lg">
          <span className="text-sm text-muted-foreground">{selectedProducts.length} selected</span>
          <div className="flex-1" />
          <Button
            variant="destructive"
            size="sm"
            className="gap-2"
            onClick={() => {
              if (confirm(`Archive ${selectedProducts.length} product(s)?`)) {
                selectedProducts.forEach((id) => deleteProduct(id));
              }
            }}
          >
            <Trash2 className="w-4 h-4" />
            Archive selected
          </Button>
        </div>
      )}

      {/* Grid view */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {isLoading
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
                  <p className="text-muted-foreground mb-4">No products found</p>
                  <Button
                    variant="outline"
                    onClick={() => { setSearchQuery(''); setStatusFilter([]); }}
                  >
                    Clear filters
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
                  <th className="text-left p-4 text-sm font-medium">Product</th>
                  <th className="text-left p-4 text-sm font-medium">Status</th>
                  <th className="text-left p-4 text-sm font-medium">Type</th>
                  {/* <th className="text-left p-4 text-sm font-medium">Variants</th> */}
                  <th className="w-12 p-4" />
                </tr>
              </thead>
              <tbody>
                {isLoading
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
                          <p className="text-muted-foreground">No products found</p>
                        </td>
                      </tr>
                    )
                    : filteredProducts.map((product) => (
                      <tr
                        key={product.id}
                        className="border-b hover:bg-muted/50 transition-colors"
                      >
                        <td className="p-4">
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
                          <span className="text-sm capitalize">{product.type}</span>
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

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {pagination.total} product{pagination.total !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => fetchProducts({ page: pagination.page - 1 })}
            >
              Previous
            </Button>
            <span>
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => fetchProducts({ page: pagination.page + 1 })}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProductThumbnail({ product, size }: { product: ProductListItem; size: 'md' | 'lg' }) {
  const dim = size === 'lg' ? 'w-16 h-16 rounded-xl' : 'w-12 h-12 rounded';
  return (
    <div className={`${dim} bg-muted flex-shrink-0 flex items-center justify-center overflow-hidden`}>
      {product.firstFileUrl ? (
        <img
          src={product.firstFileUrl}
          alt={product.title}
          className="w-full h-full object-cover"
          crossOrigin="use-credentials"
        />
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
  onVectorisationAction: (action: 'enable' | 'disable' | 'retry') => void;
  onStatusTransition: (transition: StatusTransition) => void;
}

function ProductGridCard({
  product,
  selected,
  onToggleSelect,
  onEdit,
  onVectorisationAction,
  onStatusTransition,
}: ProductGridCardProps) {
  return (
    <div className="animate-fade-in">
      <Card className="group hover:shadow-lg transition-all overflow-hidden gap-0">
        <div className="relative aspect-square bg-muted">
          {product.firstFileUrl ? (
            <img
              src={product.firstFileUrl}
              alt={product.title}
              className="absolute inset-0 w-full h-full object-cover"
              crossOrigin="use-credentials"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              {product.type === 'digital' ? (
                <FileDigit className="w-12 h-12 text-muted-foreground" />
              ) : (
                <ImageIcon className="w-12 h-12 text-muted-foreground" />
              )}
            </div>
          )}
          <div className="absolute top-3 left-3 z-10">
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
              <p className="text-xs text-muted-foreground capitalize">{product.type}</p>
            </div>
            <ProductActionsMenu
              product={product}
              onEdit={onEdit}
              onVectorisationAction={onVectorisationAction}
              onStatusTransition={onStatusTransition}
            />
          </div>
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <Badge variant="outline" className="text-xs">
              {product.category}
            </Badge>
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
  onVectorisationAction: (action: 'enable' | 'disable' | 'retry') => void;
  onStatusTransition: (transition: StatusTransition) => void;
}

function ProductActionsMenu({
  product,
  onEdit,
  onVectorisationAction,
  onStatusTransition,
}: ProductActionsMenuProps) {
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
          {editLocked ? 'Edit (locked — indexing)' : 'Edit'}
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Eye className="w-4 h-4 mr-2" />
          Preview
        </DropdownMenuItem>

        {nonArchiveTransitions.map((transition) => {
          const meta = STATUS_TRANSITION_META[transition.intent];
          const Icon = meta.Icon;
          return (
            <DropdownMenuItem
              key={transition.intent}
              onClick={() => onStatusTransition(transition)}
            >
              <Icon className="w-4 h-4 mr-2" />
              {transition.label}
            </DropdownMenuItem>
          );
        })}

        {showEnable && (
          <DropdownMenuItem onClick={() => onVectorisationAction('enable')}>
            <Sparkles className="w-4 h-4 mr-2" />
            Enable AI search
          </DropdownMenuItem>
        )}
        {showRetry && (
          <DropdownMenuItem onClick={() => onVectorisationAction('retry')}>
            <RotateCw className="w-4 h-4 mr-2" />
            Retry AI search
          </DropdownMenuItem>
        )}
        {showDisable && (
          <DropdownMenuItem onClick={() => onVectorisationAction('disable')}>
            <XCircle className="w-4 h-4 mr-2" />
            Disable AI search
          </DropdownMenuItem>
        )}

        {archiveTransition && (
          <DropdownMenuItem
            onClick={() => onStatusTransition(archiveTransition)}
            className="text-destructive"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {archiveTransition.label}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
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
