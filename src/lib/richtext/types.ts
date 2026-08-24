/**
 * The product-description content model.
 *
 * This file is the contract. The editor produces it, the WhatsApp and Telegram
 * formatters consume it, and `docs_requirement.md` asks the backend to persist
 * it verbatim as `descriptionRich`.
 *
 * Three decisions are worth stating up front, because they are the ones that
 * cost something to change later.
 *
 * **1. A description is an array of typed blocks, not a markup string.** Storing
 * WhatsApp's own `*bold*` syntax would make WhatsApp the source of truth, and
 * every future channel would then be a lossy translation of one messenger's
 * quirks. Storing HTML would mean sanitising on the way in and rendering through
 * `dangerouslySetInnerHTML` on the way out. Blocks are validated at the boundary
 * by `schema.ts` and rendered by code that cannot emit a node the vendor did not
 * ask for. This mirrors the same decision already made for article bodies in
 * `landing/src/lib/blog/blog.types.ts`.
 *
 * **2. The vocabulary is the intersection of what WhatsApp and Telegram both
 * support** — bold, italic, strikethrough, links, bullet lists, numbered lists,
 * paragraphs. Not a subset of HTML, not a superset "we might need one day".
 * Headings, colours, tables and font sizes are absent because no messenger
 * renders them, so offering them would only let a vendor author something that
 * silently degrades in the one place the description actually gets read.
 *
 * **3. Inline spans are flat and carry their own marks.** A span is bold *and*
 * italic rather than nesting inside `<strong><em>`. Nested inline trees are what
 * make rich-text serialisers hard, and both target formatters emit a flat marker
 * pair per span anyway, so the tree would be flattened again immediately.
 */

/**
 * The inline vocabulary inside a paragraph or a list item.
 *
 * `link` carries its own `text` because the two channels disagree about it:
 * Telegram renders `<a href>` with the label intact, WhatsApp has no anchor
 * syntax at all and can only show a bare URL. Keeping the label as data rather
 * than as markup is what lets each formatter make its own choice — see
 * `format/whatsapp.ts` and `format/telegram.ts`.
 */
export type InlineNode =
  | {
      type: 'text';
      text: string;
      bold?: boolean;
      italic?: boolean;
      strike?: boolean;
    }
  | {
      type: 'link';
      text: string;
      /** Absolute, scheme-checked at parse time by `schema.ts` — never at render time. */
      href: string;
      bold?: boolean;
      italic?: boolean;
      strike?: boolean;
    };

export type InlineMark = 'bold' | 'italic' | 'strike';

/** The three marks, in the order formatters nest them (outermost first). */
export const INLINE_MARKS: readonly InlineMark[] = ['strike', 'bold', 'italic'] as const;

/**
 * Blocks.
 *
 * A `paragraph` may contain hard line breaks inside its text (a `\n` inside a
 * text span), which is what Shift+Enter produces. That is deliberate: in chat, a
 * two-line address is one thought, and forcing it into two paragraphs would put
 * a blank line through the middle of it.
 *
 * Lists are never nested. Neither WhatsApp nor Telegram has list markup — both
 * formatters emit a literal `• ` or `1. ` prefix — so a nested list would render
 * as an indent the vendor never sees confirmed anywhere.
 */
export type Block =
  | { type: 'paragraph'; text: InlineNode[] }
  | { type: 'list'; ordered?: boolean; items: InlineNode[][] };

export type BlockType = Block['type'];

/**
 * `version` exists so a future vocabulary change is a migration rather than a
 * guess. A reader that does not recognise the version must fall back to
 * `description` (the plain-text projection) instead of rendering blocks it does
 * not understand.
 */
export const RICH_DOC_VERSION = 1;

export type RichDoc = {
  version: typeof RICH_DOC_VERSION;
  blocks: Block[];
};

export const EMPTY_DOC: RichDoc = { version: RICH_DOC_VERSION, blocks: [] };

/** The only URL schemes a description may link to. */
export const ALLOWED_LINK_SCHEMES = ['https:', 'http:', 'mailto:', 'tel:'] as const;

/**
 * The most blocks a description may contain.
 *
 * Mirrors `MAX_RICH_DOC_BLOCKS` in the backend's `core/richtext/types.ts`. Unlike
 * every other budget in this folder this one is a **hard server-side rejection**,
 * not editorial guidance: a document over the cap fails validation and takes the
 * whole product save with it. Worth catching before the vendor presses save.
 */
export const MAX_RICH_DOC_BLOCKS = 200;
