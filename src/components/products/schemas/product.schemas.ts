import { z } from 'zod';
import type { TranslationKey } from '@/i18n';
import { EMPTY_DOC, richDocSchema } from '@/lib/richtext';
import type { ApiProductType, ApiVariant } from '@/types/product.types';

// ─── Step 2: Basic Info ───────────────────────────────────────────────────────
// Validation rules derived exactly from API spec (products.md field constraints)
//
// Every message is a *translation key*, not a sentence: a zod schema is built at
// module load, long before a locale exists. The components that render these
// pipe `errors.<field>.message` through `useMessage()`, which resolves the key.

export const basicInfoSchema = z.object({
  title: z
    .string()
    .min(3, 'products.validation.titleMin')
    .max(200, 'products.validation.titleMax'),
  category: z.string().min(1, 'products.validation.categoryRequired'),
  /**
   * The plain-text projection of `descriptionRich`, written by the editor on
   * every change. It stays the validated field — so the required-ness rule, the
   * activation gate below and the backend's own `description` error projection
   * all keep working unchanged — and it is what actually ships to `description`
   * on the wire.
   */
  description: z.string().min(1, 'products.validation.descriptionRequired'),
  /**
   * Never validated for content: an empty document is caught by `description`
   * being empty, and a second error message on the same field would just be
   * noise. It is here so the form owns it and the payload builders can read it.
   */
  descriptionRich: richDocSchema.default(EMPTY_DOC),
  tags: z
    .array(z.string().min(1, 'products.validation.tagEmpty'))
    .refine(
      (arr) => new Set(arr).size === arr.length,
      { message: 'products.validation.tagsUnique' },
    )
    .default([]),
  seoTitle: z
    .string()
    .max(60, 'products.validation.seoTitleMax')
    .optional()
    .or(z.literal('')),
  seoDescription: z
    .string()
    .max(160, 'products.validation.seoDescriptionMax')
    .optional()
    .or(z.literal('')),
});

export type BasicInfoFormValues = z.infer<typeof basicInfoSchema>;

// ─── Step 4: Option Builder (physical products) ───────────────────────────────

export const optionDraftSchema = z.object({
  tempId: z.string(),
  name: z
    .string()
    .min(1, 'products.validation.optionNameRequired')
    .max(50, 'products.validation.optionNameMax'),
  values: z
    .array(z.string().min(1, 'products.validation.optionValueEmpty'))
    .min(1, 'products.validation.optionValueMin')
    .refine(
      (arr) => new Set(arr.map((v) => v.toLowerCase())).size === arr.length,
      { message: 'products.validation.optionValuesUnique' },
    ),
});

export type OptionDraftValues = z.infer<typeof optionDraftSchema>;

// ─── Step 4: Variant Row (physical products) ──────────────────────────────────
// Constraints from variants.md

export const variantRowSchema = z.object({
  tempId: z.string(),
  sku: z
    .string()
    .min(1, 'products.validation.skuRequired')
    .max(100, 'products.validation.skuMax'),
  price: z
    .number({ message: 'products.validation.priceRequired' })
    .min(0, 'products.validation.priceMin'),
  compareAtPrice: z
    .number()
    .min(0, 'products.validation.compareAtMin')
    .optional(),
  stock: z
    .number({ message: 'products.validation.stockNumber' })
    .int('products.validation.stockInteger')
    .min(0, 'products.validation.stockMin')
    .default(0),
  isInfiniteStock: z.boolean().default(false),
  weight: z.number().min(0, 'products.validation.weightMin').optional(),  // grams
  length: z.number().min(0, 'products.validation.lengthMin').optional(),  // cm
  width: z.number().min(0, 'products.validation.widthMin').optional(),    // cm
  height: z.number().min(0, 'products.validation.heightMin').optional(),  // cm
  // optionValueIds and combination are managed separately, not in the schema
});

export type VariantRowFormValues = z.infer<typeof variantRowSchema>;

// ─── Client-side activation pre-flight ───────────────────────────────────────
// Mirrors backend rules from products.md "Activation Requirements" section.
// Returns translation keys rather than sentences — this module runs outside
// React, so the call site resolves them and they follow a language switch.

export function validateActivation(params: {
  productType: ApiProductType;
  description: string;
  variants: Pick<ApiVariant, 'price' | 'status'>[];
  defaultVariantId: string | null;
}): TranslationKey[] {
  const errors: TranslationKey[] = [];

  if (!params.description.trim()) {
    errors.push('products.activation.noDescription');
  }

  const activeVariants = params.variants.filter((v) => v.status === 'active');

  if (activeVariants.length === 0) {
    // For digital products an active variant is one with an uploaded asset, so
    // "no active variant" means "no format has a file yet".
    errors.push(
      params.productType === 'digital' && params.variants.length === 0
        ? 'products.activation.noDigitalAsset'
        : 'products.activation.noActiveVariant',
    );
  }

  const zeroPriced = activeVariants.filter((v) => v.price <= 0);
  if (zeroPriced.length > 0) {
    errors.push('products.activation.zeroPrice');
  }

  if (!params.defaultVariantId) {
    errors.push('products.activation.noDefaultVariant');
  }

  return errors;
}
