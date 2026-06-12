// ─── Media Library ─────────────────────────────────────────────────────────────
// Enterprise, Spotify-style media manager driven entirely by the backend File
// Management Service (api-doc/vendor/file-management.md). Files are FLAT (no
// folders). A persistent inspector resolves exactly where each file is attached
// (product / variant / digital asset) from the `usage` references — never from
// `usageCount`.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { cn, formatFileSize } from '@/lib/utils';
import { ApiError } from '@/types/api';
import { getUploadErrorMessage } from '@/lib/uploadErrors';
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
} from '@/services/files.service';
import type {
  ApiFile,
  ApiFileDetail,
  FileKind,
  FilePagination,
  StorageProvider,
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

const KIND_FILTERS: { value: FileKind | 'all'; label: string; mime?: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'image', label: 'Images', mime: 'image/' },
  { value: 'video', label: 'Video', mime: 'video/' },
  { value: 'audio', label: 'Audio', mime: 'audio/' },
  { value: 'document', label: 'Documents', mime: 'application/' },
];

const PROVIDERS: StorageProvider[] = ['local', 's3', 'gcs', 'r2', 'firebase', 'cloudinary'];

type SortField = 'date' | 'name' | 'size';

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
        crossOrigin="use-credentials"
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
          crossOrigin="use-credentials"
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
          crossOrigin="use-credentials"
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
        <audio src={url} controls crossOrigin="use-credentials" className="w-full max-w-sm" />
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
        Open in new tab
      </span>
    </a>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MediaGallery() {
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Server-driven list state
  const [files, setFiles] = useState<ApiFile[]>([]);
  const [pagination, setPagination] = useState<FilePagination | null>(null);
  const [page, setPage] = useState(1);
  const [provider, setProvider] = useState<StorageProvider | 'all'>('all');
  const [kind, setKind] = useState<FileKind | 'all'>('all');
  const [loading, setLoading] = useState(true);

  // Reference-based enrichment cache (the source of attachment truth)
  const [detailCache, setDetailCache] = useState<Record<string, ApiFileDetail>>({});

  // Client-side view controls
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortAsc, setSortAsc] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Inspector
  const [inspectId, setInspectId] = useState<string | null>(null);

  // Upload
  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [uploadLabel, setUploadLabel] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const activeMime = KIND_FILTERS.find((k) => k.value === kind)?.mime;

  const loadPage = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listFiles({
        page,
        limit: PAGE_LIMIT,
        mimeType: activeMime,
        provider: provider === 'all' ? undefined : provider,
      });
      setFiles(res.files);
      setPagination(res.pagination);
      // Enrich the page with usage references for attachment status.
      const missing = res.files.map((f) => f.id);
      if (missing.length > 0) {
        const map = await getFilesUsage(missing);
        setDetailCache((prev) => ({ ...prev, ...map }));
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not load your media library.');
    } finally {
      setLoading(false);
    }
  }, [page, activeMime, provider]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  // Reset to page 1 whenever a server-side filter changes.
  useEffect(() => {
    setPage(1);
  }, [provider, kind]);

  // ─── Derived (client-side search + sort) ───────────────────────────────────

  const visibleFiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? files.filter(
        (f) =>
          (f.originalName ?? '').toLowerCase().includes(q) ||
          f.mimeType.toLowerCase().includes(q),
      )
      : files;
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
  }, [files, search, sortField, sortAsc]);

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
      setUploadLabel(arr.length === 1 ? arr[0].name : `${arr.length} files`);
      try {
        await uploadMediaWithProgress(arr, setUploadPercent);
        toast.success(`Uploaded ${arr.length} file${arr.length > 1 ? 's' : ''}.`);
        if (page !== 1) setPage(1);
        else await loadPage();
      } catch (err) {
        toast.error(getUploadErrorMessage(err, arr));
      } finally {
        setUploading(false);
        setUploadPercent(0);
        setUploadLabel('');
      }
    },
    [page, loadPage],
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

  // ─── Inspect / mutate ──────────────────────────────────────────────────────

  const openInspector = useCallback(
    async (id: string) => {
      setInspectId(id);
      if (!detailCache[id]) {
        try {
          const detail = await getFile(id);
          setDetailCache((prev) => ({ ...prev, [id]: detail }));
        } catch (err) {
          toast.error(err instanceof ApiError ? err.message : 'Could not load file details.');
        }
      }
    },
    [detailCache],
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
      toast.success('File renamed.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not rename file.');
    }
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      const detail = detailCache[id];
      if (detail && detail.usage.totalReferences > 0) {
        toast.error('Detach this file from its products and variants before deleting it.');
        return;
      }
      if (!confirm('Delete this file? This cannot be undone.')) return;
      try {
        await deleteFile(id);
        setFiles((prev) => prev.filter((f) => f.id !== id));
        setDetailCache((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        if (inspectId === id) setInspectId(null);
        toast.success('File deleted.');
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          toast.error('This file is still in use. Detach it from all products/variants first.');
        } else {
          toast.error(err instanceof ApiError ? err.message : 'Could not delete file.');
        }
      }
    },
    [detailCache, inspectId],
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
        Unused
      </Badge>
    );
  };

  const totalCount = pagination?.total ?? files.length;

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className="space-y-6 animate-fade-in"
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setDragActive(false);
        }}
        onDrop={onDrop}
      >
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Media Library</h1>
            <p className="text-muted-foreground">
              Manage every file you've uploaded and see exactly where each one is attached.
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={onInputChange}
          />
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="gap-2">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Upload
          </Button>
        </div>

        {/* Upload progress */}
        {uploading && (
          <Card>
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium truncate">Uploading {uploadLabel}…</span>
                <span className="text-muted-foreground">{uploadPercent}%</span>
              </div>
              <Progress value={uploadPercent} className="h-2" />
            </CardContent>
          </Card>
        )}

        {/* Overview */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={Layers} label="Total files" value={String(totalCount)} />
          <StatCard
            icon={HardDrive}
            label="Storage (page)"
            value={formatFileSize(pageStats.bytes)}
          />
          <StatCard
            icon={Link2}
            label="Attached (page)"
            value={pageStats.resolved ? String(pageStats.attached) : '—'}
          />
          <StatCard
            icon={Inbox}
            label="Unused (page)"
            value={pageStats.resolved ? String(pageStats.unused) : '—'}
          />
        </div>

        {/* Toolbar */}
        <Card>
          <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or type…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Kind chips (server mimeType filter) */}
              <div className="flex items-center gap-1 rounded-lg border p-1">
                {KIND_FILTERS.map((k) => (
                  <button
                    key={k.value}
                    onClick={() => setKind(k.value)}
                    className={cn(
                      'rounded-md px-2.5 py-1 text-sm transition-colors',
                      kind === k.value
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted',
                    )}
                  >
                    {k.label}
                  </button>
                ))}
              </div>

              <Select value={provider} onValueChange={(v) => setProvider(v as StorageProvider | 'all')}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All providers</SelectItem>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p} value={p} className="uppercase">
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={`${sortField}:${sortAsc ? 'asc' : 'desc'}`}
                onValueChange={(v) => {
                  const [field, dir] = v.split(':') as [SortField, 'asc' | 'desc'];
                  setSortField(field);
                  setSortAsc(dir === 'asc');
                }}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date:desc">Newest first</SelectItem>
                  <SelectItem value="date:asc">Oldest first</SelectItem>
                  <SelectItem value="name:asc">Name A–Z</SelectItem>
                  <SelectItem value="name:desc">Name Z–A</SelectItem>
                  <SelectItem value="size:desc">Largest first</SelectItem>
                  <SelectItem value="size:asc">Smallest first</SelectItem>
                </SelectContent>
              </Select>

              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'grid' | 'list')}>
                <TabsList>
                  <TabsTrigger value="grid">
                    <Grid3X3 className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger value="list">
                    <List className="h-4 w-4" />
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardContent>
        </Card>

        {/* Main: library + persistent inspector (desktop) */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0">
            {loading ? (
              <LibrarySkeleton viewMode={viewMode} />
            ) : visibleFiles.length === 0 ? (
              <EmptyState
                onUpload={() => fileInputRef.current?.click()}
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
                            Inspect
                          </span>
                        </div>
                      </div>
                      <div className="p-3">
                        <p className="truncate text-sm font-medium">
                          {file.originalName ?? 'Untitled'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(file.size)} ·{' '}
                          {new Date(file.createdAt).toLocaleDateString()}
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
                              {file.originalName ?? 'Untitled'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {kindFromMime(file.mimeType)} · {formatFileSize(file.size)} ·{' '}
                              {new Date(file.createdAt).toLocaleDateString()}
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
                                Inspect
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={(e) => { e.stopPropagation(); handleDelete(file.id); }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
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

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Page {pagination.page} of {pagination.pages} ·{' '}
                  {visibleFiles.length} on this page · {pagination.total} total
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
                    Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= pagination.pages || loading}
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

          {/* Persistent inspector (desktop only) */}
          {isDesktop && (
            <aside className="sticky top-6 hidden h-fit lg:block">
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  {inspectId ? (
                    <InspectorBody
                      fileId={inspectId}
                      file={files.find((f) => f.id === inspectId)}
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
                        Select a file to inspect its details and see where it's attached.
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
                <SheetTitle>File details</SheetTitle>
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
              <p className="text-lg font-semibold">Drop to upload</p>
              <p className="text-sm text-muted-foreground">Up to {MAX_FILES_PER_UPLOAD} files (500 MB each) or 3 videos (70 MB each)</p>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Layers;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
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
                {display.originalName ?? 'Untitled'}
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
          <Meta label="Type" value={<span className="capitalize">{kind}</span>} />
          <Meta label="Size" value={formatFileSize(display.size)} />
          <Meta label="MIME" value={<span className="break-all">{display.mimeType}</span>} />
          <Meta label="Provider" value={<span className="uppercase">{display.provider}</span>} />
          <Meta
            label="Uploaded"
            value={new Date(display.createdAt).toLocaleDateString()}
          />
          <Meta
            label="References"
            value={detail ? String(detail.usage.totalReferences) : '…'}
          />
          {detail?.checksum && (
            <div className="col-span-2">
              <dt className="text-xs text-muted-foreground">Checksum</dt>
              <dd className="break-all font-mono text-xs">{detail.checksum}</dd>
            </div>
          )}
        </dl>

        {/* Where used */}
        <div>
          <h4 className="mb-2 text-sm font-semibold">Where it's used</h4>
          {loadingUsage ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : !attached ? (
            <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              Not attached to anything. This file can be safely deleted.
            </div>
          ) : (
            <div className="space-y-2">
              {detail!.usage.products.map((p) => (
                <UsageRow
                  key={`p-${p.id}`}
                  file={display}
                  icon={Package}
                  typeLabel="Product"
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
                  typeLabel="Variant"
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
                  typeLabel="Digital asset"
                  name={d.name ?? 'Downloadable file'}
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
                    Delete
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">
                Detach this file from its products and variants before deleting.
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
              Delete file
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
  typeLabel,
  name,
  status,
  onOpen,
}: {
  file: ApiFile;
  icon: typeof Package;
  typeLabel: string;
  name: string;
  status?: string;
  onOpen?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-2">
      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border bg-muted">
        <FileArtwork file={file} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {typeLabel}
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
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
      <div className="mb-4 rounded-full bg-muted p-4">
        <ImageIcon className="h-10 w-10 text-muted-foreground" />
      </div>
      <p className="mb-1 font-medium">{hasFilters ? 'No files match your filters' : 'Your library is empty'}</p>
      <p className="mb-4 max-w-sm text-sm text-muted-foreground">
        {hasFilters
          ? 'Try clearing the search or filters to see more files.'
          : 'Upload images, videos, audio or documents to start building your library.'}
      </p>
      {hasFilters ? (
        <Button variant="outline" onClick={onClear}>
          Clear filters
        </Button>
      ) : (
        <Button onClick={onUpload} className="gap-2">
          <Upload className="h-4 w-4" />
          Upload files
        </Button>
      )}
    </div>
  );
}
