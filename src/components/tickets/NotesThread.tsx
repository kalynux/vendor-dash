import { useEffect, useRef, useState } from 'react';
import { Loader2, Lock, Globe, Send, Info } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { fetchNotes, createNote } from '@/services/tickets.service';
import { ApiError } from '@/types/api';
import { ActorAvatar } from '@/components/tickets/ActorAvatar';
import { FollowerSelect } from '@/components/tickets/FollowerSelect';
import { ROLE_LABELS, relativeTime, NOTE_MAX_LENGTH } from '@/components/tickets/ticket.constants';
import type { ApiTicketNote, TicketActor, NoteVisibility } from '@/types/tickets.types';

export function NotesThread({
  ticketId, followers, readOnly = false,
}: { ticketId: string; followers: TicketActor[]; readOnly?: boolean }) {
  const [notes, setNotes] = useState<ApiTicketNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [visibility, setVisibility] = useState<NoteVisibility>('public');
  const [viewerIds, setViewerIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const listEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchNotes(ticketId)
      .then((data) => active && setNotes(data))
      .catch((err) => {
        if (active) toast.error(err instanceof ApiError ? err.message : 'Failed to load notes');
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [ticketId]);

  async function handleSend() {
    const trimmed = message.trim();
    if (!trimmed) return;
    if (trimmed.length > NOTE_MAX_LENGTH) {
      toast.error(`Note must be ${NOTE_MAX_LENGTH} characters or less`);
      return;
    }
    setSubmitting(true);
    try {
      const note = await createNote(ticketId, {
        content: trimmed,
        visibility,
        visibleToUserIds: visibility === 'private' && viewerIds.length ? viewerIds : undefined,
      });
      setNotes((prev) => [...prev, note]);
      setMessage('');
      requestAnimationFrame(() => listEndRef.current?.scrollIntoView({ behavior: 'smooth' }));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to post note');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">Conversation</h3>
        {!loading && notes.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {notes.length} note{notes.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-3/4" />
        </div>
      ) : notes.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          No messages yet. Start the conversation below.
        </p>
      ) : (
        <ul className="space-y-4">
          {notes.map((note) => (note.is_system_note ? (
            <li key={note._id} className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5" />
              <span>{note.content}</span>
              <span>·</span>
              <span>{relativeTime(note.created_at)}</span>
            </li>
          ) : (
            <li key={note._id} className="flex gap-3">
              <ActorAvatar actor={note.author} role={note.author_role} />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">
                    {note.author?.name ?? ROLE_LABELS[note.author_role]}
                  </span>
                  <Badge
                    variant="secondary"
                    className="px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wide"
                  >
                    {ROLE_LABELS[note.author_role]}
                  </Badge>
                  {note.visibility === 'private' && (
                    <Badge
                      variant="outline"
                      className="gap-1 border-amber-300 px-1.5 py-0 text-[10px] text-amber-700 dark:text-amber-400"
                    >
                      <Lock className="h-2.5 w-2.5" /> private
                    </Badge>
                  )}
                </div>
                <div className="rounded-lg rounded-tl-sm bg-muted/60 px-3 py-2 text-sm">
                  <p className="whitespace-pre-wrap">{note.content}</p>
                </div>
                <span className="text-xs text-muted-foreground">{relativeTime(note.created_at)}</span>
              </div>
            </li>
          )))}
          <div ref={listEndRef} />
        </ul>
      )}

      {/* Composer */}
      {readOnly ? (
        <p className="flex items-center justify-center gap-2 rounded-lg border border-dashed py-3 text-sm text-muted-foreground/70">
          <Lock className="h-3.5 w-3.5" />
          This ticket is closed. No new messages can be added.
        </p>
      ) : (
      <div className="space-y-2 rounded-lg border p-3">
        <Textarea
          rows={3}
          placeholder="Write a note…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={NOTE_MAX_LENGTH}
          className="resize-none border-0 px-0 shadow-none focus-visible:ring-0"
        />
        <div className="space-y-2 border-t pt-2">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex rounded-md border p-0.5">
              <VisibilityToggle
                active={visibility === 'public'}
                onClick={() => { setVisibility('public'); setViewerIds([]); }}
                icon={<Globe className="h-3.5 w-3.5" />}
                label="public"
              />
              <VisibilityToggle
                active={visibility === 'private'}
                onClick={() => setVisibility('private')}
                icon={<Lock className="h-3.5 w-3.5" />}
                label="private"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs tabular-nums text-muted-foreground">
                {message.length}/{NOTE_MAX_LENGTH}
              </span>
              <Button size="sm" onClick={handleSend} disabled={submitting || !message.trim()}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Send
              </Button>
            </div>
          </div>
          {visibility === 'private' && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Visible to:</span>
              <FollowerSelect followers={followers} value={viewerIds} onChange={setViewerIds} />
            </div>
          )}
        </div>
      </div>
      )}
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
