import { z } from 'zod';
import {
  TICKET_IMPORTANCES, ENTITY_TYPES, TRACKING_NUMBER_MAX, MAX_CREATE_ATTACHMENTS,
} from '@/components/tickets/ticket.constants';

// Validation rules derived exactly from api-doc/vendor/tickets.md field constraints.

const subjectField = z
  .string()
  .min(3, 'Subject must be at least 3 characters')
  .max(200, 'Subject must be 200 characters or less');

const descriptionField = z
  .string()
  .min(10, 'Description must be at least 10 characters')
  .max(5000, 'Description must be 5000 characters or less');

// ─── Create ───────────────────────────────────────────────────────────────────

const baseCreateTicketSchema = z.object({
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
  // Required for every entity type except `other` (where it defaults server-side to
  // the requester's own id). Enforced in the refine below so the rule can read entityType.
  entityId: z.string(),
  // Optional in general; conditionally required by the vendor's support policy.
  trackingNumber: z
    .string()
    .max(TRACKING_NUMBER_MAX, `Tracking number must be ${TRACKING_NUMBER_MAX} characters or less`),
  attachments: z
    .array(z.string())
    .max(MAX_CREATE_ATTACHMENTS, `You can attach at most ${MAX_CREATE_ATTACHMENTS} files`),
});

/**
 * Build the create-ticket schema, layering in the conditional requirements driven
 * by the vendor's support policy `required_info` (api-doc/vendor/tickets.md). The
 * `required_info` items are order/product-centric and are only enforced on the
 * relevant ticket contexts — never on booking/account/other tickets:
 *  - `order_number`        → satisfied implicitly by filing under an `order` entity (no field).
 *  - `tracking_number`     → required for `order` tickets only.
 *  - `product_photo_video` → required for `order` or `product` tickets (≥ 1 attachment).
 */
export function makeCreateTicketSchema(requiredInfo: string[] = []) {
  return baseCreateTicketSchema.superRefine((val, ctx) => {
    const isOrder = val.entityType === 'ORDER';
    const isProduct = val.entityType === 'PRODUCT';

    // entityId is required for every entity type except `OTHER`.
    if (val.entityType !== 'OTHER' && !val.entityId.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['entityId'],
        message: 'A related entity is required',
      });
    }

    if (isOrder && requiredInfo.includes('tracking_number') && !val.trackingNumber.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['trackingNumber'],
        message: 'A tracking number is required by your support policy.',
      });
    }

    if (
      (isOrder || isProduct) &&
      requiredInfo.includes('product_photo_video') &&
      val.attachments.length === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['attachments'],
        message: 'At least one photo or video attachment is required by your support policy.',
      });
    }
  });
}

// `type`/`importance`/`entityType` are validated as strings here and narrowed
// to their union types at submit time (see CreateTicketSheet).
export type CreateTicketFormValues = z.infer<typeof baseCreateTicketSchema>;

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
    .max(2000, 'Note must be 2000 characters or less'),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).default('PUBLIC'),
});

export type NoteFormValues = z.infer<typeof noteSchema>;
