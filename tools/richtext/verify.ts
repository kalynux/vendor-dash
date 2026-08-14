import {
  CHAT_LIMITS,
  docCharCount,
  lintDoc,
  plainTextToDoc,
  toPlainText,
  toTelegramHtml,
  toTelegramPlain,
  toWhatsApp,
  type RichDoc,
} from '@/lib/richtext';
import { FIXTURES, type Fixture } from './fixtures';

/**
 * Formatter verification.
 *
 * The repo has no test runner, so this follows the pattern `i18n:smoke` already
 * established: bundle the real modules with esbuild and execute them in node.
 * It both prints every fixture through every formatter — because a chat message
 * has to be *read* to be judged — and asserts the invariants that are not
 * obvious from reading.
 *
 * Run with `npm run richtext:verify`.
 */

let failures = 0;

function fail(fixture: string, message: string): void {
  failures += 1;
  console.error(`  ✗ [${fixture}] ${message}`);
}

function check(fixture: string, condition: boolean, message: string): void {
  if (!condition) fail(fixture, message);
}

function diff(label: string, actual: string, expected: string): string {
  return `${label} mismatch\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`;
}

/* ─── Invariants ──────────────────────────────────────────────────────────── */

const TELEGRAM_TAG = /<\/?(b|i|s|a)(?:\s+href="[^"]*")?>/g;

/**
 * Telegram's HTML parser rejects the whole message on a malformed entity, so a
 * stray tag is a dropped send rather than a cosmetic defect.
 */
function checkTelegramHtml(name: string, html: string): void {
  const stack: string[] = [];
  for (const match of html.matchAll(TELEGRAM_TAG)) {
    const tag = match[1];
    if (match[0].startsWith('</')) {
      if (stack.pop() !== tag) {
        fail(name, `telegram HTML has an unbalanced </${tag}>`);
        return;
      }
    } else {
      stack.push(tag);
    }
  }
  check(name, stack.length === 0, `telegram HTML left ${stack.length} tag(s) open`);

  // Everything that is not one of our four tags must be escaped text.
  const stripped = html.replace(TELEGRAM_TAG, '');
  check(name, !/[<>]/.test(stripped), 'telegram HTML contains an unescaped < or >');
  check(
    name,
    !/&(?!amp;|lt;|gt;)/.test(stripped),
    'telegram HTML contains a bare & (must be &amp;)',
  );
}

/**
 * WhatsApp only renders a marker pair when both markers touch a non-whitespace
 * character, so `* bold *` is three literal characters and a broken promise.
 * Only checked on fixtures that contain no literal markers of their own.
 */
function checkWhatsAppMarkers(name: string, body: string): void {
  for (const marker of ['*', '_', '~']) {
    const count = body.split(marker).length - 1;
    check(name, count % 2 === 0, `whatsapp body has an odd number of "${marker}" markers`);
  }
  check(
    name,
    !/(^|\s)[*_~]\s/.test(body),
    'whatsapp body has an opening marker followed by whitespace',
  );
  check(name, !/\s[*_~](\s|$)/.test(body), 'whatsapp body has a closing marker preceded by whitespace');
}

function checkPlain(name: string, plain: string): void {
  check(name, !/<\/?[a-z]/i.test(plain), 'plain projection contains HTML tags');
  check(name, !/\*\*|__|~~/.test(plain), 'plain projection contains markdown markers');
}

/**
 * The plain projection is what a product reopens from until the backend
 * persists `descriptionRich`, so the structure it can carry has to survive the
 * round trip even though the marks cannot.
 */
function checkPlainRoundTrip(name: string, doc: RichDoc): void {
  const reparsed = plainTextToDoc(toPlainText(doc));
  const shape = (d: RichDoc) =>
    d.blocks.map((b) => (b.type === 'list' ? `${b.ordered ? 'ol' : 'ul'}:${b.items.length}` : 'p'));
  const before = shape(doc).join(',');
  const after = shape(reparsed).join(',');
  check(name, before === after, `plain round trip changed structure\n      before: ${before}\n      after:  ${after}`);
}

/* ─── Runner ──────────────────────────────────────────────────────────────── */

function run(fixture: Fixture): void {
  const { name, doc } = fixture;
  const plain = toPlainText(doc);
  const wa = toWhatsApp(doc);
  const tgHtml = toTelegramHtml(doc);
  const tgPlain = toTelegramPlain(doc);

  console.log(`\n${'─'.repeat(78)}\n${name}  (${docCharCount(doc)} chars)\n${'─'.repeat(78)}`);
  console.log(`\n· description (stored, indexed, storefront)\n${plain}`);
  console.log(`\n· WhatsApp — text.body\n${wa}`);
  console.log(`\n· Telegram — sendMessage + parse_mode:'HTML'\n${tgHtml}`);
  console.log(`\n· Telegram — t.me/share/url?text=\n${tgPlain}`);

  const notices = lintDoc(doc);
  if (notices.length) {
    console.log(`\n· lint → ${notices.map((n) => `${n.severity}:${n.key}`).join(', ')}`);
  }

  checkPlain(name, plain);
  checkPlainRoundTrip(name, doc);
  checkTelegramHtml(name, tgHtml);
  if (fixture.strictMarkers) checkWhatsAppMarkers(name, wa);

  for (const [label, value] of [
    ['whatsapp', wa],
    ['telegram html', tgHtml],
    ['telegram plain', tgPlain],
  ] as const) {
    check(name, value.length <= CHAT_LIMITS.MAX, `${label} is ${value.length} chars, over the ${CHAT_LIMITS.MAX} cap`);
  }

  if (fixture.expectWhatsApp !== undefined && wa !== fixture.expectWhatsApp) {
    fail(name, diff('whatsapp', wa, fixture.expectWhatsApp));
  }
  if (fixture.expectTelegramHtml !== undefined && tgHtml !== fixture.expectTelegramHtml) {
    fail(name, diff('telegram html', tgHtml, fixture.expectTelegramHtml));
  }
}

FIXTURES.forEach(run);

console.log(`\n${'═'.repeat(78)}`);
if (failures > 0) {
  console.error(`${failures} assertion(s) failed across ${FIXTURES.length} fixtures.`);
  process.exit(1);
}
console.log(`All invariants hold across ${FIXTURES.length} fixtures.`);
