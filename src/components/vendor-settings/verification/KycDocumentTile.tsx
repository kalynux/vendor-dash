import { FileText, ImageOff, Loader2, X, HardDrive } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';
import type { FileRef } from '@/types/file.types';

import { useKycDocumentUrl } from './useKycDocumentUrl';

interface KycDocumentTileProps {
  doc: FileRef;
  /** Accessible name — the slot's label ("Front of your ID card"). */
  label: string;
  /** Omitted while the record is locked: a frozen record has nothing to remove. */
  onRemove?: () => void;
  removing?: boolean;
  /** Opens the full-size viewer. A thumbnail of an ID card is not legible. */
  onOpen?: () => void;
}

/**
 * One uploaded document, as a thumbnail.
 *
 * Images render from a blob fetched through the authorized content route — see
 * `useKycDocumentUrl` for why `doc.url` is useless here. PDFs get an icon
 * instead: they are a first-class citizen on this route (a scan arrives from a
 * phone as a JPEG and from a scanner app as a PDF) and there is no thumbnail to
 * draw without a renderer.
 */
export function KycDocumentTile({
  doc,
  label,
  onRemove,
  removing,
  onOpen,
}: KycDocumentTileProps) {
  const { t } = useTranslation();
  const isPdf = doc.mimeType === 'application/pdf';
  // Skipped entirely for a PDF — there is nothing to draw with the bytes, so
  // fetching them on mount would spend a vendor's data to render an icon.
  const { url, loading, error, quotaBlocked } = useKycDocumentUrl(isPdf ? null : doc);

  const body = () => {
    if (quotaBlocked) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-1 p-2 text-center">
          <HardDrive className="size-5 text-amber-600" />
          <span className="text-[11px] leading-tight text-muted-foreground">
            {t('account.verification.document.quotaBlocked')}
          </span>
        </div>
      );
    }
    if (isPdf) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-1 p-2 text-center">
          <FileText className="size-6 text-muted-foreground" />
          <span className="text-[11px] font-medium">{t('account.verification.document.pdf')}</span>
        </div>
      );
    }
    if (loading) {
      return <Loader2 className="size-5 animate-spin text-muted-foreground" />;
    }
    if (error || !url) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-1 p-2 text-center">
          <ImageOff className="size-5 text-muted-foreground" />
          <span className="text-[11px] leading-tight text-muted-foreground">
            {t('account.verification.document.unavailable')}
          </span>
        </div>
      );
    }
    return <img src={url} alt={label} className="size-full object-cover" />;
  };

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onOpen}
        disabled={!onOpen}
        aria-label={t('account.verification.document.view', { label })}
        className={cn(
          'flex size-24 items-center justify-center overflow-hidden rounded-lg border bg-muted',
          onOpen && 'cursor-zoom-in transition-colors hover:border-primary/50',
        )}
      >
        {body()}
      </button>

      {onRemove && (
        <Button
          type="button"
          size="icon"
          variant="secondary"
          disabled={removing}
          onClick={onRemove}
          aria-label={t('account.verification.document.remove', { label })}
          // Always visible rather than hover-revealed: this dashboard ships as a
          // touch app, where there is no hover and a hover-gated control is
          // simply unreachable.
          className="absolute -right-1.5 -top-1.5 size-6 rounded-full border shadow-sm"
        >
          {removing ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3" />}
        </Button>
      )}
    </div>
  );
}
