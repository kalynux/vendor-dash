import { z } from 'zod';
import { basicInfoSchema } from './product.schemas';
import { PRODUCT_IMAGE_LIMIT } from '@/components/products/media.constants';
import type {
  ApiProductDetail,
  ApiVariant,
  SimpleProductPayload,
  SimpleProductUpdatePayload,
} from '@/types/product.types';

// ─── Number coercion ──────────────────────────────────────────────────────────
// `<Input type="number">` + react-hook-form `register` yields strings ('' when
// empty). `valueAsNumber` turns an empty field into NaN with an unhelpful
// message, so preprocess instead and keep the knowledge in one place.

const emptyToUndefined = (v: unknown) =>
  v === '' || v === null || v === undefined
    ? undefined
    : typeof v === 'string'
      ? Number(v)
      : v;

const requiredNumber = (message: string) =>
  z.preprocess(
    emptyToUndefined,
    z.number({ message }).refine(Number.isFinite, message),
  );

const optionalNumber = (message = 'Must be a number') =>
  z.preprocess(
    emptyToUndefined,
    z.number({ message }).refine(Number.isFinite, message).optional(),
  );

const optionalNonNegative = (label: string) =>
  optionalNumber(`${label} must be a number`).refine(
    (n) => n === undefined || n >= 0,
    `${label} must be 0 or more`,
  );

// ─── Schema ───────────────────────────────────────────────────────────────────
// Extends basicInfoSchema rather than copying it: title 3–200, category,
// description, unique tags, seoTitle ≤60 and seoDescription ≤160 are already
// exactly the simple-mode contract, and one source of truth cannot drift.
//
// One schema serves both create and edit — the form always renders every field
// and the mappers below decide what is actually sent.

export const simpleProductSchema = basicInfoSchema.extend({
  fileIds: z
    .array(z.string())
    .max(
      PRODUCT_IMAGE_LIMIT.physical,
      `A product can have at most ${PRODUCT_IMAGE_LIMIT.physical} images`,
    )
    .default([]),

  // Zero is rejected by the backend outright — a zero-priced product can never
  // be activated.
  price: requiredNumber('Price is required').refine(
    (n) => n > 0,
    'Price must be greater than 0',
  ),
  compareAtPrice: optionalNonNegative('Compare-at price'),

  stock: z.preprocess(
    emptyToUndefined,
    z
      .number({ message: 'Stock must be a number' })
      .int('Stock must be a whole number')
      .min(0, 'Stock cannot be negative')
      .default(0),
  ),
  isInfiniteStock: z.boolean().default(false),

  sku: z
    .string()
    .min(1, 'SKU cannot be empty')
    .max(100, 'SKU must be 100 characters or less')
    .optional()
    .or(z.literal('')),

  // Edit-only — not accepted by POST /products/simple, dropped by toCreatePayload.
  lowStockThreshold: optionalNumber('Low-stock threshold must be a number').refine(
    (n) => n === undefined || (Number.isInteger(n) && n >= 0),
    'Low-stock threshold must be a whole number, 0 or more',
  ),
  allowOversell: z.boolean().default(false),

  weight: optionalNonNegative('Weight'),
  length: optionalNonNegative('Length'),
  width: optionalNonNegative('Width'),
  height: optionalNonNegative('Height'),
});

export type SimpleProductFormValues = z.infer<typeof simpleProductSchema>;
export type SimpleProductFormInput = z.input<typeof simpleProductSchema>;

// ─── Mappers ──────────────────────────────────────────────────────────────────
// The single place where '' becomes "omit" and where the create/edit contracts
// diverge. Pure functions, so they stay testable and the pages stay thin.

/** Prefill the edit form from the loaded product + its single variant. */
export function toFormValues(
  product: ApiProductDetail,
  variant: ApiVariant | null,
): SimpleProductFormValues {
  return {
    title: product.title,
    category: product.category,
    description: product.description,
    tags: product.tags ?? [],
    seoTitle: product.seo?.title ?? '',
    seoDescription: product.seo?.description ?? '',
    fileIds: product.files.map((f) => f.id),
    price: variant?.price ?? 0,
    compareAtPrice: variant?.compareAtPrice,
    stock: variant?.stock ?? 0,
    isInfiniteStock: variant?.isInfiniteStock ?? false,
    sku: variant?.sku ?? '',
    lowStockThreshold: variant?.lowStockThreshold ?? undefined,
    allowOversell: variant?.allowOversell ?? false,
    weight: variant?.weight,
    length: variant?.length,
    width: variant?.width,
    height: variant?.height,
  };
}

function trimmedOrUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function toCreatePayload(
  values: SimpleProductFormValues,
  publish: boolean,
): SimpleProductPayload {
  const payload: SimpleProductPayload = {
    title: values.title.trim(),
    description: values.description.trim(),
    category: values.category.trim(),
    price: values.price,
    isInfiniteStock: values.isInfiniteStock,
    fileIds: values.fileIds,
    publish,
    // `pickupLocation` is deliberately absent: omitting it lets the backend
    // derive it, and auto-derivation never fails the call — it just declines
    // and reports why in meta.activation.pickupReason.
  };

  // Sending a stock number the backend ignores is just noise.
  if (!values.isInfiniteStock) payload.stock = values.stock;
  if (values.compareAtPrice !== undefined) payload.compareAtPrice = values.compareAtPrice;
  if (values.tags.length > 0) payload.tags = values.tags;

  const sku = trimmedOrUndefined(values.sku);
  if (sku) payload.sku = sku;

  const seoTitle = trimmedOrUndefined(values.seoTitle);
  if (seoTitle) payload.seoTitle = seoTitle;
  const seoDescription = trimmedOrUndefined(values.seoDescription);
  if (seoDescription) payload.seoDescription = seoDescription;

  if (values.weight !== undefined) payload.weight = values.weight;
  if (values.length !== undefined) payload.length = values.length;
  if (values.width !== undefined) payload.width = values.width;
  if (values.height !== undefined) payload.height = values.height;

  // `lowStockThreshold` and `allowOversell` are not part of the create contract —
  // the edit page can set them a second later.
  return payload;
}

function sameStringArray(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * An explicit diff rather than RHF `dirtyFields`: array dirty-tracking is
 * per-index and unreliable for `fileIds`, and sending only what changed both
 * satisfies the "at least one field required" rule and avoids gratuitous writes.
 *
 * `publish` is passed through untouched — omitting it is meaningful (see the
 * tri-state in api-doc/vendor/simple-products.md).
 */
export function toUpdatePayload(
  current: SimpleProductFormValues,
  initial: SimpleProductFormValues,
  publish?: boolean,
): SimpleProductUpdatePayload {
  const payload: SimpleProductUpdatePayload = {};

  const title = current.title.trim();
  if (title !== initial.title.trim()) payload.title = title;

  const description = current.description.trim();
  if (description !== initial.description.trim()) payload.description = description;

  const category = current.category.trim();
  if (category !== initial.category.trim()) payload.category = category;

  if (!sameStringArray(current.tags, initial.tags)) payload.tags = current.tags;

  // Order matters — index 0 is the thumbnail — so compare element-wise. Skipping
  // this when unchanged also protects against a stale empty gallery wiping the
  // product's images, since fileIds is a full replacement.
  if (!sameStringArray(current.fileIds, initial.fileIds)) payload.fileIds = current.fileIds;

  const seoTitle = current.seoTitle?.trim() ?? '';
  if (seoTitle !== (initial.seoTitle?.trim() ?? '')) payload.seoTitle = seoTitle;
  const seoDescription = current.seoDescription?.trim() ?? '';
  if (seoDescription !== (initial.seoDescription?.trim() ?? '')) {
    payload.seoDescription = seoDescription;
  }

  if (current.price !== initial.price) payload.price = current.price;
  // Clearing a compare-at price is not expressible in the documented contract —
  // `compareAtPrice` is `number`, with no null to unset it — so a cleared field
  // is left alone rather than sent as something the backend would reject.
  if (
    current.compareAtPrice !== initial.compareAtPrice &&
    current.compareAtPrice !== undefined
  ) {
    payload.compareAtPrice = current.compareAtPrice;
  }
  if (current.stock !== initial.stock) payload.stock = current.stock;
  if (current.isInfiniteStock !== initial.isInfiniteStock) {
    payload.isInfiniteStock = current.isInfiniteStock;
  }
  if (current.lowStockThreshold !== initial.lowStockThreshold) {
    payload.lowStockThreshold = current.lowStockThreshold ?? null;
  }
  if (current.allowOversell !== initial.allowOversell) {
    payload.allowOversell = current.allowOversell;
  }

  // A cleared SKU field must never be read as "regenerate" — there is no
  // regenerate endpoint, and orders and the storefront reference the SKU.
  const sku = trimmedOrUndefined(current.sku);
  if (sku && sku !== initial.sku?.trim()) payload.sku = sku;

  if (current.weight !== initial.weight) payload.weight = current.weight;
  if (current.length !== initial.length) payload.length = current.length;
  if (current.width !== initial.width) payload.width = current.width;
  if (current.height !== initial.height) payload.height = current.height;

  if (publish !== undefined) payload.publish = publish;

  return payload;
}

/** True when a diff would send nothing but a (possibly absent) publish intent. */
export function isEmptyUpdate(payload: SimpleProductUpdatePayload): boolean {
  return Object.keys(payload).filter((k) => k !== 'publish').length === 0;
}
