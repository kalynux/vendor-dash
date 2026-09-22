import { useState, useCallback, useEffect } from 'react';
import { X, GripVertical, ImagePlus, Info, Plus, RefreshCw } from 'lucide-react';
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
  // `null` for an authorized-access file — there is no URL to render. Product
  // imagery is public in practice, but the backend's tree classifier fails
  // closed, so this stays nullable rather than asserting a string.
  url: string | null;
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

/**
 * A round control sitting on a photo tile. Visible by default (touch screens
 * have no hover to reveal it), faded out until hover only where the pointer can
 * hover. `tap-target` extends the touch area to 44px without reflow.
 */
const TILE_BUTTON = cn(
  'tap-target absolute z-10 flex size-7 items-center justify-center rounded-full bg-black/60 text-white transition-opacity',
  'hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
  'disabled:pointer-events-none disabled:opacity-50',
  '[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100',
);

function formatMime(mime: string): string {
  const sub = mime.split('/')[1] ?? mime;
  return sub.replace(/[+-].*/, '').toUpperCase();
}

function fromDetail(f: ApiFileDetail): GalleryFile {
  return { id: f.id, url: resolveFileUrl(f), name: f.originalName ?? f.key, size: f.size, mime: f.mimeType };
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
  const openPicker = () => {
    if (interactive) setPickerOpen(true);
  };

  return (
    <div>
      {items.length === 0 ? (
        // Empty: one plain control, not a drop zone — nothing is dropped here,
        // the picker is where files are uploaded.
        canAddMore && (
          <button
            type="button"
            onClick={openPicker}
            disabled={!interactive}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg border border-dashed border-input px-4 py-5 text-left transition-colors',
              'hover:border-primary/50 hover:bg-muted/40',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            <ImagePlus className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0">
              <span className="block text-sm font-medium">
                {t('products.media.addPhotos', { count: maxFiles })}
              </span>
              <span className="mt-0.5 block text-sm text-muted-foreground">
                {t('products.media.addPhotosHint', { count: maxFiles })}
              </span>
            </span>
          </button>
        )
      ) : (
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
                  // No `overflow-hidden` on the tile itself: it would clip the
                  // 44px touch halo of the corner buttons. The picture is
                  // clipped by the inner layer instead.
                  'group relative aspect-square select-none transition-transform',
                  '[@media(hover:hover)]:cursor-grab [@media(hover:hover)]:active:cursor-grabbing',
                  isBeingDragged && 'scale-95 opacity-40',
                  isDragTarget && 'scale-[1.03]',
                )}
              >
                <div
                  className={cn(
                    'absolute inset-0 overflow-hidden rounded-lg border bg-muted',
                    isDragTarget ? 'border-primary ring-2 ring-primary/40' : 'border-border',
                  )}
                >
                  {item.url ? (
                    <img
                      src={item.url}
                      alt={item.name}
                      className="pointer-events-none h-full w-full object-cover"
                      draggable={false}
                    />
                  ) : (
                    <div className="pointer-events-none flex h-full w-full items-center justify-center px-2 text-center text-xs text-muted-foreground">
                      {formatMime(item.mime)}
                    </div>
                  )}

                  {/* Mouse only: a dim to carry the hover controls. */}
                  <div className="pointer-events-none absolute inset-0 transition-colors [@media(hover:hover)]:group-hover:bg-black/30" />

                  {showInfo && (
                    <div
                      className="absolute inset-0 z-20 flex cursor-pointer flex-col justify-center gap-0.5 bg-black/85 px-2.5 text-xs"
                      onClick={() => setInfoIndex(null)}
                    >
                      <p className="truncate font-medium text-white">{item.name}</p>
                      <p className="text-white/75">{fmt.fileSize(item.size)}</p>
                      <p className="text-white/75">{formatMime(item.mime)}</p>
                      <p className="mt-1 text-white/60">{t('products.media.tapToClose')}</p>
                    </div>
                  )}
                </div>

                {isFirst && !showInfo && (
                  <span className="pointer-events-none absolute left-1.5 top-1.5 rounded bg-black/65 px-1.5 py-0.5 text-xs font-medium text-white">
                    {t('products.media.thumbnail')}
                  </span>
                )}

                {!showInfo && (
                  <>
                    {/* Remove and replace are always shown on touch screens —
                        there is no hover there — and revealed on hover with a
                        mouse. `tap-target` gives them a 44px touch area without
                        growing the painted circle. */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeItem(index);
                      }}
                      disabled={!interactive}
                      aria-label={t('common.actions.remove')}
                      title={t('common.actions.remove')}
                      className={cn(TILE_BUTTON, 'right-1.5 top-1.5')}
                    >
                      <X className="size-4" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (interactive) setReplaceIndex(index);
                      }}
                      disabled={!interactive}
                      aria-label={t('products.media.replaceImage')}
                      title={t('products.media.replaceImage')}
                      className={cn(TILE_BUTTON, 'bottom-1.5 left-1.5')}
                    >
                      <RefreshCw className="size-3.5" />
                    </button>

                    {/* File details: a mouse nicety. On a phone a third button
                        on a ~110px tile is clutter, so it stays hover-only. */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setInfoIndex(index);
                      }}
                      aria-label={t('common.actions.viewDetails')}
                      title={t('common.actions.viewDetails')}
                      className={cn(TILE_BUTTON, 'bottom-1.5 right-1.5 hidden [@media(hover:hover)]:flex')}
                    >
                      <Info className="size-3.5" />
                    </button>

                    {/* Drag to reorder is a mouse gesture; the handle only
                        appears where it can be used. */}
                    <div className="pointer-events-none absolute inset-0 hidden items-center justify-center opacity-0 transition-opacity [@media(hover:hover)]:flex [@media(hover:hover)]:group-hover:opacity-60">
                      <GripVertical className="size-6 text-white" />
                    </div>
                  </>
                )}
              </div>
            );
          })}

          {/* Once there are photos, adding more is one more tile in the grid. */}
          {canAddMore && (
            <button
              type="button"
              onClick={openPicker}
              disabled={!interactive}
              className={cn(
                'flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-input text-sm transition-colors',
                'hover:border-primary/50 hover:bg-muted/40',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              <Plus className="size-5 text-muted-foreground" aria-hidden />
              <span className="font-medium">{t('common.actions.add')}</span>
              <span className="text-muted-foreground">
                {t('products.media.tileCount', { count: items.length, max: maxFiles })}
              </span>
            </button>
          )}
        </div>
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
