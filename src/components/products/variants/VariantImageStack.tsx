// ─── Variant Image Stack ──────────────────────────────────────────────────────
// Compact inline control for a variant's images, rendered on each matrix row.
// Thumbnails fan out overlapping toward the right; hovering one raises it. The
// "+" button appends an image and disappears once the cap is reached. Clicking a
// thumbnail opens a popup to replace / delete / inspect it.
//
// Images are chosen through the MediaPicker (the single file-selection surface)
// and persist immediately (PATCH variant fileIds, full replacement). A saved
// variant (serverId) is required. The parent keeps the resolved file list so
// display survives a step remount.

import { useState } from 'react';
import { ImagePlus, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { MediaPicker } from '@/components/features/MediaPicker';
import { updateVariant } from '@/services/products.service';
import { getUploadErrorMessage } from '@/lib/uploadErrors';
import type { ApiFile } from '@/types/file.types';
import type { ApiFileDetail } from '@/types/product.types';

interface VariantImageStackProps {
  productId: string;
  /** Variant id — undefined for rows not yet saved (images disabled until saved). */
  variantId?: string;
  files: ApiFileDetail[];
  maxImages: number;
  disabled?: boolean;
  /** Called with the variant's fresh file list after a successful change. */
  onChange: (variantId: string, files: ApiFileDetail[]) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function VariantImageStack({
  productId,
  variantId,
  files,
  maxImages,
  disabled = false,
  onChange,
}: VariantImageStackProps) {
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);

  const currentIds = files.map((f) => f.id);
  const canAddMore = files.length < maxImages;
  const interactive = !!variantId && !disabled && !busy;
  const openFile = files.find((f) => f.id === openId) ?? null;
  const remaining = Math.max(0, maxImages - files.length);

  async function persist(nextIds: string[]) {
    if (!variantId) return;
    setBusy(true);
    try {
      const updated = await updateVariant(productId, variantId, { fileIds: nextIds });
      onChange(variantId, updated.files);
    } catch (err) {
      toast.error(getUploadErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleAdd(picked: ApiFile[]) {
    if (!variantId || picked.length === 0) return;
    const additions = picked.map((f) => f.id).filter((id) => !currentIds.includes(id));
    if (additions.length === 0) return;
    const nextIds = [...currentIds, ...additions].slice(0, maxImages);
    await persist(nextIds);
  }

  async function handleReplace(fileId: string, picked: ApiFile[]) {
    if (!variantId || !picked[0]) return;
    const nextIds = currentIds.map((id) => (id === fileId ? picked[0].id : id));
    await persist(nextIds);
    setOpenId(null);
  }

  async function handleDelete(fileId: string) {
    await persist(currentIds.filter((id) => id !== fileId));
    setOpenId(null);
  }

  // Unsaved row — show a disabled affordance with a hint.
  if (!variantId) {
    return (
      <span
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground/60"
        title="Save the variant to add images"
      >
        <ImagePlus className="h-4 w-4" />
      </span>
    );
  }

  return (
    <div className="flex items-center">
      {/* Stacked thumbnails */}
      {files.map((f, i) => (
        <button
          key={f.id}
          type="button"
          onClick={() => setOpenId(f.id)}
          disabled={busy}
          style={{ marginLeft: i === 0 ? 0 : -10, zIndex: i + 1 }}
          className={cn(
            'relative h-8 w-8 shrink-0 overflow-hidden rounded-md border border-border bg-muted shadow-sm transition-transform',
            'hover:z-20 hover:scale-125 focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
          title={f.originalName ?? 'Image'}
        >
          <img
            src={f.url}
            alt={f.originalName ?? 'Variant image'}
            crossOrigin="use-credentials"
            className="h-full w-full object-cover"
            draggable={false}
          />
        </button>
      ))}

      {/* Add button — hidden once the cap is reached */}
      {canAddMore && (
        <button
          type="button"
          onClick={() => interactive && setAddOpen(true)}
          disabled={!interactive}
          style={{ marginLeft: files.length === 0 ? 0 : -10, zIndex: files.length + 1 }}
          className={cn(
            'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-background text-muted-foreground transition-colors',
            'hover:z-20 hover:border-primary/60 hover:text-foreground',
            !interactive && 'opacity-50 cursor-not-allowed',
          )}
          title={`Add image (${files.length}/${maxImages})`}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
        </button>
      )}

      {busy && !canAddMore && (
        <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
      )}

      {/* Add picker */}
      <MediaPicker
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSelect={handleAdd}
        multiple
        acceptedTypes={['image']}
        maxFiles={remaining}
      />

      {/* Per-image popup */}
      <Dialog open={!!openFile} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="truncate">{openFile?.originalName ?? 'Image'}</DialogTitle>
          </DialogHeader>

          {openFile && (
            <div className="space-y-3">
              <div className="overflow-hidden rounded-lg border border-border bg-muted">
                <img
                  src={openFile.url}
                  alt={openFile.originalName ?? 'Variant image'}
                  crossOrigin="use-credentials"
                  className="max-h-72 w-full object-contain"
                />
              </div>
              <dl className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                <div>
                  <dt className="inline font-medium text-foreground">Size: </dt>
                  <dd className="inline">{formatSize(openFile.size)}</dd>
                </div>
                <div>
                  <dt className="inline font-medium text-foreground">Type: </dt>
                  <dd className="inline">{openFile.mimeType}</dd>
                </div>
              </dl>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setReplaceOpen(true)}
              disabled={busy}
              className="gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Replace
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => openFile && handleDelete(openFile.id)}
              disabled={busy}
              className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </DialogFooter>

          {/* Replace picker */}
          <MediaPicker
            open={replaceOpen}
            onClose={() => setReplaceOpen(false)}
            onSelect={(picked) => {
              setReplaceOpen(false);
              if (openFile) handleReplace(openFile.id, picked);
            }}
            acceptedTypes={['image']}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
