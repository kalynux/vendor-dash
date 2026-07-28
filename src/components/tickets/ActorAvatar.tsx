import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { fileRefUrl } from '@/services/files.service';
import { actorInitials, ROLE_AVATAR_CLASSES, ROLE_LABELS } from '@/components/tickets/ticket.constants';
import type { TicketActor, TicketActorRole } from '@/types/tickets.types';

interface ActorAvatarProps {
  actor: TicketActor | null;
  /** Fallback role when actor is null (e.g. unresolved reference). */
  role?: TicketActorRole;
  className?: string;
}

/** Avatar that shows the actor photo, falling back to role-tinted initials. */
export function ActorAvatar({ actor, role, className }: ActorAvatarProps) {
  const effectiveRole = actor?.role ?? role ?? 'vendor';
  const name = actor?.name ?? ROLE_LABELS[effectiveRole];
  const avatarUrl = fileRefUrl(actor?.avatar);
  return (
    <Avatar className={cn('h-8 w-8', className)}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
      <AvatarFallback className={cn('text-xs font-medium', ROLE_AVATAR_CLASSES[effectiveRole])}>
        {actorInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
