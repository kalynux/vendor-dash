import { useEffect, useRef, useState } from 'react';
import { Trash2, ChevronDown, ChevronUp, Wand2, ImagePlus, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { DigitalAssetUpload } from '@/components/products/DigitalAssetUpload';
import { MediaPicker } from '@/components/features/MediaPicker';
import { updateVariantStatus } from '@/services/products.service';
import { resolveFileUrl } from '@/services/files.service';
import { ApiError } from '@/types/api';
import type { ApiFile } from '@/types/file.types';
import type { DigitalFormatRow } from '@/types/product.types';

interface DigitalFormatCardProps {
  format: DigitalFormatRow;
  index: number;
  errors: Record<string, string>;
  canRemove: boolean;
  isSaving: boolean;
  productTitle: string;
  productCategory: string;
  productId: string;
  onChange: (tempId: string, patch: Partial<DigitalFormatRow>) => void;
  onRemove: (tempId: string) => void;
  onStatusSync: (tempId: string, serverId: string, status: 'active' | 'archived') => void;
}

// Debounce window for the per-variant status toggle. A toggle that flips back
// within this window cancels the API call — the net state hasn't changed.
const STATUS_DEBOUNCE_MS = 700;

// Uppercase, dash-separated, alphanumeric-only token (e.g. "JavaScript Course" → "JAVASCRIPT-COURSE")
function slugToken(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase();
}

function fileFormatToken(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot > 0 ? slugToken(filename.slice(dot + 1)) : '';
}

// Short crypto-random suffix to keep auto-generated SKUs globally unique across products.
function randomToken(len = 4): string {
  const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint32Array(len);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length];
  return out;
}

// Product slug + (file format OR category) + random suffix.
function generateSku(productTitle: string, category: string, filename: string | null): string {
  const mid = filename ? fileFormatToken(filename) : slugToken(category);
  return [slugToken(productTitle), mid, randomToken()].filter(Boolean).join('-');
}

export function DigitalFormatCard({
  format,
  index,
  errors,
  canRemove,
  isSaving,
  productTitle,
  productCategory,
  productId,
  onChange,
  onRemove,
  onStatusSync,
}: DigitalFormatCardProps) {
  const nameRef = useRef<HTMLInputElement>(null);
  const skuRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);
  const compareAtRef = useRef<HTMLInputElement>(null);

  const [showLimits, setShowLimits] = useState(
    format.maxDownloads != null || format.expiresAfterDays != null,
  );

  const pending = format.pendingFile;
  const hasNewFile = pending instanceof File;
  const isRemoved = pending === null;
  const hasExistingAsset = !isRemoved && !!format.asset;

  // ─── Preview image (optional, max 1 — separate from the downloadable asset) ──
  const pendingImage = format.pendingImage;
  const hasNewImage = !!pendingImage; // a freshly picked library image
  const imageRemoved = pendingImage === null;
  const hasExistingImage = !imageRemoved && !!format.image;
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const imageSrc = hasNewImage
    ? resolveFileUrl(pendingImage)
    : hasExistingImage
      ? format.image!.url
      : null;

  function handlePickImage(files: ApiFile[]) {
    if (files[0]) onChange(format.tempId, { pendingImage: files[0] });
  }

  function handleImageRemove() {
    if (hasNewImage) onChange(format.tempId, { pendingImage: undefined });
    else if (format.image) onChange(format.tempId, { pendingImage: null });
  }

  // ─── Per-variant active/archived toggle with debounce ──────────────────────
  // committedRef tracks the last server-confirmed status; pendingStatus is the
  // UI state. We only fire the API call when, after the debounce window, the
  // pending state still differs from what the server has.
  const initialStatus: 'active' | 'archived' = format.status ?? 'archived';
  const [pendingStatus, setPendingStatus] = useState<'active' | 'archived'>(initialStatus);
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);
  const committedRef = useRef<'active' | 'archived'>(initialStatus);
  const debounceRef = useRef<number | null>(null);

  // Clear any pending debounce timer when the card unmounts to avoid leaks.
  useEffect(() => {
    return () => {
      if (debounceRef.current != null) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, []);

  // What DigitalAssetUpload should display
  const currentAsset = hasNewFile
    ? { assetId: '', filename: pending.name, size: pending.size, mimeType: pending.type }
    : hasExistingAsset
      ? {
        assetId: format.asset!.id,
        filename: format.asset!.originalName,
        size: format.asset!.size,
        mimeType: format.asset!.mimeType,
      }
      : null;

  function handleFileSelect(file: File) {
    onChange(format.tempId, { pendingFile: file });
  }

  function handleFileRemove() {
    if (hasNewFile) {
      // Discard the newly selected file, keep whatever was on the server
      onChange(format.tempId, { pendingFile: undefined });
    } else if (format.asset) {
      // Mark the existing server asset for removal
      onChange(format.tempId, { pendingFile: null });
    }
  }

  function handleGenerateSku() {
    const sku = generateSku(productTitle, productCategory, currentAsset?.filename ?? null);
    if (skuRef.current) skuRef.current.value = sku;
    onChange(format.tempId, { sku });
  }

  function handleStatusToggle(checked: boolean) {
    const next: 'active' | 'archived' = checked ? 'active' : 'archived';

    // UI follows the toggle immediately.
    setPendingStatus(next);

    // Any in-flight debounce is now stale.
    if (debounceRef.current != null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    // No-op: the user flipped back to where the server already is — skip the API call.
    if (next === committedRef.current) return;

    debounceRef.current = window.setTimeout(async () => {
      debounceRef.current = null;
      const variantId = format.serverId;
      if (!variantId || !productId) return;

      setIsStatusUpdating(true);
      try {
        await updateVariantStatus(productId, variantId, next);
        committedRef.current = next;
        onStatusSync(format.tempId, variantId, next);
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.code === 'CATALOG_VARIANT_NO_DIGITAL_ASSET'
              ? 'Upload a file before activating this format.'
              : err.message
            : 'Could not update the format status.';
        toast.error(message);
        // Revert UI to the last server-confirmed state.
        setPendingStatus(committedRef.current);
      } finally {
        setIsStatusUpdating(false);
      }
    }, STATUS_DEBOUNCE_MS);
  }

  function onBlurNumber(
    ref: React.RefObject<HTMLInputElement | null>,
    field: 'price' | 'compareAtPrice',
  ) {
    const raw = ref.current?.value ?? '';
    const num = parseFloat(raw);
    onChange(format.tempId, { [field]: isNaN(num) ? undefined : num });
  }

  function onBlurLimit(value: string, field: 'maxDownloads' | 'expiresAfterDays') {
    const num = parseInt(value, 10);
    onChange(format.tempId, { [field]: value.trim() === '' || isNaN(num) ? null : num });
  }

  const nameError = errors[`${format.tempId}.name`];
  const skuError = errors[`${format.tempId}.sku`];
  const priceError = errors[`${format.tempId}.price`];

  // Status pill — reflects the locally-pending status while a debounce/API call is mid-flight.
  let statusBadge: { label: string; className: string };
  if (hasNewFile) {
    statusBadge = { label: 'File ready', className: 'text-blue-600 border-blue-200 bg-blue-50' };
  } else if (!hasExistingAsset) {
    statusBadge = { label: 'Needs file', className: 'text-amber-700 border-amber-200 bg-amber-50' };
  } else if (pendingStatus === 'active') {
    statusBadge = { label: 'Live', className: 'text-green-700 border-green-200 bg-green-50' };
  } else {
    statusBadge = { label: 'Paused', className: 'text-muted-foreground border-border bg-muted/40' };
  }

  // The toggle is only meaningful once the variant exists on the server.
  // Activation requires an existing asset — otherwise the backend rejects with 422.
  const showStatusToggle = !!format.serverId && !!productId;
  const hasServerAsset = !!format.asset;
  const canActivate = hasServerAsset;
  const toggleDisabled =
    isSaving || isStatusUpdating || (pendingStatus === 'archived' && !canActivate);
  const toggleTitle = !hasServerAsset
    ? 'Upload a file before activating this format'
    : pendingStatus === 'active'
      ? 'Pause this format'
      : 'Activate this format';

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-muted-foreground">Format {index + 1}</span>
          <Badge variant="outline" className={cn('text-xs', statusBadge.className)}>
            {statusBadge.label}
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          {showStatusToggle && (
            <div className="flex items-center gap-2" title={toggleTitle}>
              <Label className="text-xs text-muted-foreground">Active</Label>
              <Switch
                checked={pendingStatus === 'active'}
                onCheckedChange={handleStatusToggle}
                disabled={toggleDisabled}
                aria-label={toggleTitle}
              />
            </div>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onRemove(format.tempId)}
            disabled={!canRemove || isSaving}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            aria-label="Remove format"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs">
            Format name <span className="text-destructive">*</span>
          </Label>
          <Input
            ref={nameRef}
            defaultValue={format.name}
            placeholder="e.g. PDF Edition"
            className={cn('h-9', nameError && 'border-destructive')}
            onBlur={() => onChange(format.tempId, { name: nameRef.current?.value ?? '' })}
          />
          {nameError && <p className="text-xs text-destructive">{nameError}</p>}
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs">
              SKU <span className="text-destructive">*</span>
            </Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleGenerateSku}
              disabled={isSaving || !productTitle.trim()}
              title={
                productTitle.trim()
                  ? 'Generate a SKU from the product name and file'
                  : 'Set the product name first'
              }
              className="h-6 gap-1 px-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <Wand2 className="w-3 h-3" />
              Generate
            </Button>
          </div>
          <Input
            ref={skuRef}
            defaultValue={format.sku}
            placeholder="JS-COURSE-PDF"
            className={cn('h-9 font-mono text-sm', skuError && 'border-destructive')}
            onBlur={() => onChange(format.tempId, { sku: skuRef.current?.value ?? '' })}
          />
          {skuError && <p className="text-xs text-destructive">{skuError}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">
              Price <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
              <Input
                ref={priceRef}
                type="number"
                min={0}
                step={0.01}
                inputMode="decimal"
                defaultValue={format.price || ''}
                placeholder="0.00"
                className={cn('h-9 pl-5', priceError && 'border-destructive')}
                onBlur={() => onBlurNumber(priceRef, 'price')}
              />
            </div>
            {priceError && <p className="text-xs text-destructive">{priceError}</p>}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Compare at</Label>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
              <Input
                ref={compareAtRef}
                type="number"
                min={0}
                step={0.01}
                inputMode="decimal"
                defaultValue={format.compareAtPrice ?? ''}
                placeholder="—"
                className="h-9 pl-5"
                onBlur={() => onBlurNumber(compareAtRef, 'compareAtPrice')}
              />
            </div>
          </div>
        </div>
      </div>

      {/* File */}
      <div className="space-y-1.5">
        <Label className="text-xs">Downloadable file</Label>
        <DigitalAssetUpload
          currentAsset={currentAsset}
          onFileSelect={handleFileSelect}
          onRemove={handleFileRemove}
          isUploading={isSaving}
        />
        {!currentAsset && (
          <p className="text-xs text-muted-foreground">
            Upload a file to make this format available for sale.
          </p>
        )}
      </div>

      {/* Preview image (optional, max 1) */}
      <div className="space-y-1.5">
        <Label className="text-xs">Preview image (optional)</Label>
        <div className="flex items-center gap-3">
          {imageSrc ? (
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
              <img
                src={imageSrc}
                alt="Format preview"
                crossOrigin="use-credentials"
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setImagePickerOpen(true)}
              disabled={isSaving}
              className={cn(
                'flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground transition-colors',
                'hover:border-primary/60 hover:text-foreground',
                isSaving && 'opacity-50 cursor-not-allowed',
              )}
              aria-label="Add preview image"
            >
              <ImagePlus className="h-5 w-5" />
            </button>
          )}

          {imageSrc ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setImagePickerOpen(true)}
                disabled={isSaving}
                className="gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Replace
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleImageRemove}
                disabled={isSaving}
                className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
                Remove
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              A thumbnail shown to buyers for this format.
            </p>
          )}
        </div>
        <MediaPicker
          open={imagePickerOpen}
          onClose={() => setImagePickerOpen(false)}
          onSelect={handlePickImage}
          acceptedTypes={['image']}
        />
      </div>

      {/* Download limits */}
      <div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowLimits((v) => !v)}
          className="gap-1.5 -ml-2 h-8 text-muted-foreground"
        >
          {showLimits ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          Download limits (optional)
        </Button>
        {showLimits && (
          <div className="grid grid-cols-2 gap-3 mt-2 pl-1">
            <div className="space-y-1">
              <Label className="text-xs">Max downloads</Label>
              <Input
                type="number"
                min={1}
                defaultValue={format.maxDownloads ?? ''}
                placeholder="Unlimited"
                className="h-9"
                onBlur={(e) => onBlurLimit(e.target.value, 'maxDownloads')}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Expires after (days)</Label>
              <Input
                type="number"
                min={1}
                defaultValue={format.expiresAfterDays ?? ''}
                placeholder="Never"
                className="h-9"
                onBlur={(e) => onBlurLimit(e.target.value, 'expiresAfterDays')}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
