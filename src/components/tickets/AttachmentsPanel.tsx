import { useEffect, useState } from 'react';
import { Loader2, Upload, FileText, ImageIcon, Download, Globe, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { MediaPicker } from '@/components/features/MediaPicker';
import { FollowerSelect } from '@/components/tickets/FollowerSelect';
import { fetchAttachments, attachFile } from '@/services/tickets.service';
import { ApiError } from '@/types/api';
import {
  MAX_ATTACHMENTS, ROLE_LABEL_KEYS,
} from '@/components/tickets/ticket.constants';
import { useApiError, useFormatters, useTranslation } from '@/i18n';
import type { ApiTicketAttachment, TicketActor, VisibilityInput } from '@/types/tickets.types';
import type { ApiFile } from '@/types/file.types';

export function AttachmentsPanel({
  ticketId, followers, readOnly = false,
}: { ticketId: string; followers: TicketActor[]; readOnly?: boolean }) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const apiError = useApiError();
  const [attachments, setAttachments] = useState<ApiTicketAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [visibility, setVisibility] = useState<VisibilityInput>('PUBLIC');
  const [viewerIds, setViewerIds] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchAttachments(ticketId)
      .then((data) => active && setAttachments(data))
      .catch((err) => {
        if (active) apiError.toast(err, { fallbackKey: 'tickets.detail.attachmentsLoadFailed' });
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [ticketId]);

  const remaining = MAX_ATTACHMENTS - attachments.length;
  const atLimit = remaining <= 0;

  async function handleSelect(files: ApiFile[]) {
    setPickerOpen(false);
    const toAttach = files.slice(0, remaining);
    if (toAttach.length === 0) return;
    setUploading(true);
    try {
      for (const f of toAttach) {
        const att = await attachFile(ticketId, {
          fileId: f.id,
          visibility,
          visibleToUserIds: visibility === 'PRIVATE' && viewerIds.length ? viewerIds : undefined,
        });
        setAttachments((prev) => [...prev, att]);
      }
      toast.success(t('tickets.detail.attachmentsAttached', { count: toAttach.length }));
    } catch (err) {
      if (err instanceof ApiError && err.code === 'TICKET_ATTACHMENT_LIMIT_EXCEEDED') {
        toast.error(t('tickets.detail.attachmentsLimit', { max: MAX_ATTACHMENTS }));
      } else if (err instanceof ApiError && err.code === 'TICKET_ACCESS_DENIED') {
        toast.error(t('tickets.detail.attachmentNotYours'));
      } else {
        apiError.toast(err, { fallbackKey: 'tickets.detail.attachmentFailed' });
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">{t('tickets.detail.attachments')}</h3>
        {!loading && (
          <span className="text-xs text-muted-foreground">{attachments.length}/{MAX_ATTACHMENTS}</span>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : (
        <ul className="space-y-2">
          {attachments.map((att) => {
            const isImage = att.mimeType.startsWith('image/');
            const uploader = att.uploadedByActor?.name ?? t(ROLE_LABEL_KEYS[att.uploadedByRole]);
            return (
              <li key={att.id} className="flex items-center gap-3 rounded-lg border bg-card p-2.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                  {isImage ? (
                    <img src={att.url} alt={att.fileName} crossOrigin="use-credentials" className="h-full w-full object-cover" />
                  ) : (
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{att.fileName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {t('tickets.detail.uploadedBy', {
                      size: fmt.fileSize(att.fileSize),
                      name: uploader,
                    })}
                  </p>
                </div>
                <a
                  href={att.url}
                  target="_blank"
                  rel="noreferrer"
                  download={att.fileName}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label={t('tickets.detail.download', { name: att.fileName })}
                >
                  <Download className="h-4 w-4" />
                </a>
              </li>
            );
          })}
        </ul>
      )}

      {!loading && readOnly && attachments.length === 0 && (
        <p className="flex items-center justify-center gap-2 rounded-lg border border-dashed py-3 text-sm text-muted-foreground/70">
          <Lock className="h-3.5 w-3.5" />
          {t('tickets.detail.attachmentsClosed')}
        </p>
      )}

      {!loading && !readOnly && !atLimit && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-md border p-0.5">
              <VisibilityToggle
                active={visibility === 'PUBLIC'}
                onClick={() => { setVisibility('PUBLIC'); setViewerIds([]); }}
                icon={<Globe className="h-3.5 w-3.5" />}
                label={t('tickets.detail.public')}
              />
              <VisibilityToggle
                active={visibility === 'PRIVATE'}
                onClick={() => setVisibility('PRIVATE')}
                icon={<Lock className="h-3.5 w-3.5" />}
                label={t('tickets.detail.private')}
              />
            </div>
            {visibility === 'PRIVATE' && (
              <FollowerSelect followers={followers} value={viewerIds} onChange={setViewerIds} />
            )}
          </div>

          <button
            type="button"
            disabled={uploading}
            onClick={() => setPickerOpen(true)}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-lg border border-dashed py-3 text-sm font-medium transition-colors',
              'text-muted-foreground hover:border-primary/50 hover:text-foreground',
            )}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {t(uploading ? 'tickets.detail.attaching' : 'tickets.detail.uploadAttachment')}
          </button>
        </div>
      )}

      {!loading && !readOnly && atLimit && (
        <p className="flex items-center justify-center gap-2 rounded-lg border border-dashed py-3 text-sm text-muted-foreground/70">
          <ImageIcon className="h-4 w-4" />
          {t('tickets.detail.attachmentsAtLimit', { max: MAX_ATTACHMENTS })}
        </p>
      )}

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleSelect}
        multiple={remaining > 1}
        maxFiles={remaining}
      />
    </section>
  );
}

function VisibilityToggle({
  active, onClick, icon, label,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors',
        active ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {icon}
      {label}
    </button>
  );
}
