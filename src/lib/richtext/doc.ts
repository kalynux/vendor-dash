import {
  EMPTY_DOC,
  INLINE_MARKS,
  RICH_DOC_VERSION,
  type Block,
  type InlineNode,
  type RichDoc,
} from './types';

/* ─── Marks ───────────────────────────────────────────────────────────────── */

export function marksOf(node: InlineNode): Record<string, boolean> {
  return { bold: !!node.bold, italic: !!node.italic, strike: !!node.strike };
}

function sameMarks(a: InlineNode, b: InlineNode): boolean {
  return INLINE_MARKS.every((mark) => !!a[mark] === !!b[mark]);
}

/** Drop `false` marks so two equivalent nodes serialise to the same JSON. */
function compactMarks<T extends InlineNode>(node: T): T {
  const out = { ...node };
  for (const mark of INLINE_MARKS) {
    if (!out[mark]) delete out[mark];
  }
  return out;
}

/* ─── Normalisation ───────────────────────────────────────────────────────── */

/**
 * Collapse a run of inline nodes into its canonical form.
 *
 * Browsers split text nodes for reasons that have nothing to do with meaning —
 * typing a character mid-word, applying then removing a mark, an IME commit —
 * so the raw serialisation of a `contenteditable` is full of adjacent spans that
 * carry identical marks. Merging them is what makes two documents that read the
 * same compare equal, which the simple editor's dirty-diff depends on.
 */
function normalizeInline(nodes: InlineNode[]): InlineNode[] {
  const out: InlineNode[] = [];

  for (const raw of nodes) {
    const node = compactMarks(raw);
    if (node.type === 'text' && node.text === '') continue;
    if (node.type === 'link' && (node.text === '' || node.href === '')) continue;

    const prev = out[out.length - 1];
    // Only text merges. Two adjacent links are two links even when they share an
    // href — merging them would silently rewrite the vendor's label.
    if (prev && prev.type === 'text' && node.type === 'text' && sameMarks(prev, node)) {
      out[out.length - 1] = { ...prev, text: prev.text + node.text };
      continue;
    }
    out.push(node);
  }

  return out;
}

/** True when a run of inline nodes carries nothing but whitespace. */
function isBlankInline(nodes: InlineNode[]): boolean {
  return nodes.every((n) => n.text.trim() === '');
}

/**
 * Canonicalise a document: merge spans, drop empty ones, drop blank blocks.
 *
 * Runs on every editor change and on every hydrate, so `normalizeDoc` is the
 * only definition of "the same document" in the codebase.
 */
export function normalizeDoc(doc: RichDoc): RichDoc {
  const blocks: Block[] = [];

  for (const block of doc.blocks) {
    if (block.type === 'paragraph') {
      const text = normalizeInline(block.text);
      // A blank paragraph is how a vendor types a spacer line. It carries no
      // content and both formatters join blocks with a blank line anyway, so
      // keeping it would double the gap.
      if (text.length === 0 || isBlankInline(text)) continue;
      blocks.push({ type: 'paragraph', text });
      continue;
    }

    const items = block.items.map(normalizeInline).filter((item) => item.length > 0 && !isBlankInline(item));
    if (items.length === 0) continue;
    blocks.push(block.ordered ? { type: 'list', ordered: true, items } : { type: 'list', items });
  }

  return { version: RICH_DOC_VERSION, blocks };
}

export function isEmptyDoc(doc: RichDoc | null | undefined): boolean {
  if (!doc) return true;
  return normalizeDoc(doc).blocks.length === 0;
}

/**
 * Structural equality, used by the simple editor's explicit dirty-diff.
 *
 * Comparing normalised JSON rather than deep-walking: `normalizeDoc` already
 * guarantees a canonical key order (marks are added in a fixed order and false
 * ones are deleted), so string equality is exact here, not approximate.
 */
export function docsEqual(a: RichDoc | null | undefined, b: RichDoc | null | undefined): boolean {
  if (!a && !b) return true;
  if (isEmptyDoc(a) && isEmptyDoc(b)) return true;
  if (!a || !b) return false;
  return JSON.stringify(normalizeDoc(a)) === JSON.stringify(normalizeDoc(b));
}

export function cloneDoc(doc: RichDoc): RichDoc {
  return JSON.parse(JSON.stringify(doc)) as RichDoc;
}

/* ─── Plain-text projection ───────────────────────────────────────────────── */

/** The list-item prefix both channels use, since neither has list markup. */
export function listPrefix(ordered: boolean | undefined, index: number): string {
  return ordered ? `${index + 1}. ` : '• ';
}

/**
 * How a link reads with no anchor syntax available.
 *
 * Shared by the plain projection and the WhatsApp formatter on purpose: those
 * are the two surfaces that cannot render a label and a target separately, and
 * having them agree means what a vendor reads on the storefront is what a
 * customer reads in WhatsApp.
 */
export function flattenLink(text: string, href: string): string {
  const label = text.trim();
  if (!label || label === href) return href;
  return `${label}: ${href}`;
}

function inlineToPlain(nodes: InlineNode[]): string {
  return nodes.map((n) => (n.type === 'link' ? flattenLink(n.text, n.href) : n.text)).join('');
}

/**
 * The projection stored in `description`.
 *
 * This is the string the customer storefront renders, MongoDB's
 * `product_storefront_text` index tokenises, and the AI vectoriser embeds — so
 * it must contain no formatting markers at all. Bullets keep their `•` because
 * that is a character in the prose, not a marker: it survives a copy-paste and
 * reads correctly everywhere, whereas a `-` would be re-parsed as a list by
 * `plainTextToDoc` even when the vendor typed a dash.
 */
export function toPlainText(doc: RichDoc): string {
  return doc.blocks
    .map((block) => {
      if (block.type === 'paragraph') return inlineToPlain(block.text);
      return block.items
        .map((item, i) => `${listPrefix(block.ordered, i)}${inlineToPlain(item)}`)
        .join('\n');
    })
    .join('\n\n')
    .trim();
}

export function docCharCount(doc: RichDoc): number {
  return toPlainText(doc).length;
}

/* ─── Truncation ──────────────────────────────────────────────────────────── */

/**
 * Trim a document down to a character budget.
 *
 * Truncating the *document* rather than the formatted string is the whole point:
 * cutting `"*Prix réduit*"` at an arbitrary offset can leave `"*Prix ré"`, an
 * unclosed marker that WhatsApp renders by swallowing everything after it. Cut
 * here and every marker pair the formatter emits is still balanced.
 */
export function truncateDoc(doc: RichDoc, max: number): { doc: RichDoc; truncated: boolean } {
  if (docCharCount(doc) <= max) return { doc, truncated: false };

  const blocks: Block[] = [];
  let used = 0;
  const SEPARATOR = 2; // the "\n\n" between blocks

  const fitInline = (nodes: InlineNode[], budget: number): InlineNode[] => {
    const out: InlineNode[] = [];
    let spent = 0;
    for (const node of nodes) {
      const rendered = node.type === 'link' ? flattenLink(node.text, node.href) : node.text;
      if (spent + rendered.length <= budget) {
        out.push(node);
        spent += rendered.length;
        continue;
      }
      // A link is atomic — half a URL is not a shorter link, it is a broken one.
      if (node.type === 'link') break;
      const room = budget - spent;
      if (room <= 0) break;
      const slice = node.text.slice(0, room);
      const atWord = slice.lastIndexOf(' ');
      const kept = atWord > room * 0.5 ? slice.slice(0, atWord) : slice;
      if (kept.trim()) out.push({ ...node, text: `${kept.trimEnd()}…` });
      break;
    }
    return out;
  };

  for (const block of doc.blocks) {
    const remaining = max - used - (blocks.length ? SEPARATOR : 0);
    if (remaining <= 0) break;

    if (block.type === 'paragraph') {
      const text = fitInline(block.text, remaining);
      if (text.length === 0) break;
      blocks.push({ type: 'paragraph', text });
      used += inlineToPlain(text).length + (blocks.length > 1 ? SEPARATOR : 0);
      continue;
    }

    const items: InlineNode[][] = [];
    let listUsed = 0;
    for (const [i, item] of block.items.entries()) {
      const prefix = listPrefix(block.ordered, i);
      const room = remaining - listUsed - prefix.length - (items.length ? 1 : 0);
      if (room <= 0) break;
      const fitted = fitInline(item, room);
      if (fitted.length === 0) break;
      items.push(fitted);
      listUsed += prefix.length + inlineToPlain(fitted).length + (items.length > 1 ? 1 : 0);
    }
    if (items.length === 0) break;
    blocks.push(block.ordered ? { type: 'list', ordered: true, items } : { type: 'list', items });
    used += listUsed + (blocks.length > 1 ? SEPARATOR : 0);
  }

  return { doc: normalizeDoc({ version: RICH_DOC_VERSION, blocks }), truncated: true };
}

export { EMPTY_DOC };
