// ─── Media Picker ─────────────────────────────────────────────────────────────
// The single source of truth for selecting files across the dashboard. Lists files
// from the File Management Service (flat, no folders) with server-side search,
// filtering and pagination, lets the user upload (button OR drag-and-drop from the
// OS), and returns the chosen `ApiFile[]` to the caller.
//
// Responsive: a centered Dialog on desktop, a bottom Sheet on mobile. The filter
// panel is a left drawer on desktop and a bottom sheet on mobile.

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  Search,
  Check,
  Image as ImageIcon,
  Video,
  FileText,
  Music,
  Upload,
  Grid3X3,
  List,
  Loader2,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { cn, formatFileSize } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { ApiError } from '@/types/api';
import { getUploadErrorMessage } from '@/lib/uploadErrors';
import {
  listFiles,
  uploadFilesWithProgress,
  resolveFileUrl,
  kindFromMime,
} from '@/services/files.service';
import type {
  ApiFile,
  FileKind,
  FilePagination,
  FileListParams,
  FileSortField,
  MediaCategory,
} from '@/types/file.types';

interface MediaPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (files: ApiFile[]) => void;
  multiple?: boolean;
  acceptedTypes?: FileKind[];
  maxFiles?: number;
  /** Ids already attached to the target — shown as "Added" and not re-selectable. */
  alreadySelectedIds?: string[];
}

const typeIcons: Record<FileKind, typeof ImageIcon> = {
  image: ImageIcon,
  video: Video,
  document: FileText,
  audio: Music,
};

const typeColors: Record<FileKind, string> = {
  image: 'bg-blue-500/10 text-blue-600',
  video: 'bg-purple-500/10 text-purple-600',
  document: 'bg-orange-500/10 text-orange-600',
  audio: 'bg-emerald-500/10 text-emerald-600',
};

const KIND_LABELS: Record<FileKind, string> = {
  image: 'Images',
  video: 'Video',
  document: 'Documents',
  audio: 'Audio',
};

const PICKER_LIMIT = 24;
const MAX_FILES_PER_UPLOAD = 10;
const VENDOR_MAX_BYTES = 500 * 1024 * 1024; // 500 MB role limit
const SEARCH_DEBOUNCE_MS = 300;

const ALL_KINDS: FileKind[] = ['image', 'video', 'document', 'audio'];

type SortValue = `${FileSortField}:${'asc' | 'desc'}`;

const SORT_OPTIONS: { value: SortValue; label: string }[] = [
  { value: 'createdAt:desc', label: 'Newest first' },
  { value: 'createdAt:asc', label: 'Oldest first' },
  { value: 'originalName:asc', label: 'Name A–Z' },
  { value: 'originalName:desc', label: 'Name Z–A' },
  { value: 'size:desc', label: 'Largest first' },
  { value: 'size:asc', label: 'Smallest first' },
];

interface FilterState {
  category: MediaCategory | 'all';
  minMB: string;
  maxMB: string;
  createdAfter: string;
  createdBefore: string;
  sort: SortValue;
}

const DEFAULT_FILTERS: FilterState = {
  category: 'all',
  minMB: '',
  maxMB: '',
  createdAfter: '',
  createdBefore: '',
  sort: 'createdAt:desc',
};

function mbToBytes(mb: string): number | undefined {
  const n = parseFloat(mb);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 1024 * 1024) : undefined;
}

/** Human label for the kinds a slot accepts, e.g. "image" or "image / video". */
function describeAccepted(types: FileKind[]): string {
  return types.map((t) => KIND_LABELS[t].toLowerCase()).join(' / ');
}

// Module-level so its identity is stable across renders — defining it inside the
// component would remount every <img> on each selection (visible as a flicker).
function FileThumb({ file }: { file: ApiFile }) {
  const kind = kindFromMime(file.mimeType);
  const Icon = typeIcons[kind];
  if (kind === 'image') {
    return (
      <img
        src={resolveFileUrl(file)}
        alt={file.originalName ?? 'File'}
        crossOrigin="use-credentials"
        loading="lazy"
        className="h-full w-full object-cover"
        draggable={false}
      />
    );
  }
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className={cn('rounded-lg p-3', typeColors[kind])}>
        <Icon className="h-8 w-8" />
      </div>
    </div>
  );
}

// Always-visible checkbox so users can tell at a glance what's selectable and
// what's already selected (and, in single-select, that they must unselect first).
function SelectionBox({ checked }: { checked: boolean }) {
  return (
    <span
      className={cn(
        'flex h-5 w-5 items-center justify-center rounded-md border-2 transition-colors',
        checked
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-white/90 bg-black/30 text-transparent backdrop-blur-sm',
      )}
    >
      <Check className="h-3.5 w-3.5" />
    </span>
  );
}

export function MediaPicker({
  open,
  onClose,
  onSelect,
  multiple = false,
  acceptedTypes = ALL_KINDS,
  maxFiles,
  alreadySelectedIds = [],
}: MediaPickerProps) {
  const isMobile = useIsMobile();

  const alreadySelected = useMemo(
    () => new Set(alreadySelectedIds),
    [alreadySelectedIds],
  );

  const [files, setFiles] = useState<ApiFile[]>([]);
  const [pagination, setPagination] = useState<FilePagination | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Selection survives paging by keying chosen files by id.
  const [selected, setSelected] = useState<Record<string, ApiFile>>({});
  // Inline error when the user tries to pick a file outside the accepted kinds.
  const [selectError, setSelectError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Query assembly ──────────────────────────────────────────────────────────

  const [sortBy, sortOrder] = filters.sort.split(':') as [FileSortField, 'asc' | 'desc'];
  const effectiveCategory: MediaCategory | undefined =
    filters.category === 'all' ? undefined : filters.category;

  const query: FileListParams = useMemo(
    () => ({
      page,
      limit: PICKER_LIMIT,
      search: search || undefined,
      category: effectiveCategory,
      minSize: mbToBytes(filters.minMB),
      maxSize: mbToBytes(filters.maxMB),
      createdAfter: filters.createdAfter || undefined,
      createdBefore: filters.createdBefore || undefined,
      sortBy,
      sortOrder,
    }),
    [page, search, effectiveCategory, filters, sortBy, sortOrder],
  );

  const fetchFiles = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await listFiles(query);
      setFiles(res.files);
      setPagination(res.pagination);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not load files.');
    } finally {
      setIsLoading(false);
    }
  }, [query]);

  // Reset everything when the picker opens. The type filter is *seeded* from the
  // accepted kinds (a single accepted kind pre-selects it) but stays changeable so
  // the user can browse other types — selecting an out-of-type file is rejected.
  useEffect(() => {
    if (open) {
      setSelected({});
      setSelectError(null);
      setSearchInput('');
      setSearch('');
      setFilters({
        ...DEFAULT_FILTERS,
        category: acceptedTypes.length === 1 ? acceptedTypes[0] : 'all',
      });
      setPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Debounce the search box into the applied `search`.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Any query change other than the page itself resets to page 1.
  useEffect(() => {
    setPage(1);
  }, [search, effectiveCategory, filters.minMB, filters.maxMB, filters.createdAfter, filters.createdBefore, filters.sort]);

  useEffect(() => {
    if (open) fetchFiles();
  }, [open, fetchFiles]);

  // ─── Upload (button + drag-and-drop) ──────────────────────────────────────────

  const handleUpload = useCallback(
    async (picked: FileList | File[]) => {
      const arr = Array.from(picked);
      if (arr.length === 0) return;
      if (arr.length > MAX_FILES_PER_UPLOAD) {
        toast.error(`You can upload at most ${MAX_FILES_PER_UPLOAD} files at once.`);
        return;
      }
      const tooBig = arr.find((f) => f.size > VENDOR_MAX_BYTES);
      if (tooBig) {
        toast.error(`"${tooBig.name}" exceeds the 500 MB limit.`);
        return;
      }
      setUploading(true);
      setUploadPercent(0);
      try {
        await uploadFilesWithProgress(arr, setUploadPercent);
        toast.success(`Uploaded ${arr.length} file${arr.length > 1 ? 's' : ''}.`);
        if (page !== 1) setPage(1);
        else await fetchFiles();
      } catch (err) {
        toast.error(getUploadErrorMessage(err, arr));
      } finally {
        setUploading(false);
        setUploadPercent(0);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [page, fetchFiles],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (uploading) return;
    if (e.dataTransfer.files?.length) handleUpload(e.dataTransfer.files);
  };

  // ─── Selection ─────────────────────────────────────────────────────────────

  const selectedIds = Object.keys(selected);
  const selectedCount = selectedIds.length;

  const toggleSelection = (file: ApiFile) => {
    if (alreadySelected.has(file.id)) return; // already attached to the target
    const kind = kindFromMime(file.mimeType);
    // Reject files outside the accepted kinds (the type filter is browsable, so a
    // user can land on, e.g., a PDF while picking a cover image).
    if (!selected[file.id] && !acceptedTypes.includes(kind)) {
      setSelectError(
        `${KIND_LABELS[kind]} can't be used here — only ${describeAccepted(acceptedTypes)} files are allowed.`,
      );
      return;
    }
    setSelectError(null);
    setSelected((prev) => {
      if (prev[file.id]) {
        const next = { ...prev };
        delete next[file.id];
        return next;
      }
      if (!multiple) return { [file.id]: file };
      if (maxFiles && Object.keys(prev).length >= maxFiles) return prev;
      return { ...prev, [file.id]: file };
    });
  };

  const handleConfirm = () => {
    onSelect(Object.values(selected));
    onClose();
  };

  // The type filter is browsable, so the list shows whatever the current query
  // returns. Out-of-type files are blocked at selection time, not hidden here.
  const visibleFiles = files;

  const hasActiveFilters =
    !!search ||
    filters.category !== 'all' ||
    !!filters.minMB ||
    !!filters.maxMB ||
    !!filters.createdAfter ||
    !!filters.createdBefore;

  // ─── Pieces ──────────────────────────────────────────────────────────────────

  const toolbar = (
    <div className="flex flex-col gap-3 border-b px-4 py-3 sm:px-6 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search files…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="h-9 pl-10"
        />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleUpload(e.target.files)}
      />
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFiltersOpen(true)}
          className="gap-2"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {hasActiveFilters && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="gap-2"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Upload
        </Button>
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'grid' | 'list')}>
          <TabsList className="h-9">
            <TabsTrigger value="grid" className="px-2">
              <Grid3X3 className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="list" className="px-2">
              <List className="h-4 w-4" />
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
    </div>
  );

  const grid = (
    <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-5">
      {visibleFiles.map((file) => {
        const added = alreadySelected.has(file.id);
        const isSelected = added || !!selected[file.id];
        return (
          <div
            key={file.id}
            onClick={() => toggleSelection(file)}
            className={cn(
              'group relative overflow-hidden rounded-lg border-2 transition-all',
              added
                ? 'cursor-default border-primary/40 opacity-70'
                : isSelected
                  ? 'cursor-pointer border-primary bg-primary/5'
                  : 'cursor-pointer border-transparent hover:border-muted',
            )}
          >
            <div className="relative aspect-square overflow-hidden rounded-t-lg bg-muted">
              <FileThumb file={file} />
              <div className="absolute right-2 top-2">
                <SelectionBox checked={isSelected} />
              </div>
              <div className="absolute bottom-2 left-2">
                {added ? (
                  <Badge className="bg-primary text-xs text-primary-foreground">Added</Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs capitalize">
                    {kindFromMime(file.mimeType)}
                  </Badge>
                )}
              </div>
            </div>
            <div className="p-3">
              <p className="truncate text-sm font-medium">{file.originalName ?? 'Untitled'}</p>
            </div>
          </div>
        );
      })}
    </div>
  );

  const listView = (
    <div className="space-y-2">
      {visibleFiles.map((file) => {
        const added = alreadySelected.has(file.id);
        const isSelected = added || !!selected[file.id];
        return (
          <div
            key={file.id}
            onClick={() => toggleSelection(file)}
            className={cn(
              'flex items-center gap-4 rounded-lg border p-3 transition-all',
              added
                ? 'cursor-default border-primary/40 opacity-70'
                : isSelected
                  ? 'cursor-pointer border-primary bg-primary/5'
                  : 'cursor-pointer border-transparent hover:border-muted hover:bg-muted/50',
            )}
          >
            <div className="h-11 w-11 shrink-0 overflow-hidden rounded-md border bg-muted">
              <FileThumb file={file} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{file.originalName ?? 'Untitled'}</p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(file.size)} · {new Date(file.createdAt).toLocaleDateString()}
              </p>
            </div>
            {added && (
              <Badge className="bg-primary text-xs text-primary-foreground">Added</Badge>
            )}
            <SelectionBox checked={isSelected} />
          </div>
        );
      })}
    </div>
  );

  const content = (
    <div
      className="relative flex flex-1 flex-col overflow-hidden"
      onDragOver={(e) => {
        e.preventDefault();
        if (!uploading) setDragActive(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragActive(false);
      }}
      onDrop={onDrop}
    >
      {uploading && (
        <div className="border-b bg-muted/30 px-4 py-3 sm:px-6">
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-muted-foreground">Uploading…</span>
            <span>{uploadPercent}%</span>
          </div>
          <Progress value={uploadPercent} className="h-1.5" />
        </div>
      )}

      {toolbar}

      {/* Out-of-type selection error — inline, contextual, auto-clears on a valid pick */}
      {selectError && (
        <div className="flex items-start gap-2 border-b border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive sm:px-6">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">{selectError}</span>
          <button
            type="button"
            onClick={() => setSelectError(null)}
            className="shrink-0 rounded-sm p-0.5 hover:bg-destructive/15"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {isLoading ? (
          viewMode === 'grid' ? (
            <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-5">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          )
        ) : visibleFiles.length === 0 ? (
          <div className="py-12 text-center">
            <ImageIcon className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">No files found</p>
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchInput('');
                  setFilters(DEFAULT_FILTERS);
                }}
                className="mt-3"
              >
                Clear filters
              </Button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          grid
        ) : (
          listView
        )}

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {pagination.page} of {pagination.pages} · {pagination.total} total
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || isLoading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pagination.pages || isLoading}
                onClick={() => setPage((p) => p + 1)}
                className="gap-1"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Drag overlay */}
      {dragActive && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-primary/10 backdrop-blur-sm">
          <div className="rounded-2xl border-2 border-dashed border-primary bg-background px-10 py-8 text-center shadow-lg">
            <Upload className="mx-auto mb-3 h-10 w-10 text-primary" />
            <p className="text-lg font-semibold">Drop to upload</p>
            <p className="text-sm text-muted-foreground">
              Up to {MAX_FILES_PER_UPLOAD} files, 500 MB each
            </p>
          </div>
        </div>
      )}
    </div>
  );

  const footer = (
    <div className="flex items-center justify-between border-t px-4 py-4 sm:px-6">
      <Button variant="outline" onClick={onClose}>
        Cancel
      </Button>
      <Button onClick={handleConfirm} disabled={selectedCount === 0}>
        Select {selectedCount > 0 && `(${selectedCount})`}
      </Button>
    </div>
  );

  const titleNode = (
    <div className="flex items-center justify-between">
      <span>Select media</span>
      {multiple && (
        <span className="text-sm font-normal text-muted-foreground">
          {selectedCount} selected{maxFiles ? ` / ${maxFiles} max` : ''}
        </span>
      )}
    </div>
  );

  const filterPanel = (
    <MediaPickerFilters
      filters={filters}
      onChange={setFilters}
      onReset={() => setFilters(DEFAULT_FILTERS)}
      onClose={() => setFiltersOpen(false)}
    />
  );

  return (
    <>
      {isMobile ? (
        <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
          <SheetContent
            side="bottom"
            className="flex h-[92vh] flex-col gap-0 rounded-t-2xl p-0 [&>button]:hidden"
          >
            <SheetHeader className="border-b px-4 pb-3 pt-4 text-left">
              <SheetTitle>{titleNode}</SheetTitle>
            </SheetHeader>
            {content}
            {footer}
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
          <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col gap-0 overflow-hidden p-0">
            <DialogHeader className="border-b px-6 pb-4 pt-6">
              <DialogTitle>{titleNode}</DialogTitle>
            </DialogHeader>
            {content}
            {footer}
          </DialogContent>
        </Dialog>
      )}

      {/* Filter drawer: left on desktop, bottom sheet on mobile */}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent
          side={isMobile ? 'bottom' : 'left'}
          className={cn(
            'flex flex-col gap-0 p-0',
            isMobile ? 'h-[80vh] rounded-t-2xl' : 'w-[340px] sm:max-w-[340px]',
          )}
        >
          <SheetHeader className="border-b px-5 py-4 text-left">
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          {filterPanel}
        </SheetContent>
      </Sheet>
    </>
  );
}

// ─── Filter panel ───────────────────────────────────────────────────────────────

function MediaPickerFilters({
  filters,
  onChange,
  onReset,
  onClose,
}: {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const set = <K extends keyof FilterState>(key: K, value: FilterState[K]) =>
    onChange({ ...filters, [key]: value });

  return (
    <>
      <div className="flex-1 space-y-5 overflow-auto px-5 py-4">
        <div className="space-y-1.5">
          <Label className="text-xs">File type</Label>
          <Select
            value={filters.category}
            onValueChange={(v) => set('category', v as MediaCategory | 'all')}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {ALL_KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {KIND_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Size (MB)</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              placeholder="Min"
              value={filters.minMB}
              onChange={(e) => set('minMB', e.target.value)}
              className="h-9"
            />
            <span className="text-muted-foreground">–</span>
            <Input
              type="number"
              min={0}
              placeholder="Max"
              value={filters.maxMB}
              onChange={(e) => set('maxMB', e.target.value)}
              className="h-9"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Uploaded</Label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[11px] text-muted-foreground">After</span>
              <Input
                type="date"
                value={filters.createdAfter}
                onChange={(e) => set('createdAfter', e.target.value)}
                className="h-9"
              />
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground">Before</span>
              <Input
                type="date"
                value={filters.createdBefore}
                onChange={(e) => set('createdBefore', e.target.value)}
                className="h-9"
              />
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Sort by</Label>
          <Select value={filters.sort} onValueChange={(v) => set('sort', v as SortValue)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <SheetFooter className="flex-row gap-2 border-t px-5 py-4">
        <Button variant="outline" className="flex-1 gap-1.5" onClick={onReset}>
          <X className="h-4 w-4" />
          Reset
        </Button>
        <Button className="flex-1" onClick={onClose}>
          Done
        </Button>
      </SheetFooter>
    </>
  );
}
