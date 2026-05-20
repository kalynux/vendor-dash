import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
  AlertCircle,
  Image as ImageIcon,
  ChevronRight,
  FileDigit,
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useProductStore } from '@/store';
import { useRouter } from '@/App';
import { useIsMobile } from '@/hooks/use-mobile';
import type { ProductListItem } from '@/types/product.types';

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Draft' },
  { value: 'archived', label: 'Archived' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'suspended', label: 'Suspended' },
];

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

  const handleDelete = useCallback(
    async (id: string) => {
      if (confirm('Archive this product? It will no longer appear in your store.')) {
        await deleteProduct(id);
      }
    },
    [deleteProduct],
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
            : filteredProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => handleEdit(product)}
                  className="w-full flex items-center gap-3 px-4 py-3 border-b hover:bg-muted/30 transition-colors text-left"
                >
                  <ProductThumbnail product={product} size="lg" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{product.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 capitalize">{product.type}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{product.category}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <StatusBadge status={product.status} />
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
        </div>
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
      <Card>
        <CardContent className="p-4">
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
                onDelete={() => handleDelete(product.id)}
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
                  <th className="text-left p-4 text-sm font-medium">Variants</th>
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
                        <StatusBadge status={product.status} />
                      </td>
                      <td className="p-4">
                        <span className="text-sm capitalize">{product.type}</span>
                      </td>
                      <td className="p-4">
                        {product.hasVariants ? (
                          <Badge variant="outline" className="text-xs">
                            Has variants
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-4">
                        <ProductActionsMenu
                          onEdit={() => handleEdit(product)}
                          onDelete={() => handleDelete(product.id)}
                        />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

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
      {product.firstFileId ? (
        // File ID present but URL construction requires media endpoint — show placeholder
        product.type === 'digital' ? (
          <FileDigit className="w-5 h-5 text-muted-foreground" />
        ) : (
          <ImageIcon className="w-5 h-5 text-muted-foreground" />
        )
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
  onDelete: () => void;
}

function ProductGridCard({ product, selected, onToggleSelect, onEdit, onDelete }: ProductGridCardProps) {
  return (
    <div className="animate-fade-in">
      <Card className="group hover:shadow-lg transition-all overflow-hidden">
        <div className="relative aspect-square bg-muted">
          <div className="w-full h-full flex items-center justify-center">
            {product.type === 'digital' ? (
              <FileDigit className="w-12 h-12 text-muted-foreground" />
            ) : (
              <ImageIcon className="w-12 h-12 text-muted-foreground" />
            )}
          </div>
          <div className="absolute top-3 left-3">
            <Checkbox
              checked={selected}
              onCheckedChange={onToggleSelect}
              className="bg-white/90"
            />
          </div>
          <div className="absolute top-3 right-3">
            <StatusBadge status={product.status} />
          </div>
        </div>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-medium truncate text-sm">{product.title}</h3>
              <p className="text-xs text-muted-foreground capitalize">{product.type}</p>
            </div>
            <ProductActionsMenu onEdit={onEdit} onDelete={onDelete} />
          </div>
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <Badge variant="outline" className="text-xs">
              {product.category}
            </Badge>
            {product.hasVariants && (
              <Badge variant="outline" className="text-xs">
                Variants
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ProductActionsMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}>
          <Edit className="w-4 h-4 mr-2" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Eye className="w-4 h-4 mr-2" />
          Preview
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDelete} className="text-destructive">
          <Trash2 className="w-4 h-4 mr-2" />
          Archive
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
