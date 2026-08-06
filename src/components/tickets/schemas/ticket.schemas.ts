import { z } from 'zod';
import {
  TICKET_IMPORTANCES, ENTITY_TYPES, TRACKING_NUMBER_MAX, MAX_CREATE_ATTACHMENTS,
} from '@/components/tickets/ticket.constants';

// Validation rules derived exactly from api-doc/vendor/tickets.md field constraints.

const subjectField = z
  .string()
  .min(3, 'tickets.validation.subjectMin')
  .max(200, 'tickets.validation.subjectMax');

const descriptionField = z
  .string()
  .min(10, 'tickets.validation.descriptionMin')
  .max(5000, 'tickets.validation.descriptionMax');

// ─── Create ───────────────────────────────────────────────────────────────────

const baseCreateTicketSchema = z.object({
  subject: subjectField,
  description: descriptionField,
  // Type is one of the authoritative ticket_types.txt values; validated as a
  // non-empty string and narrowed to TicketType on submit.
  type: z.string().min(1, 'tickets.validation.typeRequired'),
  importance: z.enum(TICKET_IMPORTANCES as [string, ...string[]], {
    message: 'tickets.validation.importanceRequired',
  }),
  entityType: z.enum(ENTITY_TYPES as [string, ...string[]], {
    message: 'tickets.validation.entityTypeRequired',
  }),
  // Required for every entity type except `other` (where it defaults server-side to
  // the requester's own id). Enforced in the refine below so the rule can read entityType.
  entityId: z.string(),
  // Optional in general; conditionally required by the vendor's support policy.
  trackingNumber: z
    .string()
    .max(TRACKING_NUMBER_MAX, 'tickets.validation.trackingNumberMax'),
  attachments: z
    .array(z.string())
    .max(MAX_CREATE_ATTACHMENTS, 'tickets.validation.attachmentsMax'),
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
        message: 'tickets.validation.entityRequired',
      });
    }

    if (isOrder && requiredInfo.includes('tracking_number') && !val.trackingNumber.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['trackingNumber'],
        message: 'tickets.validation.trackingNumberRequired',
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
        message: 'tickets.validation.attachmentRequired',
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
    .min(1, 'tickets.validation.noteRequired')
    .max(2000, 'tickets.validation.noteMax'),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).default('PUBLIC'),
});

export type NoteFormValues = z.infer<typeof noteSchema>;
