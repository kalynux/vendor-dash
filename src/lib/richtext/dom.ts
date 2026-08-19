import { normalizeDoc } from './doc';
import { isAllowedHref } from './schema';
import { RICH_DOC_VERSION, type Block, type InlineNode, type RichDoc } from './types';

/**
 * The bridge between the `contenteditable` surface and the document model.
 *
 * This is the *only* module that reads or writes editor DOM, and that
 * containment is what makes `document.execCommand` a reasonable engine choice.
 * `execCommand` is inconsistent across browsers by design-decay — Chrome emits
 * `<b>` where Firefox emits `<span style="font-weight:bold">` unless
 * `styleWithCSS` is off, Safari wraps lines in `<div>` where others use `<p>` —
 * but none of that reaches the rest of the app, because `htmlToDoc` accepts the
 * union of all those shapes and always emits one canonical document.
 *
 * What we get in exchange is everything a hand-rolled editor gets wrong: native
 * caret and selection behaviour, a working undo stack, IME composition, and
 * Android soft-keyboard autocorrect. Vendors here manage products from phones,
 * so that is not a trade worth making twice.
 */

/* ─── Document → DOM ──────────────────────────────────────────────────────── */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inlineToHtml(node: InlineNode): string {
  // A hard line break inside a span is a `<br>` in the surface, not a newline —
  // a raw newline in HTML is collapsed to a space and the vendor's line break
  // would vanish on the next serialise.
  const escaped = escapeHtml(node.text).replace(/\n/g, '<br>');
  let html =
    node.type === 'link'
      ? `<a href="${escapeHtml(node.href)}" rel="noopener noreferrer">${escaped}</a>`
      : escaped;

  if (node.italic) html = `<em>${html}</em>`;
  if (node.bold) html = `<strong>${html}</strong>`;
  if (node.strike) html = `<s>${html}</s>`;
  return html;
}

function blockToHtml(block: Block): string {
  if (block.type === 'paragraph') {
    const inner = block.text.map(inlineToHtml).join('');
    return `<p>${inner || '<br>'}</p>`;
  }
  const tag = block.ordered ? 'ol' : 'ul';
  const items = block.items.map((item) => `<li>${item.map(inlineToHtml).join('') || '<br>'}</li>`);
  return `<${tag}>${items.join('')}</${tag}>`;
}

/**
 * Render a document into the editor surface.
 *
 * Called on mount and when the document is replaced from outside (a form reset,
 * a product finishing loading) — never on every keystroke, which would destroy
 * the caret on each character.
 */
export function docToHtml(doc: RichDoc): string {
  if (doc.blocks.length === 0) return '<p><br></p>';
  return doc.blocks.map(blockToHtml).join('');
}

/* ─── DOM → Document ──────────────────────────────────────────────────────── */

type Marks = { bold: boolean; italic: boolean; strike: boolean };

const NO_MARKS: Marks = { bold: false, italic: false, strike: false };

/**
 * Which marks an element contributes.
 *
 * The tag list is the union of what every browser's `execCommand` produces plus
 * what a paste could carry in before the paste handler strips it. Inline styles
 * are read as well: `styleWithCSS` is turned off on the surface, but it is a
 * document-wide flag that another editor instance or a browser default can flip,
 * and a description silently losing its bold on save would be very hard to
 * report.
 */
function marksFromElement(el: HTMLElement): Partial<Marks> {
  const tag = el.tagName.toLowerCase();
  const out: Partial<Marks> = {};

  if (tag === 'b' || tag === 'strong') out.bold = true;
  if (tag === 'i' || tag === 'em') out.italic = true;
  if (tag === 's' || tag === 'strike' || tag === 'del') out.strike = true;

  const weight = el.style.fontWeight;
  if (weight === 'bold' || weight === 'bolder' || Number(weight) >= 600) out.bold = true;
  if (el.style.fontStyle === 'italic') out.italic = true;
  if (el.style.textDecorationLine?.includes('line-through') || el.style.textDecoration?.includes('line-through')) {
    out.strike = true;
  }

  return out;
}

const BLOCK_TAGS = new Set(['p', 'div', 'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

/** The same set as a selector, for asking "is there block structure below here?". */
const BLOCK_SELECTOR = Array.from(BLOCK_TAGS).join(',');

function tagOf(node: Node): string {
  return node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement).tagName.toLowerCase() : '';
}

function isListTag(tag: string): boolean {
  return tag === 'ul' || tag === 'ol';
}

/**
 * Whether an element wraps block-level structure rather than being one block.
 *
 * This is the question that decides between descending into an element and
 * flattening it, and getting it wrong is not cosmetic — see `walkBlocks`.
 */
function containsBlock(el: HTMLElement): boolean {
  return el.querySelector(BLOCK_SELECTOR) !== null;
}

/**
 * Collect the inline content of one block-level container.
 *
 * Any block-level element that reaches this function is one the caller decided
 * to flatten — a heading, a `<p>` nested inside a list item, a stray `<div>`. It
 * opens a line break rather than being concatenated, because two paragraphs
 * flattened into `firstsecond` is a sentence the vendor never wrote.
 */
function collectInline(root: Node): InlineNode[] {
  const out: InlineNode[] = [];

  const endsWithNewline = (): boolean => {
    const prev = out[out.length - 1];
    return !prev || prev.text.endsWith('\n');
  };

  const walk = (node: Node, marks: Marks, href: string | null): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? '';
      if (!text) return;
      out.push(
        href
          ? { type: 'link', text, href, ...marks }
          : { type: 'text', text, ...marks },
      );
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (tag === 'br') {
      out.push({ type: 'text', text: '\n', ...marks });
      return;
    }

    if (BLOCK_TAGS.has(tag) && !endsWithNewline()) {
      out.push({ type: 'text', text: '\n', ...marks });
    }

    let nextHref = href;
    if (tag === 'a') {
      const candidate = el.getAttribute('href') ?? '';
      // An anchor whose href we would refuse to store becomes plain text rather
      // than being dropped: the vendor typed those words and they belong in the
      // description even when the target does not.
      nextHref = isAllowedHref(candidate) ? candidate : href;
    }

    const nextMarks = { ...marks, ...marksFromElement(el) };
    el.childNodes.forEach((child) => walk(child, nextMarks, nextHref));
  };

  root.childNodes.forEach((child) => walk(child, { ...NO_MARKS }, null));
  return out;
}

/**
 * Read a `<ul>`/`<ol>` into list items, appending to `items`.
 *
 * Nested lists are *promoted* to entries of the same list rather than being
 * folded into their parent item's text. The document model has no nesting —
 * neither messenger renders an indent — so the real choice is between one bullet
 * per line and several lines run together into one, and only the first is
 * readable.
 */
function collectListItems(list: HTMLElement, items: InlineNode[][]): void {
  list.childNodes.forEach((child) => {
    if (child.nodeType !== Node.ELEMENT_NODE) return; // whitespace between items
    const el = child as HTMLElement;
    const tag = tagOf(el);

    // A list that lost its `<li>` — what outdenting a nested list leaves behind.
    if (isListTag(tag)) {
      collectListItems(el, items);
      return;
    }
    if (tag !== 'li') return;

    // Split the item into its own inline content and any list nested inside it,
    // so the nested entries become entries here instead of being swallowed.
    const holder = el.ownerDocument.createElement('div');
    const nested: HTMLElement[] = [];
    el.childNodes.forEach((node) => {
      if (isListTag(tagOf(node))) {
        nested.push(node as HTMLElement);
        return;
      }
      holder.appendChild(node.cloneNode(true));
    });

    const own = collectInline(holder);
    if (own.length) items.push(own);
    nested.forEach((n) => collectListItems(n, items));
  });
}

/**
 * Walk one container, appending the blocks it holds.
 *
 * Recursive, and that is the whole point. Chrome's `insertUnorderedList` does
 * not replace the paragraph it was invoked on — it puts the list *inside* it and
 * leaves `<p><ul><li>…</li><li>…</li></ul></p>` behind. A walk that only
 * recognised lists among the root's own children read that `<p>` as a single
 * paragraph and flattened it, so every bullet a vendor typed arrived as one
 * run-together line in the message. A block that itself contains blocks is
 * therefore a *container*, at any depth, and only a block whose content is
 * purely inline becomes a paragraph.
 *
 * Loose inline content — which is what a browser leaves behind after "select
 * all, delete, type" — is gathered into an implicit paragraph rather than
 * discarded. Headings and blockquotes that survive a paste are flattened to
 * paragraphs, because the document model has no such blocks and no chat client
 * would render them anyway.
 */
function walkBlocks(container: HTMLElement, blocks: Block[]): void {
  let loose: ChildNode[] = [];

  const flushLoose = () => {
    if (loose.length === 0) return;
    const holder = container.ownerDocument.createElement('div');
    loose.forEach((n) => holder.appendChild(n.cloneNode(true)));
    const text = collectInline(holder);
    if (text.length) blocks.push({ type: 'paragraph', text });
    loose = [];
  };

  container.childNodes.forEach((child) => {
    if (child.nodeType !== Node.ELEMENT_NODE) {
      loose.push(child);
      return;
    }

    const el = child as HTMLElement;
    const tag = tagOf(el);

    // An inline element belongs to the paragraph being gathered — unless it is
    // hiding block structure, which a paste or a browser quirk can produce.
    if (!BLOCK_TAGS.has(tag)) {
      if (!containsBlock(el)) {
        loose.push(child);
        return;
      }
      flushLoose();
      walkBlocks(el, blocks);
      return;
    }

    flushLoose();

    if (isListTag(tag)) {
      const items: InlineNode[][] = [];
      collectListItems(el, items);
      if (items.length) {
        blocks.push(tag === 'ol' ? { type: 'list', ordered: true, items } : { type: 'list', items });
      }
      return;
    }

    if (containsBlock(el)) {
      walkBlocks(el, blocks);
      return;
    }

    const text = collectInline(el);
    if (text.length) blocks.push({ type: 'paragraph', text });
  });

  flushLoose();
}

/** Serialise the editor surface into a canonical document. */
export function htmlToDoc(root: HTMLElement): RichDoc {
  const blocks: Block[] = [];
  walkBlocks(root, blocks);
  return normalizeDoc({ version: RICH_DOC_VERSION, blocks });
}
