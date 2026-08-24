// ─── Media Library ─────────────────────────────────────────────────────────────
// Enterprise, Spotify-style media manager driven entirely by the backend File
// Management Service (api-doc/vendor/file-management.md). Files are FLAT (no
// folders). A persistent inspector resolves exactly where each file is attached
// (product, variant, digital asset, ticket, or a logo/banner/avatar slot) from
// the `usage` references — never from `usageCount`.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  Grid3X3,
  List,
  Image as ImageIcon,
  Video,
  FileText,
  Music,
  Play,
  Trash2,
  Pencil,
  Check,
  X,
  Link2,
  Package,
  Tag,
  FileDown,
  HardDrive,
  Layers,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Inbox,
  ExternalLink,
  Store,
  Building2,
  User,
  UserCircle,
  ShieldCheck,
  LifeBuoy,
  Paperclip,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ActiveFilterChips,
  FilterChips,
  FilterSection,
  FilterSheet,
  SearchFilterBar,
  type ActiveFilterChip,
} from '@/components/filters';
import { cn, storagePercent, storageBarColor } from '@/lib/utils';
import { ApiError } from '@/types/api';
import { getUploadErrorMessage } from '@/lib/uploadErrors';
import { useIsMobile } from '@/hooks/use-mobile';
import { useInfiniteList } from '@/hooks/use-infinite-list';
import { useScrollRestoration } from '@/hooks/use-scroll-restoration';
import { getListCache, setListCache } from '@/lib/listCache';
import { MobilePageHeader } from '@/components/layout/MobilePageHeader';
import { MobileListFooter } from '@/components/layout/MobileListFooter';
import { useTranslation, useApiError, useFormatters, type TranslationKey } from '@/i18n';
import {
  listFiles,
  getFilesUsage,
  getFile,
  deleteFile,
  updateFileName,
  uploadMediaWithProgress,
  validateMediaSelection,
  resolveFileUrl,
  kindFromMime,
  categoryFromKind,
} from '@/services/files.service';
import { UploadSourceSheet } from '@/components/common/UploadSourceSheet';
import { nativeMediaAvailable } from '@/platform/media';
import { downloadFile } from '@/platform/filesystem';
import type {
  ApiFile,
  ApiFileDetail,
  FileKind,
  FilePagination,
  FileReference,
  StorageProvider,
  StorageUsage,
} from '@/types/file.types';

const PAGE_LIMIT = 24;
const MAX_FILES_PER_UPLOAD = 10;

const kindIcon: Record<FileKind, typeof ImageIcon> = {
  image: ImageIcon,
  video: Video,
  audio: Music,
  document: FileText,
};

const kindTint: Record<FileKind, string> = {
  image: 'bg-blue-500/10 text-blue-600',
  video: 'bg-purple-500/10 text-purple-600',
  audio: 'bg-emerald-500/10 text-emerald-600',
  document: 'bg-orange-500/10 text-orange-600',
};

const KIND_FILTERS: { value: FileKind; labelKey: TranslationKey; mime: string }[] = [
  { value: 'image', labelKey: 'media.filters.kind.image', mime: 'image/' },
  { value: 'video', labelKey: 'media.filters.kind.video', mime: 'video/' },
  { value: 'audio', labelKey: 'media.filters.kind.audio', mime: 'audio/' },
  { value: 'document', labelKey: 'media.filters.kind.document', mime: 'application/' },
];

const PROVIDERS: StorageProvider[] = ['local', 's3', 'gcs', 'r2', 'firebase', 'cloudinary'];

type SortField = 'date' | 'name' | 'size';

/** `field:direction` pairs, so sort is one chip group rather than two controls. */
const SORT_OPTIONS: { value: string; labelKey: TranslationKey }[] = [
  { value: 'date:desc', labelKey: 'media.filters.sort.newest' },
  { value: 'date:asc', labelKey: 'media.filters.sort.oldest' },
  { value: 'name:asc', labelKey: 'media.filters.sort.nameAsc' },
  { value: 'name:desc', labelKey: 'media.filters.sort.nameDesc' },
  { value: 'size:desc', labelKey: 'media.filters.sort.largest' },
  { value: 'size:asc', labelKey: 'media.filters.sort.smallest' },
];

// Small viewport hook — drives the persistent-aside vs slide-over inspector.
function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isDesktop;
}

function statusBadgeClass(status?: string): string {
  switch (status) {
    case 'active':
      return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
    case 'draft':
      return 'bg-muted text-muted-foreground border-transparent';
    case 'archived':
      return 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20';
    case 'pending_review':
      return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    case 'suspended':
      return 'bg-red-500/10 text-red-600 border-red-500/20';
    default:
      return 'bg-muted text-muted-foreground border-transparent';
  }
}

// ─── Usage references ─────────────────────────────────────────────────────────
// Map a `usage.references[]` entry (any entity type / slot) to an icon + label
// so files backing a logo, banner, avatar or ticket read as "used" too — not
// just catalog media. Falls back to a generic row for a future entity type.

function describeReference(ref: FileReference): { Icon: typeof Package; typeLabelKey: TranslationKey } {
  // The visual slot (field) wins for branding-style attachments, since that is
  // what the vendor recognises ("Store logo") over the raw entity type.
  switch (ref.field) {
    case 'avatar':
      return { Icon: UserCircle, typeLabelKey: 'media.references.avatar' };
    case 'logo':
      return { Icon: Store, typeLabelKey: 'media.references.logo' };
    case 'banner':
    case 'cover':
      return {
        Icon: ImageIcon,
        typeLabelKey: ref.field === 'cover' ? 'media.references.cover' : 'media.references.banner',
      };
    case 'attachment':
      return { Icon: Paperclip, typeLabelKey: 'media.references.attachment' };
  }
  switch (ref.entityType) {
    case 'product':
      return { Icon: Package, typeLabelKey: 'media.references.product' };
    case 'variant':
      return { Icon: Tag, typeLabelKey: 'media.references.variant' };
    case 'digital_asset':
      return { Icon: FileDown, typeLabelKey: 'media.references.digitalAsset' };
    case 'ticket':
      return { Icon: LifeBuoy, typeLabelKey: 'media.references.ticket' };
    case 'store':
      return { Icon: Store, typeLabelKey: 'media.references.store' };
    case 'vendor':
      return { Icon: UserCircle, typeLabelKey: 'media.references.vendor' };
    case 'agency':
      return { Icon: Building2, typeLabelKey: 'media.references.agency' };
    case 'customer':
      return { Icon: User, typeLabelKey: 'media.references.customer' };
    case 'agent':
      return { Icon: User, typeLabelKey: 'media.references.agent' };
    case 'admin':
      return { Icon: ShieldCheck, typeLabelKey: 'media.references.admin' };
    default:
      return { Icon: Link2, typeLabelKey: 'media.references.generic' };
  }
}

// Product-edit is the only in-app destination we can route to. References carry
// only the entity's own id, so for a variant/digital-asset we resolve its parent
// product from the legacy arrays (which still carry `productId`).
function referenceProductId(ref: FileReference, detail: ApiFileDetail): string | undefined {
  if (ref.entityType === 'product') return ref.entityId;
  if (ref.entityType === 'variant') {
    return detail.usage.variants.find((v) => v.id === ref.entityId)?.productId;
  }
  if (ref.entityType === 'digital_asset') {
    return detail.usage.digitalAssets.find((d) => d.id === ref.entityId)?.productId;
  }
  return undefined;
}

// ─── File artwork ─────────────────────────────────────────────────────────────

function FileArtwork({
  file,
  className,
  controls = false,
}: {
  file: ApiFile;
  className?: string;
  // When true (detail view) videos render a full player; otherwise they show the
  // poster frame with a play badge so a thumbnail still reads as a video.
  controls?: boolean;
}) {
  const kind = kindFromMime(file.mimeType);
  const Icon = kindIcon[kind];
  const [broken, setBroken] = useState(false);
  const url = resolveFileUrl(file);

  if (kind === 'image' && !broken) {
    return (
      <img
        src={url}
        alt={file.originalName ?? 'File'}
        loading="lazy"
        onError={() => setBroken(true)}
        className={cn('h-full w-full object-cover', className)}
        draggable={false}
      />
    );
  }

  if (kind === 'video' && !broken) {
    if (controls) {
      return (
        <video
          src={url}
          controls
          preload="metadata"
          playsInline
          onError={() => setBroken(true)}
          className={cn('h-full w-full bg-black object-contain', className)}
        />
      );
    }
    return (
      <div className={cn('relative h-full w-full bg-black', className)}>
        <video
          src={url}
          muted
          preload="metadata"
          playsInline
          onError={() => setBroken(true)}
          className="h-full w-full object-cover"
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="rounded-full bg-black/55 p-2 text-white backdrop-blur-sm">
            <Play className="h-5 w-5" />
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex h-full w-full items-center justify-center', className)}>
      <div className={cn('rounded-xl p-4', kindTint[kind])}>
        <Icon className="h-8 w-8" />
      </div>
    </div>
  );
}

// Rich preview for the inspector: images and videos play inline, audio gets a
// player, and documents/other hand off to the browser in a new tab (e.g. PDFs).
function FilePreview({ file }: { file: ApiFile }) {
  const { t } = useTranslation();
  const kind = kindFromMime(file.mimeType);
  const url = resolveFileUrl(file);

  if (kind === 'image' || kind === 'video') {
    return <FileArtwork file={file} controls />;
  }

  if (kind === 'audio') {
    const Icon = kindIcon.audio;
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-6">
        <div className={cn('rounded-xl p-4', kindTint.audio)}>
          <Icon className="h-8 w-8" />
        </div>
        <audio src={url} controls className="w-full max-w-sm" />
      </div>
    );
  }

  const Icon = kindIcon[kind];
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="group flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center transition-colors hover:bg-muted"
    >
      <div className={cn('rounded-xl p-4', kindTint[kind])}>
        <Icon className="h-8 w-8" />
      </div>
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
        <ExternalLink className="h-4 w-4" />
        {t('media.library.openInNewTab')}
      </span>
    </a>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

// Desktop list-state cache so returning to the Media tab restores what was
// loaded instead of refetching.
const MEDIA_DESKTOP_KEY = 'media-desktop';
interface MediaDesktopCache {
  files: ApiFile[];
  pagination: FilePagination | null;
  page: number;
  provider: StorageProvider | 'all';
  kind: FileKind | 'all';
  detailCache: Record<string, ApiFileDetail>;
  search: string;
  sortField: SortField;
  sortAsc: boolean;
  viewMode: 'grid' | 'list';
}

export function MediaGallery() {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const apiError = useApiError();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const isMobile = useIsMobile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Native only — nothing on the web ever opens it (CAPACITOR-PLAN.md → P4.3).
  const [sourceOpen, setSourceOpen] = useState(false);

  const dCache = getListCache<MediaDesktopCache>(MEDIA_DESKTOP_KEY);

  // Server-driven list state
  const [files, setFiles] = useState<ApiFile[]>(dCache?.files ?? []);
  const [pagination, setPagination] = useState<FilePagination | null>(dCache?.pagination ?? null);
  const [page, setPage] = useState(dCache?.page ?? 1);
  const [provider, setProvider] = useState<StorageProvider | 'all'>(dCache?.provider ?? 'all');
  const [kind, setKind] = useState<FileKind | 'all'>(dCache?.kind ?? 'all');
  const [loading, setLoading] = useState(!dCache);

  // Account-wide storage usage + plan limit, embedded in the file listing.
  const [storage, setStorage] = useState<StorageUsage | null>(null);
  /** Which file is being fetched, so only its own menu row spins. */
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Reference-based enrichment cache (the source of attachment truth)
  const [detailCache, setDetailCache] = useState<Record<string, ApiFileDetail>>(dCache?.detailCache ?? {});

  // Client-side view controls
  const [search, setSearch] = useState(dCache?.search ?? '');
  const [sortField, setSortField] = useState<SortField>(dCache?.sortField ?? 'date');
  const [sortAsc, setSortAsc] = useState(dCache?.sortAsc ?? false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(dCache?.viewMode ?? 'grid');

  // Inspector
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [inspectId, setInspectId] = useState<string | null>(null);

  // Upload
  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [uploadLabel, setUploadLabel] = useState('');
  const [dragActive, setDragActive] = useState(false);

  // Backend filters by broad `category` (image/video/audio/document); the
  // `mimeType` param is an EXACT match, so a prefix like "image/" matches nothing.
  const activeCategory = kind === 'all' ? undefined : categoryFromKind(kind);

  const loadPage = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listFiles({
        page,
        limit: PAGE_LIMIT,
        category: activeCategory,
        provider: provider === 'all' ? undefined : provider,
      });
      setFiles(res.files);
      setPagination(res.pagination);
      if (res.storage) setStorage(res.storage);
      // Enrich the page with usage references for attachment status.
      const missing = res.files.map((f) => f.id);
      if (missing.length > 0) {
        const map = await getFilesUsage(missing);
        setDetailCache((prev) => ({ ...prev, ...map }));
      }
    } catch (err) {
      apiError.toast(err, { fallbackKey: 'media.errors.loadFailed' });
    } finally {
      setLoading(false);
    }
  }, [page, activeCategory, provider, apiError]);

  useScrollRestoration('media');

  // Desktop uses page-based pagination; mobile uses infinite scroll below.
  // Skip the first load if we restored a cached list (no reload on return).
  const desktopInit = useRef(false);
  useEffect(() => {
    if (isMobile) return;
    if (!desktopInit.current) {
      desktopInit.current = true;
      if (dCache) return;
    }
    loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadPage, isMobile]);

  // Reset to page 1 whenever a server-side filter changes (skip the first run so
  // a restored filter doesn't reset paging on return).
  const filterInit = useRef(false);
  useEffect(() => {
    if (!filterInit.current) {
      filterInit.current = true;
      return;
    }
    setPage(1);
  }, [provider, kind]);

  // Persist the desktop list + filters so a remount can restore them.
  useEffect(() => {
    if (isMobile) return;
    setListCache<MediaDesktopCache>(MEDIA_DESKTOP_KEY, {
      files, pagination, page, provider, kind, detailCache, search, sortField, sortAsc, viewMode,
    });
  }, [isMobile, files, pagination, page, provider, kind, detailCache, search, sortField, sortAsc, viewMode]);

  // Mobile infinite scroll (enriches each page with usage references too).
  const fetchMediaPage = useCallback(
    async (pageArg: number, limit: number) => {
      const res = await listFiles({
        page: pageArg,
        limit,
        category: activeCategory,
        provider: provider === 'all' ? undefined : provider,
      });
      if (res.storage) setStorage(res.storage);
      const ids = res.files.map((f) => f.id);
      if (ids.length > 0) {
        try {
          const map = await getFilesUsage(ids);
          setDetailCache((prev) => ({ ...prev, ...map }));
        } catch {
          /* enrichment is best-effort */
        }
      }
      return {
        items: res.files,
        total: res.pagination.total,
        totalPages: res.pagination.pages,
      };
    },
    [activeCategory, provider],
  );

  const infinite = useInfiniteList<ApiFile>({
    fetchPage: fetchMediaPage,
    rowHeight: 140,
    enabled: isMobile,
    deps: [activeCategory, provider],
    cacheKey: 'media',
  });

  // Single source of truth for the rendered list (mobile accumulates pages).
  const sourceFiles = isMobile ? infinite.items : files;

  // ─── Derived (client-side search + sort) ───────────────────────────────────

  const visibleFiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? sourceFiles.filter(
        (f) =>
          (f.originalName ?? '').toLowerCase().includes(q) ||
          f.mimeType.toLowerCase().includes(q),
      )
      : sourceFiles;
    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') {
        cmp = (a.originalName ?? '').localeCompare(b.originalName ?? '');
      } else if (sortField === 'size') {
        cmp = a.size - b.size;
      } else {
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return sortAsc ? cmp : -cmp;
    });
    return sorted;
  }, [sourceFiles, search, sortField, sortAsc]);

  const pageStats = useMemo(() => {
    let attached = 0;
    let unused = 0;
    let resolved = 0;
    let bytes = 0;
    for (const f of files) {
      bytes += f.size;
      const d = detailCache[f.id];
      if (d) {
        resolved += 1;
        if (d.usage.totalReferences > 0) attached += 1;
        else unused += 1;
      }
    }
    return { attached, unused, resolved, bytes };
  }, [files, detailCache]);

  const inspectDetail = inspectId ? detailCache[inspectId] ?? null : null;

  // ─── Upload ────────────────────────────────────────────────────────────────

  const handleFiles = useCallback(
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
      setUploadLabel(arr.length === 1 ? arr[0].name : t('media.library.fileCount', { count: arr.length }));
      try {
        await uploadMediaWithProgress(arr, setUploadPercent);
        toast.success(t('media.library.uploaded', { count: arr.length }));
        if (isMobile) infinite.reload();
        else if (page !== 1) setPage(1);
        else await loadPage();
      } catch (err) {
        toast.error(getUploadErrorMessage(err, arr));
      } finally {
        setUploading(false);
        setUploadPercent(0);
        setUploadLabel('');
      }
    },
    [page, loadPage, isMobile, infinite, t],
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  };

  // On a device every Upload affordance on this page — the mobile header icon,
  // the desktop button and the empty state — opens the source sheet (camera /
  // library / files) instead of the system file chooser. On the web all three
  // are the same click on the same hidden input they always were (P4.3).
  const requestUpload = () => {
    if (nativeMediaAvailable) setSourceOpen(true);
    else fileInputRef.current?.click();
  };

  // ─── Inspect / mutate ──────────────────────────────────────────────────────

  const openInspector = useCallback(
    async (id: string) => {
      setInspectId(id);
      if (!detailCache[id]) {
        try {
          const detail = await getFile(id);
          setDetailCache((prev) => ({ ...prev, [id]: detail }));
        } catch (err) {
          apiError.toast(err, { fallbackKey: 'media.errors.loadDetailFailed' });
        }
      }
    },
    [detailCache, apiError],
  );

  const handleRename = useCallback(async (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await updateFileName(id, trimmed);
      setFiles((prev) =>
        prev.map((f) => (f.id === id ? { ...f, originalName: trimmed } : f)),
      );
      setDetailCache((prev) =>
        prev[id] ? { ...prev, [id]: { ...prev[id], originalName: trimmed } } : prev,
      );
      if (isMobile) infinite.reload();
      toast.success(t('media.toast.renamed'));
    } catch (err) {
      apiError.toast(err, { fallbackKey: 'media.errors.renameFailed' });
    }
  }, [isMobile, infinite, t, apiError]);

  /**
   * Save a library file to the device (CAPACITOR-PLAN.md → P4.6).
   *
   * The Media library is this app's file manager, and until now the only thing
   * it could do with a file was open it in a tab. Unlike the ticket attachment
   * button — which keeps the web's own `<a download>` because that path already
   * worked there — this affordance is new on both platforms, so both take the
   * same route through `platform/filesystem.ts`.
   *
   * `originalName` is what the vendor uploaded it as; a file whose name the API
   * did not keep falls back to the storage key's basename rather than an opaque
   * id, so the saved file is still recognisable.
   */
  const handleDownload = useCallback(
    async (file: ApiFile) => {
      setDownloadingId(file.id);
      try {
        const outcome = await downloadFile({
          url: resolveFileUrl(file),
          fileName: file.originalName ?? file.key.split('/').pop() ?? 'download',
        });
        // A dismissed share sheet is a decision, not a failure — say nothing.
        if (outcome === 'failed') toast.error(t('common.files.downloadFailed'));
      } finally {
        setDownloadingId(null);
      }
    },
    [t],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const detail = detailCache[id];
      if (detail && detail.usage.totalReferences > 0) {
        toast.error(t('media.errors.detachFirst'));
        return;
      }
      if (!confirm(t('media.details.deleteConfirm'))) return;
      const removed = files.find((f) => f.id === id);
      try {
        await deleteFile(id);
        setFiles((prev) => prev.filter((f) => f.id !== id));
        // Keep the usage bar in sync without a full re-list (desktop doesn't reload).
        if (removed) {
          setStorage((prev) =>
            prev
              ? {
                  ...prev,
                  usedBytes: Math.max(0, prev.usedBytes - removed.size),
                  remainingBytes:
                    prev.remainingBytes !== null
                      ? prev.remainingBytes + removed.size
                      : null,
                }
              : prev,
          );
        }
        setDetailCache((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        if (inspectId === id) setInspectId(null);
        if (isMobile) infinite.reload();
        toast.success(t('media.toast.fileDeleted'));
      } catch (err) {
        // `CATALOG_FILE_STILL_REFERENCED`, not any 409: the entities holding the
        // file are in `details.usage`, and matching on the status alone would
        // also swallow an unrelated conflict under the wrong message.
        if (err instanceof ApiError && err.isFileStillReferenced) {
          toast.error(t('media.errors.stillReferenced'));
        } else {
          apiError.toast(err, { fallbackKey: 'media.errors.deleteFailed' });
        }
      }
    },
    [files, detailCache, inspectId, isMobile, infinite, t, apiError],
  );

  // ─── Render helpers ──────────────────────────────────────────────────────────

  const StatusChip = ({ fileId }: { fileId: string }) => {
    const d = detailCache[fileId];
    if (!d) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-background/80 px-2 py-0.5 text-[11px] text-muted-foreground backdrop-blur">
          <Loader2 className="h-3 w-3 animate-spin" />
        </span>
      );
    }
    const n = d.usage.totalReferences;
    return n > 0 ? (
      <Badge className="gap-1 bg-primary text-primary-foreground text-[11px]">
        <Link2 className="h-3 w-3" />
        {n}
      </Badge>
    ) : (
      <Badge variant="secondary" className="text-[11px]">
        {t('media.library.unused')}
      </Badge>
    );
  };

  const totalCount = isMobile ? infinite.total : (pagination?.total ?? files.length);
  const listLoading = isMobile ? infinite.loading : loading;

  // ── Search + filters (identical on desktop and mobile) ─────────────────────
  const sortValue = `${sortField}:${sortAsc ? 'asc' : 'desc'}`;
  const activeFilterCount =
    (kind !== 'all' ? 1 : 0) + (provider !== 'all' ? 1 : 0) + (sortValue !== 'date:desc' ? 1 : 0);

  const clearFilters = () => {
    setKind('all');
    setProvider('all');
    setSortField('date');
    setSortAsc(false);
    setPage(1);
  };

  const filterChips: ActiveFilterChip[] = [];
  if (kind !== 'all') {
    filterChips.push({
      key: 'kind',
      label: t('media.filters.chipType', {
        value: (() => {
          const match = KIND_FILTERS.find((k) => k.value === kind);
          return match ? t(match.labelKey) : kind;
        })(),
      }),
      onRemove: () => { setKind('all'); setPage(1); },
    });
  }
  if (provider !== 'all') {
    filterChips.push({
      key: 'provider',
      label: t('media.filters.chipProvider', { value: provider.toUpperCase() }),
      onRemove: () => { setProvider('all'); setPage(1); },
    });
  }
  if (sortValue !== 'date:desc') {
    filterChips.push({
      key: 'sort',
      label: t('media.filters.chipSort', {
        value: (() => {
          const match = SORT_OPTIONS.find((o) => o.value === sortValue);
          return match ? t(match.labelKey) : sortValue;
        })(),
      }),
      onRemove: () => { setSortField('date'); setSortAsc(false); },
    });
  }

  const viewToggle = (
    <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'grid' | 'list')}>
      <TabsList className="h-11 rounded-xl">
        <TabsTrigger value="grid" aria-label={t('media.library.gridView')}>
          <Grid3X3 className="h-4 w-4" />
        </TabsTrigger>
        <TabsTrigger value="list" aria-label={t('media.library.listView')}>
          <List className="h-4 w-4" />
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );

  const toolbar = (withViewToggle: boolean) => (
    <div className="space-y-3">
      <SearchFilterBar
        value={search}
        onChange={setSearch}
        placeholder={t('media.library.searchPlaceholder')}
        activeFilterCount={activeFilterCount}
        onOpenFilters={() => setFilterSheetOpen(true)}
        filterLabel={t('media.filters.open')}
        trailing={withViewToggle ? viewToggle : undefined}
      />
      <ActiveFilterChips chips={filterChips} onClearAll={clearFilters} />
    </div>
  );

  const filterSheet = (
    <FilterSheet
      open={filterSheetOpen}
      onOpenChange={setFilterSheetOpen}
      title={t('media.filters.title')}
      activeCount={activeFilterCount}
      onClear={clearFilters}
      applyLabel={t('media.filters.apply')}
    >
      <FilterSection title={t('media.filters.fileType')}>
        <FilterChips
          options={KIND_FILTERS}
          value={kind === 'all' ? undefined : kind}
          onChange={(v) => { setKind(v ?? 'all'); setPage(1); }}
        />
      </FilterSection>

      <FilterSection title={t('media.filters.storageProvider')}>
        <FilterChips
          options={PROVIDERS.map((p) => ({ value: p, label: p.toUpperCase() }))}
          value={provider === 'all' ? undefined : provider}
          onChange={(v) => { setProvider(v ?? 'all'); setPage(1); }}
          allLabel={t('media.filters.allProviders')}
        />
      </FilterSection>

      <FilterSection title={t('media.filters.sortBy')}>
        <FilterChips
          options={SORT_OPTIONS}
          value={sortValue}
          onChange={(v) => {
            const [field, dir] = (v ?? 'date:desc').split(':') as [SortField, 'asc' | 'desc'];
            setSortField(field);
            setSortAsc(dir === 'asc');
          }}
          hideAll
        />
      </FilterSection>
    </FilterSheet>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={cn('animate-fade-in', isMobile ? '-mx-6 -mt-6 pb-28' : 'space-y-6')}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setDragActive(false);
        }}
        onDrop={onDrop}
      >
        {/* Always-available file picker */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={onInputChange}
        />
        <UploadSourceSheet
          open={sourceOpen}
          onOpenChange={setSourceOpen}
          onPicked={handleFiles}
          onBrowseFiles={() => fileInputRef.current?.click()}
          multiple
          // The same ceiling `validateMediaSelection` enforces, applied at the
          // point of selection so the vendor is stopped by the picker rather
          // than by an error after choosing twelve photos.
          limit={MAX_FILES_PER_UPLOAD}
          allowVideo
        />

        {/* Mobile sticky header */}
        {isMobile && (
          <MobilePageHeader
            title={t('media.library.titleShort')}
            description={t('media.library.description')}
            actions={[
              {
                id: 'upload',
                icon: Upload,
                label: t('media.library.upload'),
                onClick: requestUpload,
                busy: uploading,
              },
            ]}
            subheader={toolbar(false)}
          />
        )}

        {/* Desktop header */}
        {!isMobile && (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{t('media.title')}</h1>
              <p className="text-muted-foreground">{t('media.library.description')}</p>
            </div>
            <Button onClick={requestUpload} disabled={uploading} className="gap-2">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {t('media.library.upload')}
            </Button>
          </div>
        )}

        {/* Upload progress */}
        {uploading && (
          <Card className={cn(isMobile && 'mx-4')}>
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium truncate">{t('media.library.uploadingFile', { name: uploadLabel })}</span>
                <span className="text-muted-foreground">{uploadPercent}%</span>
              </div>
              <Progress value={uploadPercent} className="h-2" />
            </CardContent>
          </Card>
        )}

        {/* Overview (desktop only) */}
        {!isMobile && (
          <MediaOverview
            storage={storage}
            fallbackBytes={pageStats.bytes}
            totalCount={totalCount}
            stats={pageStats}
          />
        )}

        {/* Storage meter (mobile) */}
        {isMobile && storage && storage.limitBytes !== null && (
          <div className="px-4 pt-3">
            <MobileStorageMeter storage={storage} />
          </div>
        )}

        {/* Toolbar (desktop only — mobile uses the sticky subheader) */}
        {!isMobile && toolbar(true)}

        {filterSheet}

        {/* Main: library + persistent inspector (desktop) */}
        <div className={cn('grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]', isMobile && 'px-4 pt-3')}>
          <div className="min-w-0">
            {listLoading ? (
              <LibrarySkeleton viewMode={viewMode} />
            ) : visibleFiles.length === 0 ? (
              <EmptyState
                onUpload={requestUpload}
                hasFilters={!!search || kind !== 'all' || provider !== 'all'}
                onClear={() => {
                  setSearch('');
                  setKind('all');
                  setProvider('all');
                }}
              />
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                {visibleFiles.map((file) => {
                  const selected = inspectId === file.id;
                  return (
                    <button
                      key={file.id}
                      onClick={() => openInspector(file.id)}
                      className={cn(
                        'group relative overflow-hidden rounded-xl border bg-card text-left transition-all hover:shadow-md',
                        selected && 'ring-2 ring-primary',
                      )}
                    >
                      <div className="relative aspect-square bg-muted">
                        <FileArtwork file={file} />
                        <div className="absolute right-2 top-2">
                          <StatusChip fileId={file.id} />
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                          <span className="rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-black">
                            {t('media.library.inspect')}
                          </span>
                        </div>
                      </div>
                      <div className="p-3">
                        <p className="truncate text-sm font-medium">
                          {file.originalName ?? t('media.details.untitled')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {fmt.fileSize(file.size)} · {fmt.date(file.createdAt)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {visibleFiles.map((file) => {
                      const selected = inspectId === file.id;
                      return (
                        <div
                          key={file.id}
                          onClick={() => openInspector(file.id)}
                          className={cn(
                            'flex cursor-pointer items-center gap-3 p-3 transition-colors hover:bg-muted/50',
                            selected && 'bg-primary/5',
                          )}
                        >
                          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-md border bg-muted">
                            <FileArtwork file={file} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {file.originalName ?? t('media.details.untitled')}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {t(KIND_FILTERS.find((k) => k.value === kindFromMime(file.mimeType))!.labelKey)}
                              {' · '}
                              {fmt.fileSize(file.size)} · {fmt.date(file.createdAt)}
                            </p>
                          </div>
                          <StatusChip fileId={file.id} />
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openInspector(file.id); }}>
                                <Link2 className="mr-2 h-4 w-4" />
                                {t('media.library.inspect')}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={downloadingId === file.id}
                                onClick={(e) => { e.stopPropagation(); void handleDownload(file); }}
                              >
                                {downloadingId === file.id ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <FileDown className="mr-2 h-4 w-4" />
                                )}
                                {t('common.actions.download')}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={(e) => { e.stopPropagation(); handleDelete(file.id); }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                {t('common.actions.delete')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Desktop pagination */}
            {!isMobile && pagination && pagination.pages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {t('common.pagination.pageOf', { page: pagination.page, total: pagination.pages })}
                  {' · '}
                  {t('media.library.onThisPage', { count: visibleFiles.length })}
                  {' · '}
                  {t('media.picker.totalFiles', { count: pagination.total })}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    {t('common.pagination.previous')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= pagination.pages || loading}
                    onClick={() => setPage((p) => p + 1)}
                    className="gap-1"
                  >
                    {t('common.pagination.next')}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Mobile infinite-scroll sentinel */}
            {isMobile && visibleFiles.length > 0 && (
              <>
                <div ref={infinite.sentinelRef} className="h-1" />
                {infinite.loadingMore && (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                )}
              </>
            )}
          </div>

          {/* Persistent inspector (desktop only) */}
          {isDesktop && (
            <aside className="sticky top-6 hidden h-fit lg:block">
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  {inspectId ? (
                    <InspectorBody
                      fileId={inspectId}
                      file={sourceFiles.find((f) => f.id === inspectId)}
                      detail={inspectDetail}
                      onRename={handleRename}
                      onDelete={handleDelete}
                      onNavigate={(productId) => navigate(`/dashboard/product-edit/${productId}`)}
                      onClose={() => setInspectId(null)}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
                      <div className="rounded-full bg-muted p-4">
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {t('media.library.selectFileHint')}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </aside>
          )}
        </div>

        {/* Inspector as slide-over (mobile) */}
        {!isDesktop && (
          <Sheet open={!!inspectId} onOpenChange={(o) => !o && setInspectId(null)}>
            <SheetContent
              side="bottom"
              className="h-[90vh] p-0 rounded-t-2xl [&>button]:top-4 [&>button]:right-3"
            >
              <SheetHeader className="border-b p-4 pr-12">
                <SheetTitle>{t('media.details.title')}</SheetTitle>
              </SheetHeader>
              {inspectId && (
                <SheetBody>
                  <InspectorBody
                    fileId={inspectId}
                    file={files.find((f) => f.id === inspectId)}
                    detail={inspectDetail}
                    onRename={handleRename}
                    onDelete={handleDelete}
                    onNavigate={(productId) => {
                      setInspectId(null);
                      navigate(`/dashboard/product-edit/${productId}`);
                    }}
                    onClose={() => setInspectId(null)}
                    hideClose
                  />
                </SheetBody>
              )}
            </SheetContent>
          </Sheet>
        )}

        {/* Drag overlay */}
        {dragActive && (
          <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-primary/10 backdrop-blur-sm">
            <div className="rounded-2xl border-2 border-dashed border-primary bg-background px-10 py-8 text-center shadow-lg">
              <Upload className="mx-auto mb-3 h-10 w-10 text-primary" />
              <p className="text-lg font-semibold">{t('media.library.dropToUpload')}</p>
              <p className="text-sm text-muted-foreground">
                {t('media.upload.limits', { maxFiles: MAX_FILES_PER_UPLOAD })}
              </p>
            </div>
          </div>
        )}

        {isMobile && (
          <MobileListFooter shown={visibleFiles.length} total={totalCount} nounKey="common.units.files" />
        )}
      </div>
    </TooltipProvider>
  );
}

// ─── Overview strip ───────────────────────────────────────────────────────────
// One card instead of four stat tiles plus a full-width meter: the counters lead
// (that is what the vendor scans for) and the consumed volume still reads as a
// bar — just a hairline one sitting under the number it belongs to.

function usagePercentClass(pct: number): string {
  if (pct >= 90) return 'text-destructive';
  if (pct >= 80) return 'text-amber-600';
  return 'text-muted-foreground';
}

function MediaOverview({
  storage,
  fallbackBytes,
  totalCount,
  stats,
}: {
  storage: StorageUsage | null;
  /** Used when the backend omits account usage — sum of the loaded page. */
  fallbackBytes: number;
  totalCount: number;
  stats: { attached: number; unused: number; resolved: number };
}) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const hasLimit = !!storage && storage.limitBytes !== null;
  const pct = hasLimit ? storagePercent(storage.usedBytes, storage.limitBytes) : 0;
  const dash = t('common.labels.emptyValue');

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:gap-6">
        {/* Storage */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <HardDrive className="h-3.5 w-3.5" />
              {t('media.storageBar.label')}
            </span>
            {hasLimit && (
              <span className={cn('text-xs font-semibold tabular-nums', usagePercentClass(pct))}>
                {t('media.storageBar.percent', { percent: pct })}
              </span>
            )}
          </div>
          <p className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-semibold leading-none tabular-nums">
              {fmt.fileSize(storage ? storage.usedBytes : fallbackBytes)}
            </span>
            {hasLimit && (
              <span className="truncate text-xs text-muted-foreground">
                {t('media.storageBar.of', { limit: fmt.fileSize(storage.limitBytes ?? 0) })}
              </span>
            )}
          </p>
          {hasLimit && (
            <Progress
              value={pct}
              className="mt-2 h-1.5"
              indicatorClassName={storageBarColor(pct)}
            />
          )}
          {hasLimit && pct >= 80 && (
            <p className="mt-1.5 text-[11px] leading-tight text-muted-foreground">
              {t(pct >= 100 ? 'media.storageBar.full' : 'media.storageBar.nearlyFull')}
            </p>
          )}
        </div>

        <div className="hidden h-10 w-px shrink-0 bg-border md:block" />

        {/* Counters — attached/unused only cover the loaded page, hence the hint. */}
        <div className="flex shrink-0 items-center divide-x">
          <OverviewStat
            icon={Layers}
            label={t('media.library.stats.files')}
            value={String(totalCount)}
          />
          <OverviewStat
            icon={Link2}
            label={t('media.library.stats.attached')}
            value={stats.resolved ? String(stats.attached) : dash}
            hint={t('media.library.stats.pageScopeHint')}
          />
          <OverviewStat
            icon={Inbox}
            label={t('media.library.stats.unused')}
            value={stats.resolved ? String(stats.unused) : dash}
            hint={t('media.library.stats.pageScopeHint')}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function OverviewStat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Layers;
  label: string;
  value: string;
  hint?: string;
}) {
  const body = (
    <div className="px-3 first:pl-0 last:pr-0 sm:px-4">
      <p className="text-lg font-semibold leading-none tabular-nums">{value}</p>
      <p className="mt-1.5 flex items-center gap-1 whitespace-nowrap text-[11px] text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </p>
    </div>
  );
  if (!hint) return body;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{body}</TooltipTrigger>
      <TooltipContent side="bottom">{hint}</TooltipContent>
    </Tooltip>
  );
}

// Mobile keeps the meter only — one hairline row above the grid, no card chrome.
function MobileStorageMeter({ storage }: { storage: StorageUsage }) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const pct = storagePercent(storage.usedBytes, storage.limitBytes);
  return (
    <div className="flex items-center gap-2.5 rounded-xl border bg-card px-3 py-2.5">
      <HardDrive className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2 text-xs">
          <span className="truncate font-semibold tabular-nums">
            {fmt.fileSize(storage.usedBytes)}
            <span className="ml-1 font-normal text-muted-foreground">
              {t('media.storageBar.of', { limit: fmt.fileSize(storage.limitBytes ?? 0) })}
            </span>
          </span>
          <span className={cn('shrink-0 font-semibold tabular-nums', usagePercentClass(pct))}>
            {t('media.storageBar.percent', { percent: pct })}
          </span>
        </div>
        <Progress value={pct} className="mt-1.5 h-1" indicatorClassName={storageBarColor(pct)} />
      </div>
    </div>
  );
}

// ─── Inspector body ───────────────────────────────────────────────────────────

function InspectorBody({
  fileId,
  file,
  detail,
  onRename,
  onDelete,
  onNavigate,
  onClose,
  hideClose,
}: {
  fileId: string;
  file?: ApiFile;
  detail: ApiFileDetail | null;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onNavigate: (productId: string) => void;
  onClose: () => void;
  hideClose?: boolean;
}) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(file?.originalName ?? '');

  useEffect(() => {
    setEditing(false);
    setNameDraft(file?.originalName ?? detail?.originalName ?? '');
  }, [fileId, file?.originalName, detail?.originalName]);

  const display = file ?? detail;
  if (!display) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="aspect-video w-full rounded-lg" />
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  const kind = kindFromMime(display.mimeType);
  const attached = detail ? detail.usage.totalReferences > 0 : false;
  const loadingUsage = !detail;

  return (
    <div className="flex flex-col">
      {/* Preview */}
      <div className="relative aspect-video w-full bg-muted">
        <FilePreview file={display} />
        {!hideClose && (
          <Button
            variant="secondary"
            size="icon"
            className="absolute right-2 top-2 h-7 w-7"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="space-y-5 p-4">
        {/* Name + rename */}
        <div>
          {editing ? (
            <div className="flex items-center gap-2">
              <Input
                value={nameDraft}
                autoFocus
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onRename(fileId, nameDraft);
                    setEditing(false);
                  }
                  if (e.key === 'Escape') setEditing(false);
                }}
                className="h-8"
              />
              <Button
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => {
                  onRename(fileId, nameDraft);
                  setEditing(false);
                }}
              >
                <Check className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-2">
              <h3 className="break-words text-base font-semibold leading-tight">
                {display.originalName ?? t('media.details.untitled')}
              </h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => {
                  setNameDraft(display.originalName ?? '');
                  setEditing(true);
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        {/* Metadata */}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Meta label={t('media.details.fileType')} value={<span className="capitalize">{kind}</span>} />
          <Meta label={t('media.details.fileSize')} value={fmt.fileSize(display.size)} />
          <Meta label={t('media.details.mime')} value={<span className="break-all">{display.mimeType}</span>} />
          <Meta label={t('media.details.provider')} value={<span className="uppercase">{display.provider}</span>} />
          <Meta label={t('media.details.uploaded')} value={fmt.date(display.createdAt)} />
          <Meta
            label={t('media.details.references')}
            value={detail ? String(detail.usage.totalReferences) : '…'}
          />
          {detail?.checksum && (
            <div className="col-span-2">
              <dt className="text-xs text-muted-foreground">{t('media.details.checksum')}</dt>
              <dd className="break-all font-mono text-xs">{detail.checksum}</dd>
            </div>
          )}
        </dl>

        {/* Where used */}
        <div>
          <h4 className="mb-2 text-sm font-semibold">{t('media.details.whereUsed')}</h4>
          {loadingUsage ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : !attached ? (
            <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              {t('media.details.notAttached')}
            </div>
          ) : detail!.usage.references && detail!.usage.references.length > 0 ? (
            // Preferred: the full reference list (covers logo/banner/avatar/tickets).
            <div className="space-y-2">
              {detail!.usage.references.map((ref, i) => {
                const { Icon, typeLabelKey } = describeReference(ref);
                const productId = referenceProductId(ref, detail!);
                return (
                  <UsageRow
                    key={`${ref.entityType}-${ref.entityId}-${ref.field}-${i}`}
                    file={display}
                    icon={Icon}
                    typeLabelKey={typeLabelKey}
                    name={ref.label}
                    onOpen={productId ? () => onNavigate(productId) : undefined}
                  />
                );
              })}
            </div>
          ) : (
            // Legacy fallback: older backend without a `references` array.
            <div className="space-y-2">
              {detail!.usage.products.map((p) => (
                <UsageRow
                  key={`p-${p.id}`}
                  file={display}
                  icon={Package}
                  typeLabelKey="media.references.product"
                  name={p.title}
                  status={p.status}
                  onOpen={() => onNavigate(p.id)}
                />
              ))}
              {detail!.usage.variants.map((v) => (
                <UsageRow
                  key={`v-${v.id}`}
                  file={display}
                  icon={Tag}
                  typeLabelKey="media.references.variant"
                  name={v.sku}
                  status={v.status}
                  onOpen={() => onNavigate(v.productId)}
                />
              ))}
              {detail!.usage.digitalAssets.map((d) => (
                <UsageRow
                  key={`d-${d.id}`}
                  file={display}
                  icon={FileDown}
                  typeLabelKey="media.references.digitalAsset"
                  name={d.name ?? t('media.references.downloadableFile')}
                  status={d.status}
                  onOpen={d.productId ? () => onNavigate(d.productId!) : undefined}
                />
              ))}
            </div>
          )}
        </div>

        {/* Delete */}
        <div className="border-t pt-4">
          {attached ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="block">
                  <Button variant="outline" disabled className="w-full gap-2">
                    <Trash2 className="h-4 w-4" />
                    {t('common.actions.delete')}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">
                {t('media.details.deleteBlocked')}
              </TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="outline"
              onClick={() => onDelete(fileId)}
              disabled={loadingUsage}
              className="w-full gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              {t('media.details.deleteFile')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function UsageRow({
  file,
  icon: Icon,
  typeLabelKey,
  name,
  status,
  onOpen,
}: {
  file: ApiFile;
  icon: typeof Package;
  typeLabelKey: TranslationKey;
  name: string;
  status?: string;
  onOpen?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3 rounded-lg border p-2">
      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border bg-muted">
        <FileArtwork file={file} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {t(typeLabelKey)}
          </span>
        </div>
        <p className="truncate text-sm font-medium">{name}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {status && (
          <Badge variant="outline" className={cn('text-[11px] capitalize', statusBadgeClass(status))}>
            {status.replace('_', ' ')}
          </Badge>
        )}
        {onOpen && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onOpen}>
            <ExternalLink className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Skeleton / empty ─────────────────────────────────────────────────────────

function LibrarySkeleton({ viewMode }: { viewMode: 'grid' | 'list' }) {
  if (viewMode === 'list') {
    return (
      <Card>
        <CardContent className="space-y-3 p-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-11 w-11 rounded-md" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-xl border">
          <Skeleton className="aspect-square" />
          <div className="space-y-2 p-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  onUpload,
  hasFilters,
  onClear,
}: {
  onUpload: () => void;
  hasFilters: boolean;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
      <div className="mb-4 rounded-full bg-muted p-4">
        <ImageIcon className="h-10 w-10 text-muted-foreground" />
      </div>
      <p className="mb-1 font-medium">
        {t(hasFilters ? 'media.library.emptyFiltered' : 'media.library.emptyTitle')}
      </p>
      <p className="mb-4 max-w-sm text-sm text-muted-foreground">
        {t(hasFilters ? 'media.library.emptyFilteredHint' : 'media.library.emptyHint')}
      </p>
      {hasFilters ? (
        <Button variant="outline" onClick={onClear}>
          {t('media.library.clearFilters')}
        </Button>
      ) : (
        <Button onClick={onUpload} className="gap-2">
          <Upload className="h-4 w-4" />
          {t('media.library.uploadFiles')}
        </Button>
      )}
    </div>
  );
}
