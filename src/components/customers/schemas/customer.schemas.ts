import { z } from 'zod';
import {
  FLAG_NAME_MAX,
  FLAG_DESCRIPTION_MAX,
} from '@/components/customers/customer.constants';

// Validation rules derived from api-doc/vendor/customer-management.md.
//
// Every message is a *translation key*: the schema is built at module load,
// before any locale exists. `useMessage()` resolves them at the call site.

const hexColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'customers.validation.hexColor');

// ─── Flag create / edit ───────────────────────────────────────────────────────

export const flagSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'customers.validation.nameRequired')
    .max(FLAG_NAME_MAX, 'customers.validation.nameMax'),
  color: hexColor,
  description: z
    .string()
    .trim()
    .max(FLAG_DESCRIPTION_MAX, 'customers.validation.descriptionMax')
    .optional()
    .or(z.literal('')),
});

export type FlagFormValues = z.infer<typeof flagSchema>;
