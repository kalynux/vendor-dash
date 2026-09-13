// ─── Vendor Tickets — display constants ───────────────────────────────────────
// Label + colour maps and the authoritative grouped ticket-type list.
// Type values come from api-doc/ticket_types.txt (authoritative per task spec).

import type { LucideIcon } from 'lucide-react';
import {
  ShoppingCart, CreditCard, Wallet, Package, Calendar, Truck, Wrench, Bug,
  ShieldCheck, Scale, HelpCircle, LifeBuoy,
} from 'lucide-react';
import { asKey, type TranslationKey } from '@/i18n';
import type {
  TicketStatus,
  TicketPriority,
  TicketImportance,
  TicketEntityType,
  TicketType,
  TicketActorRole,
} from '@/types/tickets.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────
//
// This module has no React context, so every label below is a *translation key*
// that the rendering component resolves with `t`. That keeps one source of truth
// for the enum → copy mapping while still following a language switch.

/** Turn an UPPER_SNAKE enum value into a human "Title Case" label. */
export function humanizeEnum(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Catalog key for any backend ticket-type value. */
export function ticketTypeKey(type: string): TranslationKey {
  return asKey(`tickets.types.${type}`);
}

// ─── Status ───────────────────────────────────────────────────────────────────

export const TICKET_STATUSES: TicketStatus[] = [
  'open',
  'in_progress',
  'waiting_on_admin',
  'waiting_on_vendor',
  'waiting_on_customer',
  'waiting_on_agency',
  'waiting_on_agent',
  'resolved',
  'closed',
];

export const STATUS_LABEL_KEYS: Record<TicketStatus, TranslationKey> = {
  open: 'tickets.status.open',
  in_progress: 'tickets.status.in_progress',
  waiting_on_admin: 'tickets.status.waiting_on_admin',
  waiting_on_vendor: 'tickets.status.waiting_on_vendor',
  waiting_on_customer: 'tickets.status.waiting_on_customer',
  waiting_on_agency: 'tickets.status.waiting_on_agency',
  waiting_on_agent: 'tickets.status.waiting_on_agent',
  resolved: 'tickets.status.resolved',
  closed: 'tickets.status.closed',
};

export const STATUS_BADGE_CLASSES: Record<TicketStatus, string> = {
  open: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  in_progress: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  waiting_on_admin: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  waiting_on_vendor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  waiting_on_customer: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  waiting_on_agency: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  waiting_on_agent: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  resolved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  closed: 'bg-muted text-muted-foreground',
};

/** Dot colour used next to a status label in pills. */
export const STATUS_DOT_CLASSES: Record<TicketStatus, string> = {
  open: 'bg-blue-500',
  in_progress: 'bg-purple-500',
  waiting_on_admin: 'bg-orange-500',
  waiting_on_vendor: 'bg-amber-500',
  waiting_on_customer: 'bg-amber-500',
  waiting_on_agency: 'bg-teal-500',
  waiting_on_agent: 'bg-cyan-500',
  resolved: 'bg-green-500',
  closed: 'bg-muted-foreground/50',
};

/** The participant role a `waiting_on_<role>` status targets (admin is always allowed). */
export const WAITING_STATUS_ROLE: Partial<Record<TicketStatus, TicketActorRole>> = {
  waiting_on_admin: 'admin',
  waiting_on_vendor: 'vendor',
  waiting_on_customer: 'customer',
  waiting_on_agency: 'agency',
  waiting_on_agent: 'agent',
};

/**
 * Status filter tabs for the list view (curated subset; the full set is still
 * available in the detail status control). `null` = All. From the vendor's seat,
 * "Waiting on you" maps to `waiting_on_vendor`.
 */
export const STATUS_TABS: { labelKey: TranslationKey; value: TicketStatus | null }[] = [
  { labelKey: 'tickets.statusTabs.all', value: null },
  { labelKey: 'tickets.statusTabs.open', value: 'open' },
  { labelKey: 'tickets.statusTabs.in_progress', value: 'in_progress' },
  { labelKey: 'tickets.statusTabs.waiting_on_vendor', value: 'waiting_on_vendor' },
  { labelKey: 'tickets.statusTabs.waiting_on_admin', value: 'waiting_on_admin' },
  { labelKey: 'tickets.statusTabs.waiting_on_customer', value: 'waiting_on_customer' },
  { labelKey: 'tickets.statusTabs.waiting_on_agency', value: 'waiting_on_agency' },
  { labelKey: 'tickets.statusTabs.waiting_on_agent', value: 'waiting_on_agent' },
  { labelKey: 'tickets.statusTabs.resolved', value: 'resolved' },
  { labelKey: 'tickets.statusTabs.closed', value: 'closed' },
];

// ─── Priority ─────────────────────────────────────────────────────────────────

/** Priorities a vendor may set (the updatable enum, per tickets.md PATCH /priority). */
export const TICKET_PRIORITIES: TicketPriority[] = ['low', 'normal', 'high', 'urgent'];

export const PRIORITY_LABEL_KEYS: Record<TicketPriority, TranslationKey> = {
  low: 'tickets.priority.low',
  normal: 'tickets.priority.normal',
  high: 'tickets.priority.high',
  urgent: 'tickets.priority.urgent',
};

export const PRIORITY_BADGE_CLASSES: Record<TicketPriority, string> = {
  low: 'bg-muted text-muted-foreground',
  normal: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

/** Dot colour used next to a priority label in pills. */
export const PRIORITY_DOT_CLASSES: Record<TicketPriority, string> = {
  low: 'bg-muted-foreground/50',
  normal: 'bg-blue-500',
  high: 'bg-orange-500',
  urgent: 'bg-red-500',
};

// ─── Importance (create-time) ─────────────────────────────────────────────────

export const TICKET_IMPORTANCES: TicketImportance[] = ['low', 'medium', 'high', 'critical'];

export const IMPORTANCE_LABEL_KEYS: Record<TicketImportance, TranslationKey> = {
  low: 'tickets.importance.low',
  medium: 'tickets.importance.medium',
  high: 'tickets.importance.high',
  critical: 'tickets.importance.critical',
};

export const IMPORTANCE_BADGE_CLASSES: Record<TicketImportance, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

// ─── Entity types ─────────────────────────────────────────────────────────────

/**
 * `ACCOUNT` is gone from the API's enum — it is now `VENDOR`, whose `entityId`
 * is the vendor's own role-entity id (filled in for them, since there is nothing
 * to pick).
 */
export const ENTITY_TYPES: TicketEntityType[] = ['ORDER', 'PRODUCT', 'BOOKING', 'VENDOR', 'OTHER'];

export const ENTITY_TYPE_LABEL_KEYS: Record<TicketEntityType, TranslationKey> = {
  ORDER: 'tickets.entityType.ORDER',
  PRODUCT: 'tickets.entityType.PRODUCT',
  BOOKING: 'tickets.entityType.BOOKING',
  VENDOR: 'tickets.entityType.VENDOR',
  OTHER: 'tickets.entityType.OTHER',
};

/**
 * Entity types the vendor never picks an entity for — the id is either their own
 * (`VENDOR`) or filled in server-side (`OTHER`).
 */
export const ENTITY_TYPES_WITHOUT_PICKER: TicketEntityType[] = ['VENDOR', 'OTHER'];

// ─── Ticket types (grouped, authoritative) ────────────────────────────────────

export interface TicketTypeGroup {
  groupLabelKey: TranslationKey;
  values: { value: TicketType; labelKey: TranslationKey }[];
}

function group(groupLabelKey: TranslationKey, values: TicketType[]): TicketTypeGroup {
  return {
    groupLabelKey,
    values: values.map((value) => ({ value, labelKey: ticketTypeKey(value) })),
  };
}

export const TICKET_TYPE_GROUPS: TicketTypeGroup[] = [
  group('tickets.typeGroups.general', [
    'GENERAL_SUPPORT', 'ACCOUNT_ACCESS', 'ACCOUNT_VERIFICATION', 'PROFILE_UPDATE', 'SECURITY_ISSUE',
  ]),
  group('tickets.typeGroups.orders', [
    'ORDER_ISSUE', 'ORDER_CANCELLATION', 'ORDER_REFUND', 'ORDER_DISPUTE', 'ORDER_FULFILLMENT',
  ]),
  group('tickets.typeGroups.payments', [
    'PAYMENT_ISSUE', 'PAYMENT_FAILED', 'PAYMENT_CONFIRMATION', 'CHARGEBACK', 'INVOICE_REQUEST',
  ]),
  group('tickets.typeGroups.payouts', [
    'PAYOUT_REQUEST', 'PAYOUT_DELAY', 'PAYOUT_DISPUTE', 'COMMISSION_QUESTION',
  ]),
  group('tickets.typeGroups.bookings', [
    'BOOKING_ISSUE', 'BOOKING_CANCELLATION', 'BOOKING_RESCHEDULE', 'AVAILABILITY_PROBLEM',
  ]),
  group('tickets.typeGroups.products', [
    'PRODUCT_ISSUE', 'INVENTORY_PROBLEM', 'PRICING_ISSUE', 'VARIANT_ISSUE',
  ]),
  group('tickets.typeGroups.shipping', [
    'SHIPPING_ISSUE', 'DELIVERY_DELAY', 'DELIVERY_CONFIRMATION', 'ADDRESS_CHANGE',
  ]),
  group('tickets.typeGroups.technical', [
    'TECHNICAL_ISSUE', 'BUG_REPORT', 'INTEGRATION_ISSUE', 'API_ACCESS',
  ]),
  group('tickets.typeGroups.policy', [
    'POLICY_QUESTION', 'COMPLIANCE', 'LEGAL_REQUEST',
  ]),
  group('tickets.typeGroups.other', ['OTHER']),
];

// ─── Misc ─────────────────────────────────────────────────────────────────────

/** Maximum attachments per ticket (api-doc/vendor/tickets.md §Attachment Limits). */
export const MAX_ATTACHMENTS = 5;

/** Subject ceiling — the same on create and on edit. */
export const SUBJECT_MAX_LENGTH = 200;

/**
 * The description ceilings differ between the two endpoints, deliberately:
 * `POST /tickets` caps at 700 characters, `PATCH /tickets/:id` at 10000.
 */
export const DESCRIPTION_CREATE_MAX = 700;
export const DESCRIPTION_UPDATE_MAX = 10000;

/** Maximum attachments accepted at ticket-creation time (api-doc/vendor/tickets.md). */
export const MAX_CREATE_ATTACHMENTS = 5;

/** Max length of the optional tracking number sent at ticket creation. */
export const TRACKING_NUMBER_MAX = 120;

/** Character limits for free-text fields (kept in sync with ticket.schemas.ts). */
export const NOTE_MAX_LENGTH = 300;
// Superseded by DESCRIPTION_CREATE_MAX / DESCRIPTION_UPDATE_MAX above: the two
// endpoints cap the description differently, so one shared number was wrong on
// whichever form it wasn't written for.

/** Format bytes into a short human-readable size. */
// ─── Type icon / colour ───────────────────────────────────────────────────────
// Each ticket type maps to a lucide icon + tint, grouped by domain. Used for the
// list-row leading icon and the detail "Type" row.

interface TypeVisual {
  Icon: LucideIcon;
  className: string; // text + bg tint for the icon chip
}

const TYPE_VISUAL_BY_PREFIX: { test: (t: string) => boolean; visual: TypeVisual }[] = [
  { test: (t) => t.startsWith('ORDER'), visual: { Icon: ShoppingCart, className: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' } },
  { test: (t) => t.startsWith('PAYMENT') || t === 'CHARGEBACK' || t === 'INVOICE_REQUEST', visual: { Icon: CreditCard, className: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400' } },
  { test: (t) => t.startsWith('PAYOUT') || t === 'COMMISSION_QUESTION', visual: { Icon: Wallet, className: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' } },
  { test: (t) => t.startsWith('PRODUCT') || t === 'INVENTORY_PROBLEM' || t === 'PRICING_ISSUE' || t === 'VARIANT_ISSUE', visual: { Icon: Package, className: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' } },
  { test: (t) => t.startsWith('BOOKING') || t === 'AVAILABILITY_PROBLEM', visual: { Icon: Calendar, className: 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400' } },
  { test: (t) => t.startsWith('SHIPPING') || t.startsWith('DELIVERY') || t === 'ADDRESS_CHANGE', visual: { Icon: Truck, className: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400' } },
  { test: (t) => t === 'BUG_REPORT', visual: { Icon: Bug, className: 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400' } },
  { test: (t) => t.startsWith('TECHNICAL') || t === 'INTEGRATION_ISSUE' || t === 'API_ACCESS', visual: { Icon: Wrench, className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' } },
  { test: (t) => t.startsWith('ACCOUNT') || t === 'PROFILE_UPDATE' || t === 'SECURITY_ISSUE', visual: { Icon: ShieldCheck, className: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' } },
  { test: (t) => t === 'POLICY_QUESTION' || t === 'COMPLIANCE' || t === 'LEGAL_REQUEST', visual: { Icon: Scale, className: 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400' } },
  { test: (t) => t === 'GENERAL_SUPPORT', visual: { Icon: LifeBuoy, className: 'bg-muted text-muted-foreground' } },
];

const DEFAULT_TYPE_VISUAL: TypeVisual = { Icon: HelpCircle, className: 'bg-muted text-muted-foreground' };

export function getTypeVisual(type: string): TypeVisual {
  return TYPE_VISUAL_BY_PREFIX.find((m) => m.test(type))?.visual ?? DEFAULT_TYPE_VISUAL;
}

// ─── Actor helpers ────────────────────────────────────────────────────────────

export const ROLE_LABEL_KEYS: Record<TicketActorRole, TranslationKey> = {
  admin: 'tickets.role.admin',
  agent: 'tickets.role.agent',
  vendor: 'tickets.role.vendor',
  customer: 'tickets.role.customer',
  agency: 'tickets.role.agency',
};

/** Avatar fallback tint per role. */
export const ROLE_AVATAR_CLASSES: Record<TicketActorRole, string> = {
  admin: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  agent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  vendor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  customer: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  agency: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
};

/** Up to two initials from a display name. */
export function actorInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ─── Misc display helpers ─────────────────────────────────────────────────────

/** Short, friendly ticket reference, e.g. `tkt_7f3a91`. */
export function shortTicketRef(id: string): string {
  return `tkt_${id.slice(-6)}`;
}

/**
 * Compact relative time, e.g. "just now", "5m ago", "3d ago", or a date.
 * Takes the translator so it can be called from a component without this module
 * needing React context of its own.
 */
export function relativeTime(
  iso: string,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string,
  formatDate: (iso: string) => string,
): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const sec = Math.round((Date.now() - then) / 1000);
  if (sec < 45) return t('tickets.time.justNow');
  const min = Math.round(sec / 60);
  if (min < 60) return t('tickets.time.minutesAgo', { count: min });
  const hr = Math.round(min / 60);
  if (hr < 24) return t('tickets.time.hoursAgo', { count: hr });
  const day = Math.round(hr / 24);
  if (day < 30) return t('tickets.time.daysAgo', { count: day });
  return formatDate(iso);
}
