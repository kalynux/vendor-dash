import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { nameInitials } from '@/components/customers/customer.constants';

interface CustomerAvatarProps {
  name: string;
  avatar?: string | null;
  className?: string;
}

/** Customer avatar: photo when present, falling back to name initials. */
export function CustomerAvatar({ name, avatar, className }: CustomerAvatarProps) {
  return (
    <Avatar className={cn('h-10 w-10', className)}>
      {avatar && <AvatarImage src={avatar} alt={name} />}
      <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
        {nameInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
