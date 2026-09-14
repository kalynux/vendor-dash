import { useState } from 'react';
import { Download, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ResponsiveModal } from '@/components/services/ResponsiveModal';
import { saveBlob } from '@/platform/filesystem';
import { fetchKycDocumentBlob } from '@/services/kyc.service';
import { apiErrorMessage, useTranslation } from '@/i18n';
import type { FileRef } from '@/types/file.types';

import { useKycDocumentUrl } from './useKycDocumentUrl';

interface KycDocumentPreviewDialogProps {
  doc: FileRef | null;
  label: string;
  onClose: () => void;
}

/**
 * A document at full size.
 *
 * An ID scan has to be legible to be worth submitting, and a 96px tile does not
 * prove that the number is readable — this is where a vendor checks their own
 * evidence before handing it to a reviewer.
 *
 * A PDF is offered as a download instead of rendered. The bytes only exist
 * behind an authorized route, so there is no URL to hand an `<embed>`; writing
 * it to the device is both simpler and what someone wants from a document they
 * may have to produce again.
 */
export function KycDocumentPreviewDialog({ doc, label, onClose }: KycDocumentPreviewDialogProps) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const isPdf = doc?.mimeType === 'application/pdf';
  const { url, loading, error, quotaBlocked } = useKycDocumentUrl(isPdf ? null : doc);

  const handleSave = async () => {
    if (!doc) return;
    setSaving(true);
    try {
      const blob = await fetchKycDocumentBlob(doc.id);
      const outcome = await saveBlob({
        blob,
        fileName: doc.originalName ?? `${label}.pdf`,
      });
      if (outcome === 'failed') toast.error(t('account.verification.document.saveFailed'));
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ResponsiveModal
      open={doc !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={label}
    >
      <div className="flex min-h-48 items-center justify-center">
        {quotaBlocked ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {t('account.verification.document.quotaBlockedLong')}
          </p>
        ) : isPdf ? (
          <div className="flex flex-col items-center gap-4 p-6 text-center">
            <FileText className="size-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {doc?.originalName ?? t('account.verification.document.pdf')}
            </p>
            <Button type="button" variant="outline" disabled={saving} onClick={() => void handleSave()}>
              {saving ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Download className="mr-2 size-4" />
              )}
              {t('account.verification.document.save')}
            </Button>
          </div>
        ) : loading ? (
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        ) : error || !url ? (
          <p className="p-6 text-center text-sm text-destructive">
            {error ?? t('account.verification.document.unavailable')}
          </p>
        ) : (
          <img src={url} alt={label} className="max-h-[70vh] w-full rounded-lg object-contain" />
        )}
      </div>
    </ResponsiveModal>
  );
}
