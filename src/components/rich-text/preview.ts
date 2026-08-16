/**
 * Client-side parsers that mimic how each messenger renders what we send.
 *
 * The preview deliberately does **not** render the document. It renders the
 * *output string* — `toWhatsApp(doc)` and `toTelegramHtml(doc)` — parsed back
 * the way each platform's client would parse it. That extra round trip is the
 * entire value of the preview: it is what makes the WhatsApp tab show a marker
 * collision as genuinely unbolded text while the Telegram tab shows it bold,
 * instead of showing both bold because both were drawn from the same document.
 *
 * If a vendor can see a difference here, it is a real difference on their
 * customer's phone.
 */

export type PreviewNode = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  href?: string;
};

type Marks = { bold?: boolean; italic?: boolean; strike?: boolean };

/* ─── WhatsApp ────────────────────────────────────────────────────────────── */

const WA_MARKERS: Record<string, keyof Marks> = { '*': 'bold', _: 'italic', '~': 'strike' };

const URL_IN_TEXT = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
const URL_TRAILING = /[.,;:!?)\]}"'»…]+$/;

/** Split a leaf run into text and auto-detected links, as the client does. */
function autolink(text: string, marks: Marks): PreviewNode[] {
  const out: PreviewNode[] = [];
  let cursor = 0;

  for (const match of text.matchAll(URL_IN_TEXT)) {
    const start = match.index ?? 0;
    const raw = match[0].replace(URL_TRAILING, '');
    if (start > cursor) out.push({ text: text.slice(cursor, start), ...marks });
    out.push({
      text: raw,
      href: raw.toLowerCase().startsWith('www.') ? `https://${raw}` : raw,
      ...marks,
    });
    cursor = start + raw.length;
  }

  if (cursor < text.length) out.push({ text: text.slice(cursor), ...marks });
  return out;
}

/**
 * Locate the first marker pair WhatsApp would actually honour.
 *
 * The rules encoded here are the ones that trip vendors up: an opening marker
 * must not be followed by whitespace, a closing marker must not be preceded by
 * it, and an opener has to start a word. That is why `* bold *` renders as
 * literal asterisks, and why the formatter goes to the trouble of hoisting edge
 * whitespace out of the pair.
 */
function findMarkerPair(text: string): { start: number; end: number; mark: keyof Marks } | null {
  for (let i = 0; i < text.length; i += 1) {
    const mark = WA_MARKERS[text[i]];
    if (!mark) continue;

    const after = text[i + 1] ?? '';
    if (!after || /\s/.test(after)) continue;
    const before = i === 0 ? '' : text[i - 1];
    if (before && !/[\s([{«"']/.test(before)) continue;

    for (let j = i + 1; j < text.length; j += 1) {
      if (text[j] !== text[i]) continue;
      if (/\s/.test(text[j - 1])) continue;
      const next = text[j + 1] ?? '';
      if (next && !/[\s.,;:!?)\]}»"']/.test(next)) continue;
      return { start: i, end: j, mark };
    }
  }
  return null;
}

function parseWhatsAppRun(text: string, marks: Marks): PreviewNode[] {
  const pair = findMarkerPair(text);
  if (!pair) return autolink(text, marks);

  return [
    ...(pair.start > 0 ? autolink(text.slice(0, pair.start), marks) : []),
    ...parseWhatsAppRun(text.slice(pair.start + 1, pair.end), { ...marks, [pair.mark]: true }),
    ...parseWhatsAppRun(text.slice(pair.end + 1), marks),
  ];
}

export function parseWhatsAppPreview(body: string): PreviewNode[] {
  return parseWhatsAppRun(body, {});
}

/* ─── Telegram ────────────────────────────────────────────────────────────── */

const TG_TOKEN = /<(\/?)(b|i|s|a)(?:\s+href="([^"]*)")?>/g;

function decodeEntities(text: string): string {
  return text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

/**
 * Tokenise the HTML we generated ourselves.
 *
 * A tokeniser rather than `innerHTML` + a walk: this string is destined for a
 * `parse_mode: 'HTML'` send, and parsing it with the browser would quietly
 * accept markup Telegram would reject — so the preview would look right for
 * output that fails on send. Only the four tags the formatter emits are
 * recognised; anything else falls through as literal text, which is exactly what
 * Telegram would do before returning `400 can't parse entities`.
 */
export function parseTelegramPreview(html: string): PreviewNode[] {
  const out: PreviewNode[] = [];
  const stack: { tag: string; href?: string }[] = [];
  let cursor = 0;

  const pushText = (raw: string) => {
    if (!raw) return;
    const marks: Marks = {};
    let href: string | undefined;
    for (const entry of stack) {
      if (entry.tag === 'b') marks.bold = true;
      if (entry.tag === 'i') marks.italic = true;
      if (entry.tag === 's') marks.strike = true;
      if (entry.tag === 'a') href = entry.href;
    }
    out.push({ text: decodeEntities(raw), ...marks, ...(href ? { href } : {}) });
  };

  for (const match of html.matchAll(TG_TOKEN)) {
    const index = match.index ?? 0;
    pushText(html.slice(cursor, index));
    cursor = index + match[0].length;

    if (match[1] === '/') {
      stack.pop();
    } else {
      stack.push({ tag: match[2], href: match[3] });
    }
  }

  pushText(html.slice(cursor));
  return out;
}
