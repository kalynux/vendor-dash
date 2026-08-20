// ─── Upload source sheet ──────────────────────────────────────────────────────
// The camera-first chooser the native shell needs (CAPACITOR-PLAN.md → P4.3).
//
// On the web an Upload button opens the file dialog and that is the whole
// interaction — there is nothing else a browser can offer. On a phone there are
// three genuinely different answers to "where is the file", and the one vendors
// reach for most (photograph the product, right now) is the one a bare
// `<input type="file">` buries behind a detour through the Files app.
//
// This owns only the *choice*. The files it produces go to the same `onPicked`
// the file input already feeds, so every screen keeps its upload path, its
// validation, its progress bar and its layout. Rendering it on the web is
// harmless — it never opens, because nothing there sets `open`.
//
// ⚠ It belongs on the IMAGE-CAPABLE sites only — MediaPicker, MediaGallery and
// BrandingImageUpload. A camera-first sheet in front of a CSV import is
// nonsense, so `DigitalAssetUpload`, `PoliciesFields` and Inventory's CSV import
// keep clicking their hidden input directly.
//
// Component-only module on purpose: an exported constant or helper here would
// add a `react-refresh/only-export-components` error to a count the phase exit
// criteria track.

import { useState } from 'react';
import { Camera, FolderOpen, Images, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ResponsiveModal } from '@/components/services/ResponsiveModal';
import { pickMedia, type MediaSource } from '@/platform/media';
import { canOpenAppSettings, openAppSettings } from '@/platform/permissions';
import { useTranslation } from '@/i18n';

export interface UploadSourceSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Receives the chosen files, in the shape the screen's own uploader takes. */
  onPicked: (files: File[]) => void;
  /** Fall through to the screen's hidden `<input type="file">`. */
  onBrowseFiles: () => void;
  /** Allow a multi-selection from the library. */
  multiple?: boolean;
  /** Cap that selection, mirroring the caller's own upload limit. */
  limit?: number;
  /** Offer videos alongside photos. */
  allowVideo?: boolean;
}

export function UploadSourceSheet({
  open,
  onOpenChange,
  onPicked,
  onBrowseFiles,
  multiple = true,
  limit,
  allowVideo = true,
}: UploadSourceSheetProps) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState<MediaSource | null>(null);

  const choose = async (source: MediaSource) => {
    setBusy(source);
    try {
      const result = await pickMedia(source, {
        // A capture is one photo by definition; only the library multi-selects.
        multiple: multiple && source === 'gallery',
        limit,
        allowVideo,
      });

      switch (result.status) {
        case 'picked':
          onOpenChange(false);
          onPicked(result.files);
          return;

        // Backing out of the camera is not a failure and gets no message. The
        // sheet stays open so the vendor can pick a different source.
        case 'cancelled':
          return;

        case 'denied':
          toast.error(
            t(source === 'camera'
              ? 'media.upload.source.deniedCamera'
              : 'media.upload.source.deniedGallery'),
          );
          return;

        case 'blocked':
          // The one outcome where trying again cannot work: the OS will not
          // prompt for this permission any more, so the only route back is the
          // settings screen.
          toast.error(
            t(source === 'camera'
              ? 'media.upload.source.blockedCamera'
              : 'media.upload.source.blockedGallery'),
            canOpenAppSettings
              ? {
                  action: {
                    label: t('media.upload.source.openSettings'),
                    onClick: () => void openAppSettings(),
                  },
                }
              : undefined,
          );
          return;

        case 'unavailable':
          toast.error(t('media.upload.source.noCamera'));
          return;

        default:
          toast.error(t('media.upload.source.failed'));
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={t('media.upload.source.title')}
      description={t('media.upload.source.description')}
      // Three rows do not need most of a screen; `h-auto` lets the sheet size
      // itself instead of opening to the full 92vh the default assumes.
      mobileClassName="h-auto max-h-[92dvh]"
      desktopClassName="sm:max-w-sm"
      disableClose={busy !== null}
    >
      <div className="flex flex-col gap-2">
        <SourceRow
          icon={busy === 'camera' ? Loader2 : Camera}
          spinning={busy === 'camera'}
          label={t('media.upload.source.camera')}
          hint={t('media.upload.source.cameraHint')}
          disabled={busy !== null}
          onClick={() => void choose('camera')}
        />
        <SourceRow
          icon={busy === 'gallery' ? Loader2 : Images}
          spinning={busy === 'gallery'}
          label={t('media.upload.source.gallery')}
          hint={t('media.upload.source.galleryHint')}
          disabled={busy !== null}
          onClick={() => void choose('gallery')}
        />
        <SourceRow
          icon={FolderOpen}
          label={t('media.upload.source.files')}
          hint={t('media.upload.source.filesHint')}
          disabled={busy !== null}
          onClick={() => {
            onOpenChange(false);
            onBrowseFiles();
          }}
        />
      </div>
    </ResponsiveModal>
  );
}

interface SourceRowProps {
  icon: typeof Camera;
  label: string;
  hint: string;
  disabled?: boolean;
  spinning?: boolean;
  onClick: () => void;
}

function SourceRow({ icon: Icon, label, hint, disabled, spinning, onClick }: SourceRowProps) {
  return (
    <Button
      type="button"
      variant="outline"
      disabled={disabled}
      onClick={onClick}
      // Tall enough to be a comfortable thumb target, and left-aligned so the
      // three read as a list of destinations rather than a row of actions.
      className="h-auto justify-start gap-3 px-3 py-3 text-left"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className={spinning ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-medium leading-tight">{label}</span>
        <span className="text-xs font-normal leading-tight text-muted-foreground">{hint}</span>
      </span>
    </Button>
  );
}
