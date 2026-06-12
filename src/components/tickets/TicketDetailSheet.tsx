import { useEffect, useMemo, useState } from 'react';
import {
  Loader2, Lock, Pencil, X, Check, CircleSlash, Info, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { NotesThread } from '@/components/tickets/NotesThread';
import { AttachmentsPanel } from '@/components/tickets/AttachmentsPanel';
import { ActorAvatar } from '@/components/tickets/ActorAvatar';
import {
  STATUS_LABELS, STATUS_BADGE_CLASSES, STATUS_DOT_CLASSES, TICKET_STATUSES,
  PRIORITY_LABELS, PRIORITY_BADGE_CLASSES, PRIORITY_DOT_CLASSES, TICKET_PRIORITIES,
  IMPORTANCE_LABELS, IMPORTANCE_BADGE_CLASSES, WAITING_STATUS_ROLE,
  TICKET_TYPE_LABELS, ROLE_LABELS, getTypeVisual, shortTicketRef, relativeTime,
  responsiveSheetProps, DESCRIPTION_MAX_LENGTH,
} from '@/components/tickets/ticket.constants';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  fetchTicketById, updateTicket, updateTicketStatus, updateTicketPriority, closeTicket,
} from '@/services/tickets.service';
import { ApiError } from '@/types/api';
import type {
  ApiTicketDetail, ApiTicketMutation, TicketStatus, TicketActorRole, UpdatablePriority,
} from '@/types/tickets.types';

interface TicketDetailSheetProps {
  ticketId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after any mutation so the list can refresh. */
  onUpdated: (ticket: ApiTicketMutation) => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function TicketDetailSheet({ ticketId, open, onOpenChange, onUpdated }: TicketDetailSheetProps) {
  const [ticket, setTicket] = useState<ApiTicketDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [draftSubject, setDraftSubject] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const [statusBusy, setStatusBusy] = useState(false);
  const [priorityBusy, setPriorityBusy] = useState(false);
  const [closing, setClosing] = useState(false);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);

  const isMobile = useIsMobile();
  const sheet = responsiveSheetProps(isMobile, 'sm:max-w-2xl lg:max-w-4xl');

  useEffect(() => {
    if (!open || !ticketId) return;
    let active = true;
    setLoading(true);
    setError(null);
    setEditing(false);
    setTicket(null);
    fetchTicketById(ticketId)
      .then((data) => {
        if (!active) return;
        setTicket(data);
        setDraftSubject(data.subject);
        setDraftDescription(data.description);
      })
      .catch((err) => {
        if (active) setError(err instanceof ApiError ? err.message : 'Failed to load ticket');
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [open, ticketId]);

  function applyUpdate(patch: ApiTicketMutation) {
    setTicket((prev) => (prev ? { ...prev, ...patch } : prev));
    onUpdated(patch);
  }

  async function saveEdit() {
    if (!ticket) return;
    setSavingEdit(true);
    try {
      const updated = await updateTicket(ticket._id, {
        subject: draftSubject,
        description: draftDescription,
      });
      applyUpdate(updated);
      setEditing(false);
      toast.success('Ticket updated');
    } catch (err) {
      if (err instanceof ApiError && err.isForbidden) {
        toast.error('Only the ticket creator can edit these details.');
      } else {
        toast.error(err instanceof ApiError ? err.message : 'Failed to update ticket');
      }
    } finally {
      setSavingEdit(false);
    }
  }

  async function changeStatus(status: TicketStatus) {
    if (!ticket || status === ticket.status) return;
    setStatusBusy(true);
    try {
      const updated = await updateTicketStatus(ticket._id, status);
      applyUpdate(updated);
      toast.success('Status updated');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'TICKET_WAITING_TARGET_NOT_PARTICIPANT') {
        toast.error('No participant with that role is on this ticket to wait on.');
      } else if (err instanceof ApiError && err.isValidation) {
        toast.error('That status change isn’t allowed from the current state.');
      } else {
        toast.error(err instanceof ApiError ? err.message : 'Failed to update status');
      }
    } finally {
      setStatusBusy(false);
    }
  }

  async function changePriority(priority: UpdatablePriority) {
    if (!ticket || priority === ticket.priority) return;
    setPriorityBusy(true);
    try {
      const updated = await updateTicketPriority(ticket._id, priority);
      applyUpdate(updated);
      toast.success('Priority updated');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'PRIORITY_LOCKED') {
        toast.error('Priority is locked by an admin and cannot be changed.');
      } else {
        toast.error(err instanceof ApiError ? err.message : 'Failed to update priority');
      }
    } finally {
      setPriorityBusy(false);
    }
  }

  async function handleClose() {
    if (!ticket) return;
    setClosing(true);
    try {
      const updated = await closeTicket(ticket._id);
      applyUpdate(updated);
      setConfirmCloseOpen(false);
      toast.success('Ticket closed');
    } catch (err) {
      if (err instanceof ApiError && err.isForbidden) {
        toast.error('Only the ticket creator or an admin can close this ticket.');
      } else {
        toast.error(err instanceof ApiError ? err.message : 'Failed to close ticket');
      }
    } finally {
      setClosing(false);
    }
  }

  const isClosed = ticket?.status === 'closed';
  const assignee = ticket?.assigned_admin ?? ticket?.assigned_to ?? null;
  const TypeIcon = ticket ? getTypeVisual(ticket.type).Icon : null;

  // Roles present on the ticket — a `waiting_on_<role>` status is only allowed
  // when a participant with that role exists (admin is always allowed).
  const participantRoles = useMemo(() => {
    const roles = new Set<TicketActorRole>();
    if (!ticket) return roles;
    roles.add(ticket.created_by_role);
    if (ticket.assigned_to?.role) roles.add(ticket.assigned_to.role);
    if (ticket.assigned_admin?.role) roles.add(ticket.assigned_admin.role);
    ticket.followers.forEach((f) => roles.add(f.role));
    return roles;
  }, [ticket]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={sheet.side} className={cn('p-0', sheet.className)}>
        {/* Header */}
        <SheetHeader className="gap-3 border-b pr-20">
          {ticket ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status={ticket.status} />
                <PriorityPill priority={ticket.priority} locked={ticket.priority_locked} />
                <span className="font-mono text-xs text-muted-foreground">{shortTicketRef(ticket._id)}</span>
              </div>
              <SheetTitle className="text-lg leading-snug">{ticket.subject}</SheetTitle>
            </>
          ) : (
            <SheetTitle>{loading ? 'Loading ticket…' : 'Ticket'}</SheetTitle>
          )}

          {ticket && !isClosed && (
            <button
              type="button"
              onClick={() => setEditing((e) => !e)}
              className="absolute right-12 top-4 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground opacity-70 transition hover:bg-accent hover:opacity-100"
              aria-label="Edit ticket"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
        </SheetHeader>

        <SheetBody className="p-4">
          {loading ? (
            <DetailSkeleton />
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <XCircle className="h-8 w-8 text-destructive" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Close</Button>
            </div>
          ) : ticket ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Main column */}
              <div className="space-y-6 lg:col-span-2">
                {/* Description (inline editable) */}
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold">Description</h3>
                  {editing ? (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="edit-subject">Subject</Label>
                        <Input
                          id="edit-subject"
                          value={draftSubject}
                          onChange={(e) => setDraftSubject(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="edit-description">Description</Label>
                        <Textarea
                          id="edit-description"
                          rows={6}
                          maxLength={DESCRIPTION_MAX_LENGTH}
                          value={draftDescription}
                          onChange={(e) => setDraftDescription(e.target.value)}
                        />
                        <p className="text-right text-xs tabular-nums text-muted-foreground">
                          {draftDescription.length}/{DESCRIPTION_MAX_LENGTH}
                        </p>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={savingEdit}
                          onClick={() => {
                            setEditing(false);
                            setDraftSubject(ticket.subject);
                            setDraftDescription(ticket.description);
                          }}
                        >
                          <X className="mr-2 h-3.5 w-3.5" /> Cancel
                        </Button>
                        <Button size="sm" onClick={saveEdit} disabled={savingEdit}>
                          {savingEdit ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-2 h-3.5 w-3.5" />}
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                      {ticket.description}
                    </p>
                  )}
                </section>

                <AttachmentsPanel ticketId={ticket._id} followers={ticket.followers} readOnly={isClosed} />

                <NotesThread ticketId={ticket._id} followers={ticket.followers} readOnly={isClosed} />
              </div>

              {/* Sidebar */}
              <aside className="space-y-6 lg:col-span-1">
                {/* Status + Priority — side by side on mobile, stacked in the desktop sidebar */}
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-1 lg:gap-6">
                {/* Status control */}
                <SidebarSection label="Status">
                  <Select
                    value={ticket.status}
                    onValueChange={(v) => {
                      if (v === 'closed') setConfirmCloseOpen(true);
                      else changeStatus(v as TicketStatus);
                    }}
                    disabled={statusBusy || isClosed}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TICKET_STATUSES.map((s) => {
                        const role = WAITING_STATUS_ROLE[s];
                        const blocked = !!role && role !== 'admin' && !participantRoles.has(role);
                        return (
                          <SelectItem key={s} value={s} disabled={blocked}>
                            {STATUS_LABELS[s]}
                            {blocked && <span className="text-muted-foreground"> · no participant</span>}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </SidebarSection>

                {/* Priority control */}
                <SidebarSection label="Priority">
                  {ticket.priority_locked ? (
                    <div className="space-y-1.5">
                      <PriorityPill priority={ticket.priority} locked lockedLabel="Locked by admin" />
                      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <Info className="mt-0.5 h-3 w-3 shrink-0" />
                        An admin set this priority; it can no longer be changed.
                      </p>
                    </div>
                  ) : (
                    <Select
                      value={TICKET_PRIORITIES.includes(ticket.priority) ? ticket.priority : undefined}
                      onValueChange={(v) => changePriority(v as UpdatablePriority)}
                      disabled={priorityBusy || isClosed}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={PRIORITY_LABELS[ticket.priority]} />
                      </SelectTrigger>
                      <SelectContent>
                        {TICKET_PRIORITIES.map((p) => (
                          <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </SidebarSection>
                </div>

                <div className="space-y-3 border-t pt-4">
                  <InfoRow label="Type">
                    <span className="inline-flex items-center gap-1.5">
                      {TypeIcon && <TypeIcon className="h-3.5 w-3.5 text-muted-foreground" />}
                      {TICKET_TYPE_LABELS[ticket.type] ?? ticket.type}
                    </span>
                  </InfoRow>
                  <InfoRow label="Importance">
                    <Badge className={cn('border-0', IMPORTANCE_BADGE_CLASSES[ticket.importance])}>
                      {IMPORTANCE_LABELS[ticket.importance]}
                    </Badge>
                  </InfoRow>
                  <InfoRow label="Related to">
                    {ticket.entity ? (
                      <Badge variant="outline" className="max-w-full gap-1">
                        <span className="truncate">{ticket.entity.label}</span>
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">{ticket.entity_id || '—'}</span>
                    )}
                  </InfoRow>
                </div>

                {/* Assigned to */}
                <SidebarSection label="Assigned to" className="border-t pt-4">
                  {assignee ? (
                    <div className="flex items-center gap-2.5">
                      <ActorAvatar actor={assignee} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{assignee.name}</p>
                        <p className="text-xs text-muted-foreground">{ROLE_LABELS[assignee.role]}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Unassigned</p>
                  )}
                  <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                    <Info className="mt-0.5 h-3 w-3 shrink-0" />
                    Vendors can’t reassign tickets.
                  </p>
                </SidebarSection>

                {/* Followers */}
                <SidebarSection label="Followers" className="border-t pt-4">
                  <ul className="space-y-2">
                    {ticket.followers.length === 0 ? (
                      <li className="text-sm text-muted-foreground">No followers yet.</li>
                    ) : (
                      ticket.followers.map((f) => (
                        <li key={f.user_id} className="flex items-center gap-2.5">
                          <ActorAvatar actor={f} className="h-7 w-7" />
                          <div className="min-w-0">
                            <p className="truncate text-sm">{f.name}</p>
                            <p className="text-xs text-muted-foreground">{ROLE_LABELS[f.role]}</p>
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                  <p className="mt-2 text-xs text-muted-foreground">Up to 5 non-admin followers per ticket.</p>
                </SidebarSection>

                {/* Timeline meta */}
                <dl className="space-y-2 border-t pt-4 text-sm">
                  <MetaLine label="Created" value={formatDate(ticket.createdAt)} />
                  <MetaLine label="Last updated" value={relativeTime(ticket.updatedAt)} />
                  <MetaLine label="Ticket ID" value={shortTicketRef(ticket._id)} mono />
                </dl>
              </aside>
            </div>
          ) : null}
        </SheetBody>

        {ticket && !isClosed && (
          <SheetFooter className="border-t">
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmCloseOpen(true)}
              disabled={closing}
            >
              <CircleSlash className="mr-2 h-4 w-4" />
              Close ticket
            </Button>
          </SheetFooter>
        )}
      </SheetContent>

      <AlertDialog open={confirmCloseOpen} onOpenChange={(o) => !closing && setConfirmCloseOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close this ticket?</AlertDialogTitle>
            <AlertDialogDescription>
              Closing the ticket marks it as resolved. You won’t be able to change its
              priority or add new messages or attachments afterwards. This can’t be undone
              from here.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={closing}>Keep open</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleClose(); }}
              disabled={closing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {closing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CircleSlash className="mr-2 h-4 w-4" />}
              Close ticket
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}

// ─── Presentational helpers ───────────────────────────────────────────────────

function StatusPill({ status }: { status: TicketStatus }) {
  return (
    <Badge className={cn('gap-1.5 border-0 font-medium', STATUS_BADGE_CLASSES[status])}>
      <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT_CLASSES[status])} />
      {STATUS_LABELS[status]}
    </Badge>
  );
}

function PriorityPill({
  priority, locked, lockedLabel,
}: { priority: import('@/types/tickets.types').TicketPriority; locked?: boolean; lockedLabel?: string }) {
  return (
    <Badge className={cn('gap-1.5 border-0 font-medium', PRIORITY_BADGE_CLASSES[priority])}>
      <span className={cn('h-1.5 w-1.5 rounded-full', PRIORITY_DOT_CLASSES[priority])} />
      {PRIORITY_LABELS[priority]}
      {locked && <Lock className="h-3 w-3" />}
      {locked && lockedLabel && <span className="text-[10px] font-normal opacity-80">{lockedLabel}</span>}
    </Badge>
  );
}

function SidebarSection({
  label, children, className,
}: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right font-medium">{children}</span>
    </div>
  );
}

function MetaLine({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn('text-right', mono && 'font-mono text-xs')}>{value}</dd>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    </div>
  );
}
