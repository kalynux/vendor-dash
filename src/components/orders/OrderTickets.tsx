import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Ticket as TicketIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useCurrentUserId } from '@/hooks/use-current-user-id';
import { fetchTickets } from '@/services/tickets.service';
import {
  ROLE_LABEL_KEYS, STATUS_BADGE_CLASSES, STATUS_LABEL_KEYS, ticketOpener,
} from '@/components/tickets/ticket.constants';
import { EarningsHoldBadge } from '@/components/tickets/EarningsHoldBadge';
import { useTranslation } from '@/i18n';
import type { ApiTicketListItem } from '@/types/tickets.types';

const MAX_SHOWN = 5;

/**
 * The tickets about one order — the customer's complaint, a delivery problem
 * from the agency, a refund notice from the platform, or the vendor's own.
 * The vendor follows all of them automatically, and this puts them where the
 * order is being looked at.
 *
 * Renders nothing when there are none (or the lookup fails): most orders have
 * no ticket, and an empty box on every one of them would be noise.
 */
export function OrderTickets({ orderId, className }: { orderId: string; className?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const currentUserId = useCurrentUserId();
  // Kept with the order it was read for, so another order never shows these.
  const [loaded, setLoaded] = useState<{ orderId: string; tickets: ApiTicketListItem[] } | null>(null);

  useEffect(() => {
    let active = true;
    fetchTickets({
      entityType: 'ORDER', entityId: orderId, limit: MAX_SHOWN, sortBy: 'updatedAt', sortOrder: 'desc',
    })
      .then((res) => active && setLoaded({ orderId, tickets: res.data }))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [orderId]);

  const tickets = loaded?.orderId === orderId ? loaded.tickets : [];
  if (tickets.length === 0) return null;

  return (
    <section className={cn('space-y-3', className)}>
      <h3 className="flex items-center gap-2 text-sm font-medium">
        <TicketIcon className="w-4 h-4 text-muted-foreground" />
        {t('tickets.orderTickets.title')}
      </h3>

      <ul className="divide-y">
        {tickets.map((ticket) => {
          const opener = ticketOpener(ticket);
          const roleLabel = t(ROLE_LABEL_KEYS[opener.role]);
          const mine = !!currentUserId && ticket.created_by_user_id === currentUserId;
          return (
            <li key={ticket._id}>
              <button
                type="button"
                onClick={() => navigate('/dashboard/tickets', { state: { openTicketId: ticket._id } })}
                className="flex w-full items-center gap-3 py-2.5 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{ticket.subject}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {mine
                      ? t('tickets.orderTickets.byYou')
                      : opener.name && opener.role !== 'admin'
                        ? t('tickets.list.fromRole', { name: opener.name, role: roleLabel })
                        : t('tickets.list.from', { name: opener.name ?? roleLabel })}
                  </span>
                  {/* Under the subject, not beside the status: the row has no room for two badges on a phone. */}
                  {ticket.holds_earnings && <EarningsHoldBadge className="mt-1" />}
                </span>
                <Badge className={cn('shrink-0 border-0 font-medium', STATUS_BADGE_CLASSES[ticket.status])}>
                  {t(STATUS_LABEL_KEYS[ticket.status])}
                </Badge>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
