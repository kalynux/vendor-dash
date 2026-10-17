import { useMemo } from 'react';
import { Users, Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { ActorAvatar } from '@/components/tickets/ActorAvatar';
import { ROLE_LABEL_KEYS } from '@/components/tickets/ticket.constants';
import { useTranslation } from '@/i18n';
import type { TicketActor } from '@/types/tickets.types';

interface FollowerSelectProps {
  followers: TicketActor[];
  /** The signed-in person — the author always sees their own private item. */
  currentUserId?: string | null;
  value: string[];
  onChange: (userIds: string[]) => void;
  disabled?: boolean;
}

/**
 * Picks which followers may see a PRIVATE note/attachment — built from the
 * ticket's own `followers`, so on an order ticket it offers the customer, the
 * agency and the agent. Admins and the author are included by the API on every
 * private item, so neither is offered as an explicit viewer.
 */
export function FollowerSelect({ followers, currentUserId, value, onChange, disabled }: FollowerSelectProps) {
  const { t } = useTranslation();
  const options = useMemo(
    () => followers.filter((f) => f.role !== 'admin' && f.user_id !== currentUserId),
    [followers, currentUserId],
  );
  const selected = useMemo(() => new Set(value), [value]);

  function toggle(userId: string) {
    const next = new Set(selected);
    if (next.has(userId)) next.delete(userId);
    else next.add(userId);
    onChange([...next]);
  }

  const label = value.length === 0
    ? t('tickets.followers.everyone')
    : t('tickets.followers.count', { count: value.length });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || options.length === 0}
          className="h-8 justify-between gap-2 font-normal"
        >
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {options.length === 0 ? t('tickets.followers.none') : label}
          </span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1">
        <p className="px-2 py-1.5 text-xs text-muted-foreground">
          {t('tickets.detail.followerHint')}
        </p>
        <ul className="max-h-56 overflow-y-auto">
          {options.map((f) => {
            const checked = selected.has(f.user_id);
            return (
              <li key={f.user_id}>
                <button
                  type="button"
                  onClick={() => toggle(f.user_id)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                >
                  <ActorAvatar actor={f} className="h-6 w-6" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{f.name || t(ROLE_LABEL_KEYS[f.role])}</span>
                    <span className="block text-xs text-muted-foreground">{t(ROLE_LABEL_KEYS[f.role])}</span>
                  </span>
                  <span
                    className={cn(
                      'flex h-4 w-4 items-center justify-center rounded border',
                      checked ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                    )}
                  >
                    {checked && <Check className="h-3 w-3" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
