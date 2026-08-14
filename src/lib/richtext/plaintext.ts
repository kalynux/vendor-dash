import { normalizeDoc } from './doc';
import { isAllowedHref } from './schema';
import { RICH_DOC_VERSION, type Block, type InlineNode, type RichDoc } from './types';

/**
 * Rebuild a document from a plain-text description.
 *
 * Every product written before this editor existed has a plain `description` and
 * no `descriptionRich`, so this runs on the majority of edits for a long time.
 * It has one job and one prohibition.
 *
 * The job: recover **structure** — paragraphs, bullet lists, numbered lists, bare
 * URLs — because that is what vendors already fake with hyphens and blank lines,
 * and losing it would make opening an old product feel like the editor ate the
 * formatting.
 *
 * The prohibition: **never infer inline marks.** A description reading
 * `Toile 5*7 cm, coton *100%*` has one decorative pair and one dimension, and no
 * heuristic can tell them apart. Guessing turns a correct description into a
 * mangled one on open, with no undo, which is strictly worse than opening it
 * unformatted. Bold is one click away; a silently corrupted product is not.
 */

const BULLET_LINE = /^\s*[-*•·]\s+(.*)$/;
const ORDERED_LINE = /^\s*(\d+)[.)]\s+(.*)$/;

/** Trailing punctuation that is almost always sentence punctuation, not URL. */
const URL_TRAILING = /[.,;:!?)\]}"'»…]+$/;
const URL_CANDIDATE = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;

/**
 * Wrap bare URLs in link nodes, leaving everything else as one text span.
 *
 * Bare URLs are linkified — unlike marks — because there is no ambiguity: a
 * token starting `https://` is a URL in every product description ever written,
 * and both channels auto-link it on send anyway. Recognising it here just means
 * the vendor can edit its label afterwards.
 */
export function linkifyInline(text: string): InlineNode[] {
  const out: InlineNode[] = [];
  let cursor = 0;

  for (const match of text.matchAll(URL_CANDIDATE)) {
    const start = match.index ?? 0;
    const raw = match[0];
    const trimmed = raw.replace(URL_TRAILING, '');
    const href = trimmed.toLowerCase().startsWith('www.') ? `https://${trimmed}` : trimmed;

    if (!isAllowedHref(href)) continue;

    if (start > cursor) out.push({ type: 'text', text: text.slice(cursor, start) });
    out.push({ type: 'link', text: trimmed, href });
    cursor = start + trimmed.length;
  }

  if (cursor < text.length) out.push({ type: 'text', text: text.slice(cursor) });
  return out.length ? out : [{ type: 'text', text }];
}

type Line = { kind: 'bullet' | 'ordered' | 'text'; content: string };

function classify(line: string): Line {
  const bullet = BULLET_LINE.exec(line);
  if (bullet) return { kind: 'bullet', content: bullet[1] };
  const ordered = ORDERED_LINE.exec(line);
  if (ordered) return { kind: 'ordered', content: ordered[2] };
  return { kind: 'text', content: line };
}

/**
 * A run of consecutive non-blank lines becomes one or more blocks.
 *
 * Plain lines inside a run are joined with `\n` into a single paragraph rather
 * than split into several: in a chat message a two-line address is one thought,
 * and splitting it would put a blank line through the middle of it on send.
 */
function chunkToBlocks(lines: Line[]): Block[] {
  const blocks: Block[] = [];
  let run: Line[] = [];

  const flush = () => {
    if (run.length === 0) return;
    const kind = run[0].kind;
    if (kind === 'text') {
      blocks.push({
        type: 'paragraph',
        text: linkifyInline(run.map((l) => l.content).join('\n')),
      });
    } else {
      const items = run.map((l) => linkifyInline(l.content));
      blocks.push(kind === 'ordered' ? { type: 'list', ordered: true, items } : { type: 'list', items });
    }
    run = [];
  };

  for (const line of lines) {
    if (run.length && run[0].kind !== line.kind) flush();
    run.push(line);
  }
  flush();

  return blocks;
}

export function plainTextToDoc(text: string | null | undefined): RichDoc {
  if (!text || !text.trim()) return { version: RICH_DOC_VERSION, blocks: [] };

  const blocks: Block[] = [];
  let chunk: Line[] = [];

  for (const rawLine of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (rawLine.trim() === '') {
      if (chunk.length) blocks.push(...chunkToBlocks(chunk));
      chunk = [];
      continue;
    }
    chunk.push(classify(rawLine));
  }
  if (chunk.length) blocks.push(...chunkToBlocks(chunk));

  return normalizeDoc({ version: RICH_DOC_VERSION, blocks });
}

/**
 * Hydrate an editor document from whatever the API returned.
 *
 * The two fields are not equal partners: `descriptionRich` is the source of
 * truth and `description` is its projection, so a present rich document always
 * wins. It is only when there is none — a legacy product, or a save made before
 * the backend persisted the field — that the projection is parsed back.
 */
export function hydrateDoc(rich: RichDoc | null | undefined, plain: string | null | undefined): RichDoc {
  if (rich && rich.blocks.length > 0) return normalizeDoc(rich);
  return plainTextToDoc(plain);
}
