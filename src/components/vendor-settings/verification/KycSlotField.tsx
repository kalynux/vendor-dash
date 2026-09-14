import { useCallback, useRef, useState } from 'react';
import { Loader2, Plus, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { UploadSourceSheet } from '@/components/common/UploadSourceSheet';
import { nativeMediaAvailable } from '@/platform/media';
import { useTranslation } from '@/i18n';
import {
  KYC_ACCEPT_ATTR,
  KYC_MAX_FILE_BYTES,
  KYC_MAX_FILES_PER_REQUEST,
  kycFileTypeIsWrong,
  type KycSlot,
} from '@/types/kyc.types';
import type { FileRef } from '@/types/file.types';

import { KycDocumentTile } from './KycDocumentTile';
import { RequirementBadge } from './RequirementBadge';

interface KycSlotFieldProps {
  slot: KycSlot;
  label: string;
  hint?: string;
  /** `true` when the reviewers require this slot *for this vendor*. */
  required: boolean;
  files: FileRef[];
  /** 1 for a single-value slot; `limits.multiSlotMaxFiles` for a sketch slot. */
  max: number;
  locked: boolean;
  onUpload: (slot: KycSlot, files: File[]) => Promise<void>;
  onRemove: (slot: KycSlot, fileId: string) => Promise<void>;
  onOpen: (doc: FileRef, label: string) => void;
  /** The file id currently being deleted, so only its own tile spins. */
  removingId: string | null;
}

/**
 * One document slot — the tiles it holds, and the control that adds to it.
 *
 * Serves both cardinalities. A single-value slot (`max === 1`) shows one tile
 * and a button labelled "Replace" once filled — re-uploading replaces
 * server-side, and the previous file is deleted immediately, so the vendor's
 * storage drops straight away rather than waiting for the orphan sweep. A
 * multi-value slot appends until `max`.
 */
export function KycSlotField({
  slot,
  label,
  hint,
  required,
  files,
  max,
  locked,
  onUpload,
  onRemove,
  onOpen,
  removingId,
}: KycSlotFieldProps) {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceOpen, setSourceOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const single = max === 1;
  const remaining = Math.max(0, max - files.length);
  // A single slot is never "full" — the upload replaces what is there.
  const full = !single && remaining === 0;

  const handleFiles = useCallback(
    async (picked: File[]) => {
      if (picked.length === 0) return;
      setError(null);

      // A client-side gate over the same rules the server enforces. The server's
      // answer is the authority — this only keeps an obviously-doomed upload off
      // a mobile connection, which on a 10 MB scan is the difference between an
      // instant message and a minute of waiting for a 422.
      // A single slot takes one file and replaces; a multi slot takes at most
      // what is left. `remaining` is guaranteed > 0 here — the Add control is
      // unmounted once the slot is full — but slicing to it rather than to a
      // `|| picked.length` fallback keeps that a truth rather than a wager.
      const accepted = single ? picked.slice(0, 1) : picked.slice(0, remaining);

      // ⚠ `kycFileTypeIsWrong`, not a bare `includes(f.type)`. On the native
      // shell `File.type` is routinely empty or `application/octet-stream`, and
      // rejecting on that grounds refuses camera captures and scanner PDFs the
      // server would have taken.
      const wrongType = accepted.find(kycFileTypeIsWrong);
      if (wrongType) {
        setError(t('account.verification.upload.wrongType', { name: wrongType.name }));
        return;
      }

      const tooLarge = accepted.find((f) => f.size > KYC_MAX_FILE_BYTES);
      if (tooLarge) {
        setError(t('account.verification.upload.tooLarge', { name: tooLarge.name }));
        return;
      }

      if (!single && picked.length > remaining) {
        setError(t('account.verification.upload.slotFull', { max, current: files.length }));
        return;
      }

      if (accepted.length > KYC_MAX_FILES_PER_REQUEST) {
        setError(t('account.verification.upload.tooMany', { max: KYC_MAX_FILES_PER_REQUEST }));
        return;
      }

      setUploading(true);
      try {
        await onUpload(slot, accepted);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setUploading(false);
      }
    },
    [single, remaining, max, files.length, onUpload, slot, t],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const list = Array.from(e.target.files ?? []);
      // Cleared before the await so picking the same file twice in a row still
      // fires a change event.
      e.target.value = '';
      if (list.length) void handleFiles(list);
    },
    [handleFiles],
  );

  const requestUpload = useCallback(() => {
    if (nativeMediaAvailable) setSourceOpen(true);
    else inputRef.current?.click();
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label>{label}</Label>
        <RequirementBadge required={required} />
      </div>

      <div className="flex flex-wrap items-start gap-3">
        {files.map((doc) => (
          <KycDocumentTile
            key={doc.id}
            doc={doc}
            label={label}
            onOpen={() => onOpen(doc, label)}
            onRemove={locked ? undefined : () => void onRemove(slot, doc.id)}
            removing={removingId === doc.id}
          />
        ))}

        {!locked && !full && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept={KYC_ACCEPT_ATTR}
              multiple={!single}
              className="hidden"
              onChange={handleInputChange}
            />
            <UploadSourceSheet
              open={sourceOpen}
              onOpenChange={setSourceOpen}
              onPicked={handleFiles}
              onBrowseFiles={() => inputRef.current?.click()}
              multiple={!single}
              // Never a video: this is a scan of a document.
              allowVideo={false}
            />
            <Button
              type="button"
              variant="outline"
              disabled={uploading}
              onClick={requestUpload}
              className="size-24 flex-col gap-1.5 border-dashed text-xs font-normal"
            >
              {uploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : single && files.length > 0 ? (
                <Upload className="size-4" />
              ) : (
                <Plus className="size-4" />
              )}
              {single && files.length > 0
                ? t('account.verification.upload.replace')
                : t('account.verification.upload.add')}
            </Button>
          </>
        )}
      </div>

      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {!single && !locked && (
        <p className="text-xs text-muted-foreground">
          {t('account.verification.upload.remaining', { current: files.length, max })}
        </p>
      )}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
