import type { TranslationKey } from '@/i18n';
import { docCharCount } from './doc';
import { CHAT_LIMITS, DESCRIPTION_BUDGET } from './limits';
import { INLINE_MARKS, type InlineNode, type RichDoc } from './types';

/**
 * Content guidance for the editor footer.
 *
 * The rule this follows: only warn about something the vendor cannot see in the
 * preview. Length is visible, so it gets a quiet counter rather than a warning
 * until it actually costs them content. A dropped bold marker or a link label
 * WhatsApp will discard *is* visible in the preview — but only if they happen to
 * switch tabs, and the whole failure mode being guarded against here is a vendor
 * who checks the Telegram tab and assumes WhatsApp matches.
 *
 * Nothing here blocks a save. A description that WhatsApp renders imperfectly is
 * still a valid description, and a vendor who has decided to keep an asterisk in
 * their product name is not wrong.
 */

export type LintSeverity = 'info' | 'warn';

export type LintNotice = {
  key: TranslationKey;
  severity: LintSeverity;
  params?: Record<string, string | number>;
};

const MARKER_FOR_MARK: Record<string, string> = {
  bold: '*',
  italic: '_',
  strike: '~',
};

function eachInline(doc: RichDoc, visit: (node: InlineNode) => void): void {
  for (const block of doc.blocks) {
    if (block.type === 'paragraph') {
      block.text.forEach(visit);
      continue;
    }
    block.items.forEach((item) => item.forEach(visit));
  }
}

/**
 * Mirrors the collision guard in `format/whatsapp.ts`.
 *
 * Kept as a separate predicate rather than having the formatter report back,
 * because the formatter runs on a *truncated* document and the vendor needs to
 * know about a problem in the part that got cut too.
 */
function hasMarkerCollision(doc: RichDoc): boolean {
  let found = false;
  eachInline(doc, (node) => {
    if (found || node.type !== 'text') return;
    for (const mark of INLINE_MARKS) {
      if (node[mark] && node.text.includes(MARKER_FOR_MARK[mark])) {
        found = true;
        return;
      }
    }
  });
  return found;
}

function hasLabelledLink(doc: RichDoc): boolean {
  let found = false;
  eachInline(doc, (node) => {
    if (found || node.type !== 'link') return;
    const label = node.text.trim();
    if (label && label !== node.href) found = true;
  });
  return found;
}

function longestList(doc: RichDoc): number {
  return doc.blocks.reduce(
    (max, block) => (block.type === 'list' ? Math.max(max, block.items.length) : max),
    0,
  );
}

/**
 * Returns notices in priority order — the UI shows the first one only, so the
 * most consequential has to come first. Losing content to truncation outranks a
 * formatting nicety.
 */
export function lintDoc(doc: RichDoc): LintNotice[] {
  const notices: LintNotice[] = [];
  const length = docCharCount(doc);

  if (length > DESCRIPTION_BUDGET) {
    notices.push({
      key: 'products.editor.lint.overBudget',
      severity: 'warn',
      params: { max: DESCRIPTION_BUDGET },
    });
  } else if (length > CHAT_LIMITS.WARN) {
    notices.push({ key: 'products.editor.lint.tooLong', severity: 'warn' });
  }

  if (hasMarkerCollision(doc)) {
    notices.push({ key: 'products.editor.lint.markerCollision', severity: 'warn' });
  }

  if (hasLabelledLink(doc)) {
    notices.push({ key: 'products.editor.lint.linkLabel', severity: 'info' });
  }

  const list = longestList(doc);
  if (list > CHAT_LIMITS.MAX_LIST_ITEMS) {
    notices.push({
      key: 'products.editor.lint.longList',
      severity: 'info',
      params: { max: CHAT_LIMITS.MAX_LIST_ITEMS },
    });
  }

  // A description inside the ideal band produces no notices at all. Filling the
  // footer with praise would train vendors to stop reading it.
  return notices;
}
