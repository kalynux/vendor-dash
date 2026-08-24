import { z } from 'zod';
import {
  ALLOWED_LINK_SCHEMES,
  MAX_RICH_DOC_BLOCKS,
  RICH_DOC_VERSION,
  type RichDoc,
} from './types';

/**
 * Runtime validation for a `RichDoc`.
 *
 * This runs on the way *in* — hydrating a document the API returned — not on the
 * way out. The editor cannot produce an invalid document, but a document that
 * has been round-tripped through a database, an older client, or a hand-written
 * API call can be anything at all, and the renderers downstream assume a shape.
 *
 * It is also the executable half of the backend contract: the Zod snippet in
 * `docs_requirement.md` is this file, so the two sides validate identically.
 */

/**
 * Scheme allowlist, checked here rather than at render time.
 *
 * A `javascript:` href that is only caught by the renderer is one missed call
 * site away from being live; one rejected at the boundary cannot reach a
 * renderer at all. Relative hrefs are rejected too — a product description is
 * read inside WhatsApp, where there is no origin for a relative URL to resolve
 * against.
 */
export function isAllowedHref(href: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(href);
  } catch {
    return false;
  }
  return (ALLOWED_LINK_SCHEMES as readonly string[]).includes(parsed.protocol);
}

const marks = {
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  strike: z.boolean().optional(),
};

const textNodeSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
  ...marks,
});

const linkNodeSchema = z.object({
  type: z.literal('link'),
  text: z.string(),
  href: z.string().refine(isAllowedHref, {
    message: 'products.editor.errors.linkScheme',
  }),
  ...marks,
});

export const inlineNodeSchema = z.discriminatedUnion('type', [textNodeSchema, linkNodeSchema]);

const paragraphSchema = z.object({
  type: z.literal('paragraph'),
  text: z.array(inlineNodeSchema),
});

const listSchema = z.object({
  type: z.literal('list'),
  ordered: z.boolean().optional(),
  items: z.array(z.array(inlineNodeSchema)),
});

export const blockSchema = z.discriminatedUnion('type', [paragraphSchema, listSchema]);

export const richDocSchema = z.object({
  version: z.literal(RICH_DOC_VERSION),
  // Capped to match the backend, which rejects a longer document outright.
  // Nothing stored can exceed this — the backend enforces it on every write — so
  // the cap never costs a valid document on the way in.
  blocks: z.array(blockSchema).max(MAX_RICH_DOC_BLOCKS),
});

/**
 * Parse an untrusted value into a `RichDoc`, or return `null`.
 *
 * Null rather than throwing, because every caller's fallback is the same and it
 * is a good one: rebuild the document from the plain-text `description` the
 * product also carries. A description that fails to validate is a formatting
 * loss, never a broken form.
 */
export function parseRichDoc(value: unknown): RichDoc | null {
  if (value == null) return null;
  const result = richDocSchema.safeParse(value);
  return result.success ? (result.data as RichDoc) : null;
}
