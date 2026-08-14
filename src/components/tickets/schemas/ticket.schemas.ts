import { z } from 'zod';
import {
  TICKET_IMPORTANCES, ENTITY_TYPES, TRACKING_NUMBER_MAX, MAX_CREATE_ATTACHMENTS,
  SUBJECT_MAX_LENGTH, DESCRIPTION_CREATE_MAX, DESCRIPTION_UPDATE_MAX, NOTE_MAX_LENGTH,
} from '@/components/tickets/ticket.constants';

// Validation rules derived exactly from api-doc/vendor/tickets.md field constraints.

const subjectField = z
  .string()
  .min(1, 'tickets.validation.subjectMin')
  .max(SUBJECT_MAX_LENGTH, 'tickets.validation.subjectMax');

/**
 * The two description ceilings genuinely differ, and this is not a transcription
 * slip: creating a ticket caps the description at 700 characters, editing one
 * afterwards allows 10000. Sending the create limit to the edit form would
 * refuse text the API accepts, and the reverse would be refused after a round
 * trip — so each carries its own.
 */
const description = (max: number) =>
  z
    .string()
    .min(1, 'tickets.validation.descriptionMin')
    .max(max, 'tickets.validation.descriptionMax');

// ─── Create ───────────────────────────────────────────────────────────────────

const baseCreateTicketSchema = z.object({
  subject: subjectField,
  description: description(DESCRIPTION_CREATE_MAX),
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

    // entityId is required for every entity type except `OTHER`, where the
    // backend defaults it to the requester's own id. `VENDOR` also has no
    // picker, but its id is filled in by the form rather than by the server.
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
  description: description(DESCRIPTION_UPDATE_MAX),
});

export type EditTicketFormValues = z.infer<typeof editTicketSchema>;

// ─── Note ─────────────────────────────────────────────────────────────────────

// The field is `content`, and note visibility is LOWERCASE — while attachment
// visibility on the same ticket is uppercase. The two validators genuinely
// disagree; each is sent exactly as its own endpoint documents it.
export const noteSchema = z.object({
  content: z
    .string()
    .min(1, 'tickets.validation.noteRequired')
    .max(NOTE_MAX_LENGTH, 'tickets.validation.noteMax'),
  visibility: z.enum(['public', 'private']).default('public'),
});

export type NoteFormValues = z.infer<typeof noteSchema>;
