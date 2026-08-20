// ─── Media Picker ─────────────────────────────────────────────────────────────
// The single source of truth for selecting files across the dashboard. Lists files
// from the File Management Service (flat, no folders) with server-side search,
// filtering and pagination, lets the user upload (button OR drag-and-drop from the
// OS), and returns the chosen `ApiFile[]` to the caller.
//
// Responsive: a centered Dialog on desktop, a bottom Sheet on mobile. Filters
// live in the shared bottom-sheet used by every list surface in the dashboard.

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  Check,
  Image as ImageIcon,
  Video,
  FileText,
  Music,
  Play,
  Upload,
  Grid3X3,
  List,
  Loader2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
} from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FilterChips,
  FilterField,
  FilterSection,
  FilterSheet,
  SearchFilterBar,
} from '@/components/filters';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

/** Local alias so module-level helpers can take the translator as a parameter. */
type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;
import { useIsMobile } from '@/hooks/use-mobile';
import { useApiError, useFormatters, useTranslation, type TranslationKey } from '@/i18n';
import { getUploadErrorMessage } from '@/lib/uploadErrors';
import { UploadSourceSheet } from '@/components/common/UploadSourceSheet';
import { nativeMediaAvailable } from '@/platform/media';
import {
  listFiles,
  uploadMediaWithProgress,
  validateMediaSelection,
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

const KIND_LABEL_KEYS: Record<FileKind, TranslationKey> = {
  image: 'media.filters.kind.image',
  video: 'media.filters.kind.video',
  document: 'media.filters.kind.document',
  audio: 'media.filters.kind.audio',
};

const PICKER_LIMIT = 24;
const MAX_FILES_PER_UPLOAD = 10;
const SEARCH_DEBOUNCE_MS = 300;

const ALL_KINDS: FileKind[] = ['image', 'video', 'document', 'audio'];

type SortValue = `${FileSortField}:${'asc' | 'desc'}`;

const SORT_OPTIONS: { value: SortValue; labelKey: TranslationKey }[] = [
  { value: 'createdAt:desc', labelKey: 'media.filters.sort.newest' },
  { value: 'createdAt:asc', labelKey: 'media.filters.sort.oldest' },
  { value: 'originalName:asc', labelKey: 'media.filters.sort.nameAsc' },
  { value: 'originalName:desc', labelKey: 'media.filters.sort.nameDesc' },
  { value: 'size:desc', labelKey: 'media.filters.sort.largest' },
  { value: 'size:asc', labelKey: 'media.filters.sort.smallest' },
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

/**
 * Human label for the kinds a slot accepts, e.g. "image" or "image / video".
 * Takes the translator as a parameter — this runs outside any component body.
 */
function describeAccepted(types: FileKind[], t: Translate): string {
  return types.map((kind) => t(KIND_LABEL_KEYS[kind]).toLowerCase()).join(' / ');
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
  if (kind === 'video') {
    return (
      <div className="relative h-full w-full bg-black">
        <video
          src={resolveFileUrl(file)}
          muted
          preload="metadata"
          crossOrigin="use-credentials"
          playsInline
          className="h-full w-full object-cover"
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="rounded-full bg-black/55 p-1.5 text-white backdrop-blur-sm">
            <Play className="h-4 w-4" />
          </span>
        </div>
      </div>
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
  const { t } = useTranslation();
  const fmt = useFormatters();
  const apiError = useApiError();
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
  // Native only — nothing on the web ever opens it (CAPACITOR-PLAN.md → P4.3).
  const [sourceOpen, setSourceOpen] = useState(false);

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
      apiError.toast(err, { fallbackKey: 'media.errors.loadFailed' });
    } finally {
      setIsLoading(false);
    }
  }, [query, apiError]);

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
      const invalid = validateMediaSelection(arr);
      if (invalid) {
        toast.error(invalid);
        return;
      }
      setUploading(true);
      setUploadPercent(0);
      try {
        await uploadMediaWithProgress(arr, setUploadPercent);
        toast.success(t('media.library.uploaded', { count: arr.length }));
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
    [page, fetchFiles, t],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (uploading) return;
    if (e.dataTransfer.files?.length) handleUpload(e.dataTransfer.files);
  };

  // On a device the Upload button opens the source sheet (camera / library /
  // files) instead of going straight to the system file chooser; on the web it
  // is the same click on the same hidden input it always was (P4.3).
  const requestUpload = () => {
    if (nativeMediaAvailable) setSourceOpen(true);
    else fileInputRef.current?.click();
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
        t('media.picker.kindNotAllowed', {
          kind: t(KIND_LABEL_KEYS[kind]),
          allowed: describeAccepted(acceptedTypes, t),
        }),
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

  // Search has its own box, so it isn't counted on the filter button's badge.
  const activeFilterCount =
    (filters.category !== 'all' ? 1 : 0) +
    (filters.minMB || filters.maxMB ? 1 : 0) +
    (filters.createdAfter || filters.createdBefore ? 1 : 0) +
    (filters.sort !== DEFAULT_FILTERS.sort ? 1 : 0);

  const hasActiveFilters = !!search || activeFilterCount > 0;

  // ─── Pieces ──────────────────────────────────────────────────────────────────

  const toolbar = (
    <div className="border-b px-4 py-3 sm:px-6">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleUpload(e.target.files)}
      />
      <UploadSourceSheet
        open={sourceOpen}
        onOpenChange={setSourceOpen}
        onPicked={handleUpload}
        onBrowseFiles={() => fileInputRef.current?.click()}
        multiple
        // The same ceiling `validateMediaSelection` enforces, applied at the
        // point of selection so the vendor is stopped by the picker rather than
        // by an error after choosing twelve photos.
        limit={MAX_FILES_PER_UPLOAD}
        allowVideo
      />
      <SearchFilterBar
        value={searchInput}
        onChange={setSearchInput}
        placeholder={t('media.picker.searchPlaceholder')}
        activeFilterCount={activeFilterCount}
        onOpenFilters={() => setFiltersOpen(true)}
        filterLabel={t('media.picker.filterTitle')}
        trailing={
          <>
            <Button
              variant="outline"
              onClick={requestUpload}
              disabled={uploading}
              className="h-11 shrink-0 gap-2 rounded-xl"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              <span className="hidden sm:inline">{t('common.actions.upload')}</span>
            </Button>
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'grid' | 'list')}>
              <TabsList className="h-11 rounded-xl">
                <TabsTrigger value="grid" className="px-2" aria-label={t('media.picker.gridView')}>
                  <Grid3X3 className="h-4 w-4" />
                </TabsTrigger>
                <TabsTrigger value="list" className="px-2" aria-label={t('media.picker.listView')}>
                  <List className="h-4 w-4" />
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </>
        }
      />
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
                  <Badge className="bg-primary text-xs text-primary-foreground">{t('media.picker.added')}</Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs capitalize">
                    {kindFromMime(file.mimeType)}
                  </Badge>
                )}
              </div>
            </div>
            <div className="p-3">
              <p className="truncate text-sm font-medium">{file.originalName ?? t('media.details.untitled')}</p>
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
              <p className="truncate font-medium">{file.originalName ?? t('media.details.untitled')}</p>
              <p className="text-xs text-muted-foreground">
                {fmt.fileSize(file.size)} · {fmt.date(file.createdAt)}
              </p>
            </div>
            {added && (
              <Badge className="bg-primary text-xs text-primary-foreground">{t('media.picker.added')}</Badge>
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
            <span className="text-muted-foreground">{t('media.picker.uploading')}</span>
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
            aria-label={t('common.actions.close')}
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
            <p className="text-muted-foreground">{t('media.picker.noFiles')}</p>
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
                {t('media.picker.clearFilters')}
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
              {t('common.pagination.pageOf', { page: pagination.page, total: pagination.pages })}
              {' · '}
              {t('media.picker.totalFiles', { count: pagination.total })}
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
                {t('common.pagination.previous')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pagination.pages || isLoading}
                onClick={() => setPage((p) => p + 1)}
                className="gap-1"
              >
                {t('common.pagination.next')}
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
            <p className="text-lg font-semibold">{t('media.picker.dropToUpload')}</p>
            <p className="text-sm text-muted-foreground">
              {t('media.upload.limits', { maxFiles: MAX_FILES_PER_UPLOAD })}
            </p>
          </div>
        </div>
      )}
    </div>
  );

  const footer = (
    <div className="flex items-center justify-between border-t px-4 py-4 sm:px-6">
      <Button variant="outline" onClick={onClose}>
        {t('common.actions.cancel')}
      </Button>
      <Button onClick={handleConfirm} disabled={selectedCount === 0}>
        {selectedCount > 0
          ? t('media.picker.selectCount', { count: selectedCount })
          : t('common.actions.select')}
      </Button>
    </div>
  );

  const titleNode = (
    <div className="flex items-center justify-between">
      <span>{t('media.picker.selectMedia')}</span>
      {multiple && (
        <span className="text-sm font-normal text-muted-foreground">
          {maxFiles
            ? t('media.picker.selectedOfMax', { count: selectedCount, max: maxFiles })
            : t('media.picker.selected', { count: selectedCount })}
        </span>
      )}
    </div>
  );

  const filterSheet = (
    <FilterSheet
      open={filtersOpen}
      onOpenChange={setFiltersOpen}
      title={t('media.picker.filterTitle')}
      activeCount={activeFilterCount}
      onClear={() => setFilters(DEFAULT_FILTERS)}
      applyLabel={t('media.filters.apply')}
    >
      <MediaPickerFilters filters={filters} onChange={setFilters} />
    </FilterSheet>
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

      {filterSheet}
    </>
  );
}

// ─── Filter panel ───────────────────────────────────────────────────────────────

function MediaPickerFilters({
  filters,
  onChange,
}: {
  filters: FilterState;
  onChange: (f: FilterState) => void;
}) {
  const { t } = useTranslation();
  const set = <K extends keyof FilterState>(key: K, value: FilterState[K]) =>
    onChange({ ...filters, [key]: value });

  return (
    <>
      <FilterSection title={t('media.picker.fileType')}>
        <FilterChips
          options={ALL_KINDS.map((k) => ({ value: k, labelKey: KIND_LABEL_KEYS[k] }))}
          value={filters.category === 'all' ? undefined : (filters.category as FileKind)}
          onChange={(v) => set('category', (v ?? 'all') as MediaCategory | 'all')}
          allLabel={t('media.filters.allTypes')}
        />
      </FilterSection>

      <FilterSection title={t('media.picker.sizeMb')}>
        <div className="flex items-center gap-2">
          <FilterField label={t('media.picker.sizeMin')} htmlFor="picker-min-mb" className="flex-1">
            <Input
              id="picker-min-mb"
              type="number"
              min={0}
              placeholder="0"
              value={filters.minMB}
              onChange={(e) => set('minMB', e.target.value)}
              className="h-11 rounded-xl"
            />
          </FilterField>
          <FilterField label={t('media.picker.sizeMax')} htmlFor="picker-max-mb" className="flex-1">
            <Input
              id="picker-max-mb"
              type="number"
              min={0}
              placeholder={t('media.picker.sizeAny')}
              value={filters.maxMB}
              onChange={(e) => set('maxMB', e.target.value)}
              className="h-11 rounded-xl"
            />
          </FilterField>
        </div>
      </FilterSection>

      <FilterSection title={t('media.picker.uploadedOn')}>
        <div className="grid grid-cols-2 gap-2">
          <FilterField label={t('media.picker.uploadedAfter')} htmlFor="picker-after">
            <Input
              id="picker-after"
              type="date"
              value={filters.createdAfter}
              onChange={(e) => set('createdAfter', e.target.value)}
              className="h-11 rounded-xl"
            />
          </FilterField>
          <FilterField label={t('media.picker.uploadedBefore')} htmlFor="picker-before">
            <Input
              id="picker-before"
              type="date"
              value={filters.createdBefore}
              onChange={(e) => set('createdBefore', e.target.value)}
              className="h-11 rounded-xl"
            />
          </FilterField>
        </div>
      </FilterSection>

      <FilterSection title={t('media.picker.sortBy')}>
        <FilterChips
          options={SORT_OPTIONS}
          value={filters.sort}
          onChange={(v) => set('sort', (v ?? DEFAULT_FILTERS.sort) as SortValue)}
          hideAll
        />
      </FilterSection>
    </>
  );
}
