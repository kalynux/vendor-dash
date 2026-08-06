import { useState, useCallback, useEffect } from 'react';
import { X, GripVertical, ImagePlus, Info, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MediaPicker } from '@/components/features/MediaPicker';
import { useFormatters, useTranslation } from '@/i18n';
import { resolveFileUrl } from '@/services/files.service';
import type { ApiFile } from '@/types/file.types';
import type { ApiFileDetail } from '@/types/product.types';

// ─── Types ────────────────────────────────────────────────────────────────────

// A normalized, display-ready file used by the gallery. Both already-attached
// product files and freshly picked library files reduce to this shape.
interface GalleryFile {
  id: string;
  url: string;
  name: string;
  size: number;
  mime: string;
}

interface ProductMediaUploadProps {
  existingFiles?: ApiFileDetail[];
  /** Called whenever the ordered file list changes (add / remove / reorder). */
  onMediaChange: (orderedFileIds: string[]) => void;
  isUploading?: boolean;
  maxFiles?: number;
  disabled?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMime(mime: string): string {
  const sub = mime.split('/')[1] ?? mime;
  return sub.replace(/[+-].*/, '').toUpperCase();
}

function fromDetail(f: ApiFileDetail): GalleryFile {
  return { id: f.id, url: f.url, name: f.originalName ?? f.key, size: f.size, mime: f.mimeType };
}

function fromApiFile(f: ApiFile): GalleryFile {
  return {
    id: f.id,
    url: resolveFileUrl(f),
    name: f.originalName ?? f.key,
    size: f.size,
    mime: f.mimeType,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProductMediaUpload({
  existingFiles = [],
  onMediaChange,
  isUploading = false,
  maxFiles = 10,
  disabled = false,
}: ProductMediaUploadProps) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const [items, setItems] = useState<GalleryFile[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [infoIndex, setInfoIndex] = useState<number | null>(null);

  // Populate from existingFiles the first time they arrive (e.g. after async load).
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (initialized || existingFiles.length === 0) return;
    setInitialized(true);
    const initial = existingFiles.map(fromDetail);
    setItems(initial);
    onMediaChange(initial.map((f) => f.id));
  }, [existingFiles, initialized, onMediaChange]);

  const commit = useCallback(
    (next: GalleryFile[]) => {
      setItems(next);
      onMediaChange(next.map((f) => f.id));
    },
    [onMediaChange],
  );

  // ─── Add (via picker) ────────────────────────────────────────────────────────

  const handlePicked = useCallback(
    (picked: ApiFile[]) => {
      setItems((prev) => {
        const existingIds = new Set(prev.map((f) => f.id));
        const additions = picked
          .filter((f) => !existingIds.has(f.id))
          .map(fromApiFile)
          .slice(0, Math.max(0, maxFiles - prev.length));
        const next = [...prev, ...additions];
        onMediaChange(next.map((f) => f.id));
        return next;
      });
    },
    [maxFiles, onMediaChange],
  );

  // ─── Removal ─────────────────────────────────────────────────────────────────

  const removeItem = useCallback(
    (index: number) => {
      setInfoIndex(null);
      commit(items.filter((_, i) => i !== index));
    },
    [items, commit],
  );

  // ─── Drag-and-drop reorder ─────────────────────────────────────────────────────

  const handleItemDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    setDragIndex(index);
    setInfoIndex(null);
  };

  const handleItemDragEnter = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== index) setDragOverIndex(index);
  };

  const handleItemDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleItemDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const from = dragIndex;
    if (from === null || from === dropIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const updated = [...items];
    const [moved] = updated.splice(from, 1);
    updated.splice(dropIndex, 0, moved);
    commit(updated);
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleItemDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  const canAddMore = items.length < maxFiles;
  const interactive = !disabled && !isUploading;

  return (
    <div className="space-y-4">
      {/* Ordered grid */}
      {items.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {items.map((item, index) => {
            const isFirst = index === 0;
            const isBeingDragged = dragIndex === index;
            const isDragTarget = dragOverIndex === index && dragIndex !== index;
            const showInfo = infoIndex === index;

            return (
              <div
                key={item.id}
                draggable={interactive}
                onDragStart={(e) => handleItemDragStart(e, index)}
                onDragEnter={(e) => handleItemDragEnter(e, index)}
                onDragOver={handleItemDragOver}
                onDrop={(e) => handleItemDrop(e, index)}
                onDragEnd={handleItemDragEnd}
                className={cn(
                  'group relative aspect-square select-none overflow-hidden rounded-lg border transition-all',
                  'cursor-grab active:cursor-grabbing',
                  isBeingDragged && 'scale-95 opacity-40',
                  isDragTarget ? 'scale-[1.03] border-primary ring-2 ring-primary/40' : 'border-border',
                )}
              >
                <img
                  src={item.url}
                  alt={item.name}
                  crossOrigin="use-credentials"
                  className="pointer-events-none h-full w-full object-cover"
                  draggable={false}
                />

                <div className="pointer-events-none absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/35" />

                {showInfo && (
                  <div
                    className="absolute inset-0 z-20 flex cursor-pointer flex-col justify-center gap-1 bg-black/85 px-2"
                    onClick={() => setInfoIndex(null)}
                  >
                    <p className="truncate text-[10px] font-semibold leading-tight text-white">{item.name}</p>
                    <p className="text-[10px] text-white/70">{fmt.fileSize(item.size)}</p>
                    <p className="text-[10px] text-white/70">{formatMime(item.mime)}</p>
                    <p className="mt-1 text-[9px] text-white/40">{t('products.media.tapToClose')}</p>
                  </div>
                )}

                {isFirst && (
                  <div className="absolute left-1 top-1 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold leading-none text-primary-foreground shadow">
                    {t('products.media.thumbnail')}
                  </div>
                )}

                {!showInfo && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeItem(index);
                      }}
                      disabled={!interactive}
                      className="absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 shadow transition-opacity group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (interactive) setReplaceIndex(index);
                      }}
                      disabled={!interactive}
                      title={t('products.media.replaceImage')}
                      className="absolute bottom-1 left-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 shadow transition-opacity group-hover:opacity-100"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setInfoIndex(index);
                      }}
                      className="absolute bottom-1 right-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 shadow transition-opacity group-hover:opacity-100"
                    >
                      <Info className="h-3 w-3" />
                    </button>

                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-50">
                      <GripVertical className="h-6 w-6 text-white drop-shadow-md" />
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add-from-library trigger */}
      {canAddMore && (
        <button
          type="button"
          onClick={() => interactive && setPickerOpen(true)}
          disabled={!interactive}
          className={cn(
            'flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition-all',
            'border-border hover:border-primary/50 hover:bg-muted/50',
            !interactive && 'pointer-events-none cursor-not-allowed opacity-50',
          )}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <ImagePlus className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">{t('products.media.addFromLibrary')}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('products.media.addFromLibraryHint', {
                max: maxFiles,
                remaining: maxFiles - items.length,
              })}
            </p>
          </div>
        </button>
      )}

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handlePicked}
        multiple={maxFiles - items.length > 1}
        acceptedTypes={['image']}
        maxFiles={Math.max(0, maxFiles - items.length)}
        alreadySelectedIds={items.map((f) => f.id)}
      />

      {/* Replace a single image in place */}
      <MediaPicker
        open={replaceIndex !== null}
        onClose={() => setReplaceIndex(null)}
        onSelect={(picked) => {
          const idx = replaceIndex;
          setReplaceIndex(null);
          if (idx === null || !picked[0]) return;
          const replacement = fromApiFile(picked[0]);
          // Swap in place, then drop any duplicate (in case the chosen file is
          // already in the list elsewhere), preserving order.
          const seen = new Set<string>();
          const next = items
            .map((f, i) => (i === idx ? replacement : f))
            .filter((f) => {
              if (seen.has(f.id)) return false;
              seen.add(f.id);
              return true;
            });
          commit(next);
        }}
        acceptedTypes={['image']}
        alreadySelectedIds={items
          .filter((_, i) => i !== replaceIndex)
          .map((f) => f.id)}
      />
    </div>
  );
}
