import { z } from 'zod';
import { basicInfoSchema } from './product.schemas';
import { bargainPatch } from '@/components/products/bargain';
import { PRODUCT_IMAGE_LIMIT } from '@/components/products/media.constants';
import { descriptionCreateWire, descriptionUpdateWire, hydrateDoc } from '@/lib/richtext';
import type { TranslationKey } from '@/i18n';
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

// Messages are translation keys, not sentences — see the note in
// `product.schemas.ts`. One key per field rather than a composed
// `${label} must be…`, because that word order is English-only.

const requiredNumber = (message: TranslationKey) =>
  z.preprocess(
    emptyToUndefined,
    z.number({ message }).refine(Number.isFinite, message),
  );

const optionalNumber = (message: TranslationKey = 'common.validation.number') =>
  z.preprocess(
    emptyToUndefined,
    z.number({ message }).refine(Number.isFinite, message).optional(),
  );

const optionalNonNegative = (message: TranslationKey) =>
  optionalNumber(message).refine((n) => n === undefined || n >= 0, message);

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
    .max(PRODUCT_IMAGE_LIMIT.physical, 'products.validation.imageLimit')
    .default([]),

  // Zero is rejected by the backend outright — a zero-priced product can never
  // be activated.
  price: requiredNumber('products.validation.priceRequired').refine(
    (n) => n > 0,
    'products.validation.priceGreaterThanZero',
  ),
  compareAtPrice: optionalNonNegative('products.validation.compareAtMin'),

  // The negotiation CEILING, and the only number the vendor picks: `bargain.minPrice`
  // IS the selling price and the backend keeps the two equal, so it is never sent.
  // Empty = no window. Unrelated to `compareAtPrice` despite both sitting above the
  // price — that one is a "was" price, this one is a haggling bound.
  bargainMaxPrice: optionalNonNegative('products.validation.bargainMin'),

  stock: z.preprocess(
    emptyToUndefined,
    z
      .number({ message: 'products.validation.stockNumber' })
      .int('products.validation.stockInteger')
      .min(0, 'products.validation.stockMin')
      .default(0),
  ),
  isInfiniteStock: z.boolean().default(false),

  sku: z
    .string()
    .min(1, 'products.validation.skuEmpty')
    .max(100, 'products.validation.skuMax')
    .optional()
    .or(z.literal('')),

  // Edit-only — not accepted by POST /products/simple, dropped by toCreatePayload.
  lowStockThreshold: optionalNumber('products.validation.lowStockThreshold').refine(
    (n) => n === undefined || (Number.isInteger(n) && n >= 0),
    'products.validation.lowStockThreshold',
  ),
  allowOversell: z.boolean().default(false),

  weight: optionalNonNegative('products.validation.weightMin'),
  length: optionalNonNegative('products.validation.lengthMin'),
  width: optionalNonNegative('products.validation.widthMin'),
  height: optionalNonNegative('products.validation.heightMin'),
}).superRefine((values, ctx) => {
  // Pre-empts 422 CATALOG_VARIANT_BARGAIN_RANGE_INVALID. Equality is legal —
  // "bargainable, no headroom yet". A per-field `.refine` cannot see `price`,
  // hence the object-level rule.
  //
  // This one check also covers the backend's price auto-sync trap: after
  // `toFormValues`, the initial `bargainMaxPrice` IS the stored ceiling, so
  // RAISING the price past it trips exactly the same rule. That is why the
  // message is worded neutrally rather than "lower the ceiling".
  //
  // Blocks rather than silently widening the window: quietly raising a ceiling
  // is a money decision made on the vendor's behalf.
  if (values.bargainMaxPrice !== undefined && values.bargainMaxPrice < values.price) {
    ctx.addIssue({
      code: 'custom',
      message: 'products.validation.bargainMaxBelowPrice',
      path: ['bargainMaxPrice'],
    });
  }
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
    // Falls back to parsing the plain description when the backend has no rich
    // document for this product — every product predating the editor, plus
    // every save made while the wire gate was off.
    descriptionRich: hydrateDoc(product.descriptionRich, product.description),
    tags: product.tags ?? [],
    seoTitle: product.seo?.title ?? '',
    seoDescription: product.seo?.description ?? '',
    fileIds: product.files.map((f) => f.id),
    price: variant?.price ?? 0,
    compareAtPrice: variant?.compareAtPrice,
    bargainMaxPrice: variant?.bargain?.maxPrice,
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
    // `toPlainText` already trims, so this is the same string the old
    // `values.description.trim()` produced — derived from the document rather
    // than from the (now read-only) mirror the form carries.
    ...descriptionCreateWire(values.descriptionRich),
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
  // `allowNull: false` — `bargain: null` on a create endpoint is a 400.
  Object.assign(payload, bargainPatch(values.bargainMaxPrice, undefined, { allowNull: false }));
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

  // Diffed on the document, not on the plain text: two documents can share a
  // projection while differing in their marks, and comparing the strings would
  // silently drop a bold-only edit.
  Object.assign(payload, descriptionUpdateWire(current.descriptionRich, initial.descriptionRich));

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
  // Unlike compareAtPrice, a bargain window IS clearable — `bargain: null` is the
  // documented way to remove it — so a cleared field is sent rather than ignored.
  Object.assign(
    payload,
    bargainPatch(current.bargainMaxPrice, initial.bargainMaxPrice, { allowNull: true }),
  );
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
