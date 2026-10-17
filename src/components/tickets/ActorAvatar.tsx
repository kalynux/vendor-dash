import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { fileRefUrl } from '@/services/files.service';
import { actorInitials, ROLE_AVATAR_CLASSES, ROLE_LABEL_KEYS } from '@/components/tickets/ticket.constants';
import { useTranslation } from '@/i18n';
import type { TicketActor, TicketActorRole } from '@/types/tickets.types';

interface ActorAvatarProps {
  actor: TicketActor | null;
  /** Fallback role when actor is null (e.g. unresolved reference). */
  role?: TicketActorRole;
  /**
   * Name to draw the initials from instead of the actor's — for an
   * administrator, whose real name lives in a snapshot beside the actor.
   */
  name?: string | null;
  className?: string;
}

/** Avatar that shows the actor photo, falling back to role-tinted initials. */
export function ActorAvatar({ actor, role, name: nameOverride, className }: ActorAvatarProps) {
  const { t } = useTranslation();
  const effectiveRole = actor?.role ?? role ?? 'vendor';
  const name = nameOverride || actor?.name || t(ROLE_LABEL_KEYS[effectiveRole]);
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
