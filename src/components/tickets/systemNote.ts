// ─── Ticket system notes → timeline events ────────────────────────────────────
// The server writes its own notes on a ticket (`is_system_note: true`) as fixed
// English sentences: who joined, a status change, a hand-over. They are events,
// not messages, and some carry things nobody should read (a raw user id).
//
// This turns the sentences the server is known to write into translated copy.
// Anything it does not recognise is shown as written, so a new kind of event
// still appears — in English — rather than vanishing.

import type { TranslationKey } from '@/i18n';
import {
  PRIORITY_LABEL_KEYS, ROLE_LABEL_KEYS, STATUS_LABEL_KEYS,
} from '@/components/tickets/ticket.constants';
import type { TicketActorRole, TicketPriority, TicketStatus } from '@/types/tickets.types';

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

// Keyed per role rather than interpolating one: "a delivery agent joined" and
// "an agency joined" take different articles in French.
const JOINED_KEYS: Record<TicketActorRole, TranslationKey> = {
  customer: 'tickets.events.joined.customer',
  vendor: 'tickets.events.joined.vendor',
  agency: 'tickets.events.joined.agency',
  agent: 'tickets.events.joined.agent',
  admin: 'tickets.events.joined.admin',
};

function has(map: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(map, key);
}

/** The line to print for a system note. */
export function describeSystemNote(content: string, t: Translate): string {
  const text = content.trim();
  let m: RegExpMatchArray | null;

  if ((m = text.match(/^User added as follower \(Role: (\w+)\)$/)) && has(JOINED_KEYS, m[1])) {
    return t(JOINED_KEYS[m[1] as TicketActorRole]);
  }
  if (text === 'User removed from followers') return t('tickets.events.removed');

  if (
    (m = text.match(/^Status changed from "(\w+)" to "(\w+)"$/))
    && has(STATUS_LABEL_KEYS, m[1]) && has(STATUS_LABEL_KEYS, m[2])
  ) {
    return t('tickets.events.statusChanged', {
      from: t(STATUS_LABEL_KEYS[m[1] as TicketStatus]),
      to: t(STATUS_LABEL_KEYS[m[2] as TicketStatus]),
    });
  }

  if (
    (m = text.match(/^Priority changed from "(\w+)" to "(\w+)"( and locked by admin)?$/))
    && has(PRIORITY_LABEL_KEYS, m[1]) && has(PRIORITY_LABEL_KEYS, m[2])
  ) {
    return t(m[3] ? 'tickets.events.priorityLocked' : 'tickets.events.priorityChanged', {
      from: t(PRIORITY_LABEL_KEYS[m[1] as TicketPriority]),
      to: t(PRIORITY_LABEL_KEYS[m[2] as TicketPriority]),
    });
  }

  if (text === 'Ticket closed') return t('tickets.events.closed');
  if (text === 'Ticket reopened by admin') return t('tickets.events.reopened');

  // `HOLD_NOTE_PAUSED` / `HOLD_NOTE_RELEASED` (2026-10-10, Wi-Mall protection).
  if (text === 'The earnings for this purchase are on hold while this request is open.') {
    return t('tickets.events.earningsHeld');
  }
  if (text === 'This request no longer holds the earnings for this purchase.') {
    return t('tickets.events.earningsReleased');
  }

  // "Assigned to vendor (User ID: 66f…)" — the id is the server's, never shown.
  if ((m = text.match(/^Assigned to (\w+) \(User ID: [0-9a-f]+\)$/i)) && has(ROLE_LABEL_KEYS, m[1])) {
    return t('tickets.events.assignedRole', { role: t(ROLE_LABEL_KEYS[m[1] as TicketActorRole]) });
  }
  if (text === 'Assigned to admin pool') return t('tickets.events.assignedSupport');
  if ((m = text.match(/^Claimed by (.+)$/))) return t('tickets.events.takenBy', { name: m[1] });
  // "Assigned to Kofi by Ama" — who handed it over is support's own business.
  if ((m = text.match(/^Assigned to (.+) by .+$/))) return t('tickets.events.takenBy', { name: m[1] });

  return content;
}
