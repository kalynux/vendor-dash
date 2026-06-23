import { z } from 'zod';
import {
  FLAG_NAME_MAX,
  FLAG_DESCRIPTION_MAX,
} from '@/components/customers/customer.constants';

// Validation rules derived from api-doc/vendor/customer-management.md.

const hexColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Enter a hex colour like #FF8800');

// ─── Flag create / edit ───────────────────────────────────────────────────────

export const flagSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(FLAG_NAME_MAX, `Name must be ${FLAG_NAME_MAX} characters or less`),
  color: hexColor,
  description: z
    .string()
    .trim()
    .max(FLAG_DESCRIPTION_MAX, `Description must be ${FLAG_DESCRIPTION_MAX} characters or less`)
    .optional()
    .or(z.literal('')),
});

export type FlagFormValues = z.infer<typeof flagSchema>;
