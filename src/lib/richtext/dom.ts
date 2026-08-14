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

/** Collect the inline content of one block-level container. */
function collectInline(root: Node): InlineNode[] {
  const out: InlineNode[] = [];

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

const BLOCK_TAGS = new Set(['p', 'div', 'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

/**
 * Serialise the editor surface into a canonical document.
 *
 * Loose inline content at the root — which is what a browser leaves behind after
 * "select all, delete, type" — is gathered into an implicit paragraph rather
 * than discarded. Headings and blockquotes that survive a paste are flattened to
 * paragraphs, because the document model has no such blocks and no chat client
 * would render them anyway.
 */
export function htmlToDoc(root: HTMLElement): RichDoc {
  const blocks: Block[] = [];
  let loose: ChildNode[] = [];

  const flushLoose = () => {
    if (loose.length === 0) return;
    const holder = root.ownerDocument.createElement('div');
    loose.forEach((n) => holder.appendChild(n.cloneNode(true)));
    const text = collectInline(holder);
    if (text.length) blocks.push({ type: 'paragraph', text });
    loose = [];
  };

  root.childNodes.forEach((child) => {
    const isBlock =
      child.nodeType === Node.ELEMENT_NODE &&
      BLOCK_TAGS.has((child as HTMLElement).tagName.toLowerCase());

    if (!isBlock) {
      loose.push(child);
      return;
    }

    flushLoose();
    const el = child as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (tag === 'ul' || tag === 'ol') {
      const items: InlineNode[][] = [];
      el.querySelectorAll(':scope > li').forEach((li) => {
        const item = collectInline(li);
        if (item.length) items.push(item);
      });
      if (items.length) {
        blocks.push(tag === 'ol' ? { type: 'list', ordered: true, items } : { type: 'list', items });
      }
      return;
    }

    const text = collectInline(el);
    if (text.length) blocks.push({ type: 'paragraph', text });
  });

  flushLoose();
  return normalizeDoc({ version: RICH_DOC_VERSION, blocks });
}
