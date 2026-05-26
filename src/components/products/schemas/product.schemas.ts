import { z } from 'zod';
import type { ApiProductType, ApiVariant } from '@/types/product.types';

// ─── Step 2: Basic Info ───────────────────────────────────────────────────────
// Validation rules derived exactly from API spec (products.md field constraints)

export const basicInfoSchema = z.object({
  title: z
    .string()
    .min(3, 'Title must be at least 3 characters')
    .max(200, 'Title must be 200 characters or less'),
  category: z.string().min(1, 'Category is required'),
  description: z.string().min(1, 'Description is required'),
  tags: z
    .array(z.string().min(1, 'Tag cannot be empty'))
    .refine(
      (arr) => new Set(arr).size === arr.length,
      { message: 'Tags must be unique' },
    )
    .default([]),
  seoTitle: z
    .string()
    .max(60, 'SEO title must be 60 characters or less')
    .optional()
    .or(z.literal('')),
  seoDescription: z
    .string()
    .max(160, 'SEO description must be 160 characters or less')
    .optional()
    .or(z.literal('')),
});

export type BasicInfoFormValues = z.infer<typeof basicInfoSchema>;

// ─── Step 4: Option Builder (physical products) ───────────────────────────────

export const optionDraftSchema = z.object({
  tempId: z.string(),
  name: z
    .string()
    .min(1, 'Option name is required')
    .max(50, 'Option name must be 50 characters or less'),
  values: z
    .array(z.string().min(1, 'Value cannot be empty'))
    .min(1, 'At least one value is required')
    .refine(
      (arr) => new Set(arr.map((v) => v.toLowerCase())).size === arr.length,
      { message: 'Option values must be unique' },
    ),
});

export type OptionDraftValues = z.infer<typeof optionDraftSchema>;

// ─── Step 4: Variant Row (physical products) ──────────────────────────────────
// Constraints from variants.md

export const variantRowSchema = z.object({
  tempId: z.string(),
  sku: z
    .string()
    .min(1, 'SKU is required')
    .max(100, 'SKU must be 100 characters or less'),
  price: z.number({ message: 'Price is required' }).min(0, 'Price must be 0 or more'),
  compareAtPrice: z
    .number()
    .min(0, 'Compare-at price must be 0 or more')
    .optional(),
  stock: z
    .number({ message: 'Stock must be a number' })
    .int('Stock must be a whole number')
    .min(0, 'Stock cannot be negative')
    .default(0),
  isInfiniteStock: z.boolean().default(false),
  weight: z.number().min(0, 'Weight must be 0 or more').optional(),  // grams
  length: z.number().min(0, 'Length must be 0 or more').optional(),  // cm
  width: z.number().min(0, 'Width must be 0 or more').optional(),    // cm
  height: z.number().min(0, 'Height must be 0 or more').optional(),  // cm
  // optionValueIds and combination are managed separately, not in the schema
});

export type VariantRowFormValues = z.infer<typeof variantRowSchema>;

// ─── Step 5 (digital): License Tier / Pricing Variant ────────────────────────

export const licenseTierSchema = z.object({
  tempId: z.string(),
  sku: z
    .string()
    .min(1, 'SKU is required')
    .max(100, 'SKU must be 100 characters or less'),
  name: z.string().min(1, 'License tier name is required'),
  price: z.number({ message: 'Price is required' }).min(0, 'Price must be 0 or more'),
  compareAtPrice: z
    .number()
    .min(0, 'Compare-at price must be 0 or more')
    .optional(),
});

export type LicenseTierFormValues = z.infer<typeof licenseTierSchema>;

// ─── Digital Config ───────────────────────────────────────────────────────────

export const digitalConfigSchema = z.object({
  maxDownloads: z
    .number()
    .int('Must be a whole number')
    .min(1, 'Must be at least 1')
    .nullable()
    .default(null),
  expiresAfterDays: z
    .number()
    .int('Must be a whole number')
    .min(1, 'Must be at least 1 day')
    .nullable()
    .default(null),
});

export type DigitalConfigFormValues = z.infer<typeof digitalConfigSchema>;

// ─── Client-side activation pre-flight ───────────────────────────────────────
// Mirrors backend rules from products.md "Activation Requirements" section.

export function validateActivation(params: {
  productType: ApiProductType;
  description: string;
  variants: Pick<ApiVariant, 'price' | 'status'>[];
  defaultVariantId: string | null;
  digitalAssetId: string | undefined;
}): string[] {
  const errors: string[] = [];

  if (!params.description.trim()) {
    errors.push('A product description is required');
  }

  const activeVariants = params.variants.filter((v) => v.status === 'active');

  if (activeVariants.length === 0) {
    errors.push('At least one active variant is required');
  }

  const zeroPriced = activeVariants.filter((v) => v.price <= 0);
  if (zeroPriced.length > 0) {
    errors.push('All active variants must have a price greater than 0');
  }

  if (!params.defaultVariantId) {
    errors.push('A default variant must be set');
  }

  if (params.productType === 'digital' && !params.digitalAssetId) {
    errors.push('A digital asset file must be uploaded before publishing');
  }

  return errors;
}
