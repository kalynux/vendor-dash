import { useEffect, useRef, useState } from 'react';
import { Trash2, ImagePlus } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { SettingsSection } from '@/components/vendor-settings/SettingsSection';
import { DisclosureTrigger } from '@/components/products/form/DisclosureTrigger';
import { DigitalAssetUpload } from '@/components/products/DigitalAssetUpload';
import { MediaPicker } from '@/components/features/MediaPicker';
import { updateVariantStatus } from '@/services/products.service';
import { resolveFileUrl } from '@/services/files.service';
import { ApiError } from '@/types/api';
import { useFormatters, useMessage, useTranslation, type TranslationKey } from '@/i18n';
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
  const { t } = useTranslation();
  const m = useMessage();
  const fmt = useFormatters();
  // The currency as the app formats it ("FCFA"), not a hard-coded "$": the
  // formatter's own rendering of zero with the number taken out. Display only —
  // the field still reads and sends a bare number.
  const currencyUnit = fmt.currency(0).replace(/[\d\s.,-]/g, '');
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
        toast.error(
          err instanceof ApiError && err.code === 'CATALOG_VARIANT_NO_DIGITAL_ASSET'
            ? t('products.digital.activateNeedsFile')
            : t('products.digital.statusUpdateFailed'),
        );
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

  // Status word beside the heading — reflects the locally-pending status while a
  // debounce/API call is mid-flight.
  let statusBadge: { labelKey: TranslationKey; className: string };
  if (hasNewFile) {
    statusBadge = {
      labelKey: 'products.digital.badge.fileReady',
      className: 'text-blue-600 dark:text-blue-400',
    };
  } else if (!hasExistingAsset) {
    statusBadge = {
      labelKey: 'products.digital.badge.needsFile',
      className: 'text-amber-700 dark:text-amber-400',
    };
  } else if (pendingStatus === 'active') {
    statusBadge = {
      labelKey: 'products.digital.badge.live',
      className: 'text-green-700 dark:text-green-400',
    };
  } else {
    statusBadge = {
      labelKey: 'products.digital.badge.paused',
      className: 'text-muted-foreground',
    };
  }

  // The toggle is only meaningful once the variant exists on the server.
  // Activation requires an existing asset — otherwise the backend rejects with 422.
  const showStatusToggle = !!format.serverId && !!productId;
  const hasServerAsset = !!format.asset;
  const canActivate = hasServerAsset;
  const toggleDisabled =
    isSaving || isStatusUpdating || (pendingStatus === 'archived' && !canActivate);
  const toggleTitle = t(
    !hasServerAsset
      ? 'products.digital.toggle.needsFile'
      : pendingStatus === 'active'
        ? 'products.digital.toggle.pause'
        : 'products.digital.toggle.activate',
  );

  const statusSwitchId = `format-active-${format.tempId}`;

  // Rendered as a section of its own (see StepDigitalFormats): flat with a hairline
  // on a phone, one card per format on a wide screen — never a card inside one.
  return (
    <SettingsSection
      title={
        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span>{t('products.digital.formatIndex', { index: index + 1 })}</span>
          <span className={cn('font-sans text-sm font-normal', statusBadge.className)}>
            {t(statusBadge.labelKey)}
          </span>
        </span>
      }
      action={
        <div className="flex items-center gap-2">
          {showStatusToggle && (
            <div className="flex items-center gap-2" title={toggleTitle}>
              <Label htmlFor={statusSwitchId} className="font-normal text-muted-foreground">
                {t('products.digital.active')}
              </Label>
              <Switch
                id={statusSwitchId}
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
            size="icon"
            onClick={() => onRemove(format.tempId)}
            disabled={!canRemove || isSaving}
            className="-mr-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            aria-label={t('products.digital.removeFormat')}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      }
      contentClassName="space-y-5"
    >
      {/* Details */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor={`format-name-${format.tempId}`}>
            {t('products.digital.formatName')} <span className="text-destructive">*</span>
          </Label>
          <Input
            id={`format-name-${format.tempId}`}
            ref={nameRef}
            defaultValue={format.name}
            placeholder={t('products.digital.formatNamePlaceholder')}
            aria-invalid={!!nameError}
            onBlur={() => onChange(format.tempId, { name: nameRef.current?.value ?? '' })}
          />
          {nameError && <p className="text-sm text-destructive">{m(nameError)}</p>}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor={`format-sku-${format.tempId}`}>
              {t('products.fields.sku')} <span className="text-destructive">*</span>
            </Label>
            <button
              type="button"
              onClick={handleGenerateSku}
              disabled={isSaving || !productTitle.trim()}
              title={t(
                productTitle.trim()
                  ? 'products.digital.generateSkuHint'
                  : 'products.digital.generateSkuBlocked',
              )}
              className="tap-target rounded-sm text-sm font-medium text-primary hover:underline disabled:pointer-events-none disabled:opacity-50"
            >
              {t('products.digital.generateSku')}
            </button>
          </div>
          <Input
            id={`format-sku-${format.tempId}`}
            ref={skuRef}
            defaultValue={format.sku}
            placeholder={t('products.digital.skuPlaceholder')}
            className="font-mono"
            aria-invalid={!!skuError}
            onBlur={() => onChange(format.tempId, { sku: skuRef.current?.value ?? '' })}
          />
          {skuError && <p className="text-sm text-destructive">{m(skuError)}</p>}
        </div>

        {/* A short numeric pair — side by side even on a phone. */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor={`format-price-${format.tempId}`}>
              {t('products.fields.price')} <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{currencyUnit}</span>
              <Input
                id={`format-price-${format.tempId}`}
                ref={priceRef}
                type="number"
                min={0}
                step={0.01}
                inputMode="decimal"
                defaultValue={format.price || ''}
                placeholder="0"
                className="pr-14"
                aria-invalid={!!priceError}
                onBlur={() => onBlurNumber(priceRef, 'price')}
              />
            </div>
            {priceError && <p className="text-sm text-destructive">{m(priceError)}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor={`format-compare-${format.tempId}`}>{t('products.digital.compareAt')}</Label>
            <div className="relative">
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{currencyUnit}</span>
              <Input
                id={`format-compare-${format.tempId}`}
                ref={compareAtRef}
                type="number"
                min={0}
                step={0.01}
                inputMode="decimal"
                defaultValue={format.compareAtPrice ?? ''}
                placeholder="—"
                className="pr-14"
                onBlur={() => onBlurNumber(compareAtRef, 'compareAtPrice')}
              />
            </div>
          </div>
        </div>
      </div>

      {/* File */}
      <div className="space-y-2">
        <Label>{t('products.digital.downloadableFile')}</Label>
        <DigitalAssetUpload
          currentAsset={currentAsset}
          onFileSelect={handleFileSelect}
          onRemove={handleFileRemove}
          isUploading={isSaving}
        />
        {!currentAsset && (
          <p className="text-sm text-muted-foreground">
            {t('products.digital.uploadToSell')}
          </p>
        )}
      </div>

      {/* Preview image (optional, max 1) */}
      <div className="space-y-2">
        <Label>{t('products.digital.previewImage')}</Label>
        <div className="flex items-center gap-3">
          {imageSrc ? (
            <div className="relative size-14 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
              <img
                src={imageSrc}
                alt={t('products.digital.previewImageAlt')}
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setImagePickerOpen(true)}
              disabled={isSaving}
              className={cn(
                'flex size-14 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground transition-colors',
                'hover:border-primary/60 hover:text-foreground',
                isSaving && 'cursor-not-allowed opacity-50',
              )}
              aria-label={t('products.digital.addPreviewImage')}
            >
              <ImagePlus className="size-5" />
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
              >
                {t('products.digital.replaceImage')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleImageRemove}
                disabled={isSaving}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                {t('common.actions.remove')}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t('products.digital.previewImageHint')}
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
      <Collapsible open={showLimits} onOpenChange={setShowLimits} className="border-t border-border">
        <DisclosureTrigger open={showLimits} className="py-2">
          {t('products.digital.downloadLimits')}
        </DisclosureTrigger>
        <CollapsibleContent className="pb-1 pt-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor={`format-max-${format.tempId}`}>{t('products.digital.maxDownloads')}</Label>
              <Input
                id={`format-max-${format.tempId}`}
                type="number"
                min={1}
                defaultValue={format.maxDownloads ?? ''}
                placeholder={t('products.digital.maxDownloadsPlaceholder')}
                onBlur={(e) => onBlurLimit(e.target.value, 'maxDownloads')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`format-expires-${format.tempId}`}>{t('products.digital.expiresAfter')}</Label>
              <Input
                id={`format-expires-${format.tempId}`}
                type="number"
                min={1}
                defaultValue={format.expiresAfterDays ?? ''}
                placeholder={t('products.digital.expiresAfterPlaceholder')}
                onBlur={(e) => onBlurLimit(e.target.value, 'expiresAfterDays')}
              />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </SettingsSection>
  );
}
