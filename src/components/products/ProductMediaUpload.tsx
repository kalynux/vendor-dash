import { useRef, useState, useCallback, useEffect } from 'react';
import { X, GripVertical, Upload, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ApiFileDetail } from '@/types/product.types';

// ─── Types ────────────────────────────────────────────────────────────────────

type MediaItem =
  | { kind: 'saved'; data: ApiFileDetail }
  | { kind: 'new'; objectUrl: string; file: File };

/** Passed back to the parent on every change — preserves full display order */
export type MediaOrderItem =
  | { kind: 'saved'; id: string }
  | { kind: 'new'; file: File };

interface ProductMediaUploadProps {
  existingFiles?: ApiFileDetail[];
  /** Called whenever the ordered media list changes (add / remove / reorder) */
  onMediaChange: (orderedItems: MediaOrderItem[]) => void;
  isUploading?: boolean;
  maxFiles?: number;
  disabled?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatMime(mime: string): string {
  const sub = mime.split('/')[1] ?? mime;
  return sub.replace(/[+-].*/, '').toUpperCase();
}

function toOrderItems(list: MediaItem[]): MediaOrderItem[] {
  return list.map((item) =>
    item.kind === 'saved'
      ? { kind: 'saved', id: item.data.id }
      : { kind: 'new', file: item.file },
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProductMediaUpload({
  existingFiles = [],
  onMediaChange,
  isUploading = false,
  maxFiles = 10,
  disabled = false,
}: ProductMediaUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const initializedRef = useRef(false);

  const [items, setItems] = useState<MediaItem[]>([]);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false); // file-drop zone highlight
  const [dragIndex, setDragIndex] = useState<number | null>(null); // item being dragged
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null); // hover target
  const [infoIndex, setInfoIndex] = useState<number | null>(null); // which card shows detail panel

  // Populate from existingFiles the first time they arrive (e.g. after async load)
  useEffect(() => {
    if (initializedRef.current || existingFiles.length === 0) return;
    initializedRef.current = true;
    const initial = existingFiles.map<MediaItem>((f) => ({ kind: 'saved', data: f }));
    setItems(initial);
    onMediaChange(toOrderItems(initial));
  }, [existingFiles]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── File addition ───────────────────────────────────────────────────────────

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      const arr = Array.from(incoming).filter((f) => f.type.startsWith('image/'));
      setItems((prev) => {
        const slots = maxFiles - prev.length;
        if (slots <= 0) return prev;
        const newItems: MediaItem[] = arr.slice(0, slots).map((file) => ({
          kind: 'new',
          objectUrl: URL.createObjectURL(file),
          file,
        }));
        const updated = [...prev, ...newItems];
        onMediaChange(toOrderItems(updated));
        return updated;
      });
    },
    [maxFiles, onMediaChange],
  );

  // ─── Removal ─────────────────────────────────────────────────────────────────

  const removeItem = useCallback(
    (index: number) => {
      setInfoIndex(null);
      setItems((prev) => {
        const item = prev[index];
        if (item.kind === 'new') URL.revokeObjectURL(item.objectUrl);
        const updated = prev.filter((_, i) => i !== index);
        onMediaChange(toOrderItems(updated));
        return updated;
      });
    },
    [onMediaChange],
  );

  // ─── Drop-zone events (external file import) ─────────────────────────────────

  const onZoneDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (dragIndex === null) setIsDraggingFiles(true); // only highlight for file drops
  };
  const onZoneDragLeave = () => setIsDraggingFiles(false);
  const onZoneDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFiles(false);
    if (!disabled && dragIndex === null) addFiles(e.dataTransfer.files);
  };

  // ─── Item drag-and-drop (reorder) ────────────────────────────────────────────

  const handleItemDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = 'move';
    // Required by some browsers to allow drop
    e.dataTransfer.setData('text/plain', String(index));
    setDragIndex(index);
    setInfoIndex(null);
  };

  const handleItemDragEnter = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleItemDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleItemDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    e.stopPropagation(); // don't let the file drop-zone catch this
    const from = dragIndex;
    if (from === null || from === dropIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    setItems((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(from, 1);
      updated.splice(dropIndex, 0, moved);
      onMediaChange(toOrderItems(updated));
      return updated;
    });
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleItemDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  const canAddMore = items.length < maxFiles;

  return (
    <div className="space-y-4">
      {/* Unified sorted grid */}
      {items.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
          {items.map((item, index) => {
            const isFirst = index === 0;
            const isSaved = item.kind === 'saved';
            const src = isSaved ? item.data.url : item.objectUrl;
            const name = isSaved ? (item.data.originalName ?? item.data.key) : item.file.name;
            const size = isSaved ? item.data.size : item.file.size;
            const mime = isSaved ? item.data.mimeType : item.file.type;
            const key = isSaved ? item.data.id : item.objectUrl;

            const isBeingDragged = dragIndex === index;
            const isDragTarget = dragOverIndex === index && dragIndex !== index;
            const showInfo = infoIndex === index;

            return (
              <div
                key={key}
                draggable={!disabled && !isUploading}
                onDragStart={(e) => handleItemDragStart(e, index)}
                onDragEnter={(e) => handleItemDragEnter(e, index)}
                onDragOver={handleItemDragOver}
                onDrop={(e) => handleItemDrop(e, index)}
                onDragEnd={handleItemDragEnd}
                className={cn(
                  'relative group aspect-square rounded-lg overflow-hidden border transition-all select-none',
                  'cursor-grab active:cursor-grabbing',
                  isBeingDragged && 'opacity-40 scale-95',
                  isDragTarget
                    ? 'border-primary ring-2 ring-primary/40 scale-[1.03]'
                    : 'border-border',
                  isSaved ? 'ring-1 ring-emerald-500/30' : '',
                )}
              >
                {/* Image */}
                <img
                  src={src}
                  alt={name}
                  crossOrigin={isSaved ? 'use-credentials' : undefined}
                  className="w-full h-full object-cover pointer-events-none"
                  draggable={false}
                />

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/35 transition-colors pointer-events-none" />

                {/* ── Info overlay (replaces image when active) ── */}
                {showInfo && (
                  <div
                    className="absolute inset-0 bg-black/85 flex flex-col justify-center gap-1 px-2 z-20 cursor-pointer"
                    onClick={() => setInfoIndex(null)}
                  >
                    <p className="text-white text-[10px] font-semibold truncate leading-tight">{name}</p>
                    <p className="text-white/70 text-[10px]">{formatSize(size)}</p>
                    <p className="text-white/70 text-[10px]">{formatMime(mime)}</p>
                    {isSaved && (
                      <p className="text-white/50 text-[10px] truncate">ID: {item.data.id.slice(0, 8)}…</p>
                    )}
                    <p className="text-white/40 text-[9px] mt-1">Tap to close</p>
                  </div>
                )}

                {/* ── Thumbnail badge (first image) ── */}
                {isFirst && (
                  <div className="absolute top-1 left-1 bg-primary text-primary-foreground text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none shadow">
                    Thumbnail
                  </div>
                )}

                {/* ── Saved / New badge ── */}
                <div
                  className={cn(
                    'absolute bottom-1 left-1 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-full leading-none shadow',
                    isSaved ? 'bg-emerald-600/90' : 'bg-blue-600/90',
                  )}
                >
                  {isSaved ? 'Saved' : 'New'}
                </div>

                {/* ── Controls (visible on hover, hidden when info is open) ── */}
                {!showInfo && (
                  <>
                    {/* Delete */}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeItem(index); }}
                      disabled={disabled || isUploading}
                      className="absolute top-1 right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow z-10"
                    >
                      <X className="w-3 h-3" />
                    </button>

                    {/* Info */}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setInfoIndex(index); }}
                      className="absolute bottom-1 right-1 w-5 h-5 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow z-10"
                    >
                      <Info className="w-3 h-3" />
                    </button>

                    {/* Grip indicator (centre) */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-50 transition-opacity pointer-events-none">
                      <GripVertical className="w-6 h-6 text-white drop-shadow-md" />
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* File drop zone */}
      {canAddMore && (
        <div
          onDragOver={onZoneDragOver}
          onDragLeave={onZoneDragLeave}
          onDrop={onZoneDrop}
          onClick={() => !disabled && !isUploading && inputRef.current?.click()}
          className={cn(
            'border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all',
            isDraggingFiles
              ? 'border-primary bg-primary/5 scale-[1.01]'
              : 'border-border hover:border-primary/50 hover:bg-muted/50',
            (disabled || isUploading) && 'opacity-50 cursor-not-allowed pointer-events-none',
          )}
        >
          {isUploading ? (
            <>
              <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <p className="text-sm text-muted-foreground">Uploading…</p>
            </>
          ) : (
            <>
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <Upload className="w-6 h-6 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">
                  {isDraggingFiles ? 'Drop images here' : 'Drag & drop or click to upload'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Images only · max {maxFiles} · {maxFiles - items.length} remaining · drag cards above to reorder
                </p>
              </div>
            </>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(e) => e.target.files && addFiles(e.target.files)}
      />
    </div>
  );
}
