import { docsEqual, isEmptyDoc, normalizeDoc, toPlainText } from './doc';
import type { RichDoc } from './types';

/**
 * Whether `descriptionRich` may be attached to product write payloads.
 *
 * **Flip this to `true` the day the backend ships the field** (see
 * `docs_requirement.md`) — and nothing else needs to change.
 *
 * It exists because the two families of product endpoints disagree about unknown
 * fields, and one of them disagrees expensively:
 *
 * - `POST /vendor/products` and `PATCH /vendor/products/:id` validate against
 *   schemas that are not top-level `.strict()`, so an unknown `descriptionRich`
 *   is silently stripped. Harmless.
 * - `POST /vendor/products/simple` and `PATCH /vendor/products/:id/simple`
 *   validate against `.strict()` schemas
 *   (`simple-product.validator.ts:77` and `:117`). An unknown key there is not
 *   ignored — it is a `400 VALIDATION_ERROR` that rejects the **entire** save.
 *
 * Sending it optimistically would therefore break the quick-add editor outright
 * while appearing to work in the advanced wizard, which is the worst possible
 * split. One constant, checked by every payload builder, keeps the two in step.
 *
 * While this is `false` the editor is fully functional and the plain-text
 * projection still persists in `description` — reopening a product recovers its
 * paragraphs, lists, emoji and URLs, but not its bold/italic runs.
 */
export const RICH_DESCRIPTION_WIRE_ENABLED = false;

/**
 * The pair of values a product write sends for a description.
 *
 * `description` is always present and always plain: it is what the storefront
 * renders, what MongoDB's `product_storefront_text` index tokenises, and what
 * the AI vectoriser embeds. `descriptionRich` is the source of truth and rides
 * alongside it.
 */
export type DescriptionWire = {
  description: string;
  descriptionRich?: RichDoc | null;
};

/**
 * Build the description half of a create payload.
 *
 * The plain projection is derived here rather than read from the form so the two
 * fields can never disagree — a `description` that is not `toPlainText(doc)` is
 * a bug the storefront would show to customers.
 */
export function descriptionCreateWire(doc: RichDoc): DescriptionWire {
  const normalized = normalizeDoc(doc);
  const wire: DescriptionWire = { description: toPlainText(normalized) };
  if (RICH_DESCRIPTION_WIRE_ENABLED && !isEmptyDoc(normalized)) {
    wire.descriptionRich = normalized;
  }
  return wire;
}

/**
 * Build the description half of an update payload, or `{}` when nothing changed.
 *
 * Mirrors the explicit-diff style the simple editor already uses: sending a
 * field that did not change is a gratuitous write, and on the simple endpoint an
 * all-empty payload is rejected outright.
 */
export function descriptionUpdateWire(current: RichDoc, initial: RichDoc): Partial<DescriptionWire> {
  if (docsEqual(current, initial)) return {};

  const normalized = normalizeDoc(current);
  const wire: Partial<DescriptionWire> = { description: toPlainText(normalized) };
  if (RICH_DESCRIPTION_WIRE_ENABLED) {
    // An emptied document sends `null`, not an omitted key: omitting it would
    // leave the previous rich document in place while `description` was replaced,
    // and the next read would resurrect formatting the vendor deleted.
    wire.descriptionRich = isEmptyDoc(normalized) ? null : normalized;
  }
  return wire;
}
