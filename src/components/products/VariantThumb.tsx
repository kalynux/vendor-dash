import { ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';
import type { ApiFileDetail } from '@/types/product.types';

interface VariantThumbProps {
  /** The variant's own images, in the order the vendor arranged them. */
  files?: ApiFileDetail[];
  /**
   * The product's images, used only when the variant carries none.
   *
   * A variant with no picture of its own is still a picture of *this* product,
   * and showing it beats an empty grey square — the whole point of the thumbnail
   * is that a vendor recognises the row without reading it.
   */
  fallback?: ApiFileDetail[];
  className?: string;
}

/**
 * The first image of a variant, at list-row scale.
 *
 * Read-only on purpose: this is an identification aid, not an editing surface.
 * `VariantImageStack` is the one that manages a variant's images, and giving a
 * pricing row a second, quieter way to change them would be a trap.
 */
export function VariantThumb({ files, fallback, className }: VariantThumbProps) {
  const { t } = useTranslation();
  const image = files?.[0] ?? fallback?.[0] ?? null;

  return (
    <div
      className={cn(
        'flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted',
        className,
      )}
    >
      {image ? (
        <img
          src={image.url}
          alt={image.originalName ?? t('products.media.variantImageAlt')}
          // The file endpoints are cookie-authenticated; without this the image
          // is fetched anonymously and comes back 401.
          loading="lazy"
          draggable={false}
          className="size-full object-cover"
        />
      ) : (
        <ImageIcon className="size-4 text-muted-foreground/60" aria-hidden />
      )}
    </div>
  );
}
