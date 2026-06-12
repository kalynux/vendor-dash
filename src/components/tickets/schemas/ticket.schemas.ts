import { z } from 'zod';
import { TICKET_IMPORTANCES, ENTITY_TYPES } from '@/components/tickets/ticket.constants';

// Validation rules derived exactly from api-doc/vendor/tickets.md field constraints.

const subjectField = z
  .string()
  .min(3, 'Subject must be at least 3 characters')
  .max(200, 'Subject must be 200 characters or less');

const descriptionField = z
  .string()
  .min(10, 'Description must be at least 10 characters')
  .max(700, 'Description must be 700 characters or less');

// ─── Create ───────────────────────────────────────────────────────────────────

export const createTicketSchema = z.object({
  subject: subjectField,
  description: descriptionField,
  // Type is one of the authoritative ticket_types.txt values; validated as a
  // non-empty string and narrowed to TicketType on submit.
  type: z.string().min(1, 'Please select a ticket type'),
  importance: z.enum(TICKET_IMPORTANCES as [string, ...string[]], {
    message: 'Please select an importance level',
  }),
  entityType: z.enum(ENTITY_TYPES as [string, ...string[]], {
    message: 'Please select a related entity type',
  }),
  entityId: z.string().min(1, 'A related entity is required'),
});

// `type`/`importance`/`entityType` are validated as strings here and narrowed
// to their union types at submit time (see CreateTicketSheet).
export type CreateTicketFormValues = z.infer<typeof createTicketSchema>;

// ─── Edit (subject / description) ─────────────────────────────────────────────

export const editTicketSchema = z.object({
  subject: subjectField,
  description: descriptionField,
});

export type EditTicketFormValues = z.infer<typeof editTicketSchema>;

// ─── Note ─────────────────────────────────────────────────────────────────────

export const noteSchema = z.object({
  message: z
    .string()
    .min(1, 'Note cannot be empty')
    .max(300, 'Note must be 300 characters or less'),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).default('PUBLIC'),
});

export type NoteFormValues = z.infer<typeof noteSchema>;
