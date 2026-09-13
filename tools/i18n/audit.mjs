#!/usr/bin/env node
/**
 * i18n audit — run with `npm run i18n:audit`.
 *
 * Three checks, each of which can fail CI:
 *
 *  1. **Locale parity** — which keys the English catalog has that a translated
 *     locale is missing, and which keys a locale has that English does not
 *     (usually a rename that was only half-applied). Only locales marked
 *     `complete` in `src/i18n/config.ts` are required to be at parity.
 *
 *  2. **Error-code coverage** — every code in `api-doc/error-codes.ts` must
 *     have a message in `errors.codes`. A missing one means a real backend
 *     failure would fall back to a generic message.
 *
 *  3. **Hardcoded strings** — a heuristic sweep of `src/` for user-visible
 *     English that never made it into a catalog: JSX text nodes and the
 *     `placeholder` / `aria-label` / `title` / `label` props. Reported as a
 *     per-file count so the remaining surface is visible and shrinkable.
 *
 * Deliberately dependency-free and source-parsing rather than importing the
 * catalogs: it has to run without a build step.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const LOCALES_DIR = join(ROOT, 'src', 'i18n', 'locales');
const SRC_DIR = join(ROOT, 'src');
const ERROR_CODES_FILE = join(ROOT, 'api-doc', 'error-codes.ts');

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

let failed = false;

function walk(dir, out = []) {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const st = statSync(full);
        if (st.isDirectory()) walk(full, out);
        else out.push(full);
    }
    return out;
}

// ─── Catalog key extraction ──────────────────────────────────────────────────
// Tracks brace depth through a namespace module and emits a dot-path per leaf.
// `plural({...})` counts as a single leaf, matching how `t()` addresses it.

/**
 * Blank out every string literal, keeping the quotes and the character count so
 * offsets stay meaningful. Without this, prose containing a colon ("…keeps your
 * list clean: one moves…") parses as a key named `clean`.
 */
function blankStrings(source) {
    return source.replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/gs, (lit) =>
        lit[0] + ' '.repeat(Math.max(0, lit.length - 2)) + lit[lit.length - 1],
    );
}

function extractKeys(source) {
    const clean = blankStrings(
        source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1'),
    );

    const keys = [];
    // Each entry records the brace depth its *contents* sit at.
    const stack = [];
    let depth = 0;
    let pluralDepth = -1;

    for (const m of clean.matchAll(/([A-Za-z_$][\w$]*|\d+)\s*:\s*(plural\s*\()?|[{}]/g)) {
        const tok = m[0];

        if (tok === '{') {
            depth++;
            continue;
        }
        if (tok === '}') {
            depth--;
            if (pluralDepth >= 0 && depth <= pluralDepth) pluralDepth = -1;
            while (stack.length && stack[stack.length - 1].contentDepth > depth) stack.pop();
            continue;
        }
        if (pluralDepth >= 0) continue; // inside plural forms — one leaf, not many

        const name = m[1];
        const isPlural = Boolean(m[2]);
        const valueStartsObject = clean.slice(m.index + tok.length).trimStart().startsWith('{');

        while (stack.length && stack[stack.length - 1].contentDepth > depth) stack.pop();
        const path = [...stack.map((s) => s.name), name].join('.');

        if (isPlural) {
            keys.push(path);
            pluralDepth = depth;
        } else if (valueStartsObject) {
            stack.push({ name, contentDepth: depth + 1 });
        } else {
            keys.push(path);
        }
    }
    return keys;
}

function catalogKeys(locale) {
    const dir = join(LOCALES_DIR, locale);
    let files;
    try {
        files = readdirSync(dir).filter((f) => f.endsWith('.ts') && f !== 'index.ts');
    } catch {
        return null;
    }
    const keys = new Set();
    for (const file of files) {
        const namespace = file.replace(/\.ts$/, '');
        for (const key of extractKeys(readFileSync(join(dir, file), 'utf8'))) {
            keys.add(`${namespace}.${key}`);
        }
    }
    return keys;
}

// Which locales must be complete — read straight from config.ts.
function completeLocales() {
    const config = readFileSync(join(ROOT, 'src', 'i18n', 'config.ts'), 'utf8');
    const out = [];
    for (const block of config.matchAll(/(\w+):\s*\{[^}]*?code:\s*'(\w+)'[\s\S]*?complete:\s*(true|false)/g)) {
        if (block[3] === 'true') out.push(block[2]);
    }
    return out;
}

// ─── 1. Locale parity ────────────────────────────────────────────────────────

console.log('\n── Locale parity ──────────────────────────────────────────────');
const enKeys = catalogKeys('en');
if (!enKeys) {
    console.error(`${RED}No English catalog found.${RESET}`);
    process.exit(1);
}
console.log(`${DIM}en: ${enKeys.size} keys (source of truth)${RESET}`);

const required = completeLocales().filter((l) => l !== 'en');
const allLocales = readdirSync(LOCALES_DIR).filter((l) => l !== 'en');

for (const locale of allLocales) {
    const keys = catalogKeys(locale);
    if (!keys || keys.size === 0) {
        console.log(`${DIM}${locale}: stub (falls back to English)${RESET}`);
        continue;
    }
    const missing = [...enKeys].filter((k) => !keys.has(k));
    const extra = [...keys].filter((k) => !enKeys.has(k));
    const mustPass = required.includes(locale);
    const pct = (((enKeys.size - missing.length) / enKeys.size) * 100).toFixed(1);

    if (missing.length === 0 && extra.length === 0) {
        console.log(`${GREEN}${locale}: ${keys.size} keys — full parity${RESET}`);
        continue;
    }
    const colour = mustPass ? RED : YELLOW;
    console.log(`${colour}${locale}: ${pct}% translated (${missing.length} missing, ${extra.length} orphaned)${RESET}`);
    missing.slice(0, 15).forEach((k) => console.log(`    missing  ${k}`));
    if (missing.length > 15) console.log(`    ${DIM}… and ${missing.length - 15} more${RESET}`);
    extra.slice(0, 15).forEach((k) => console.log(`    orphaned ${k}`));
    if (extra.length > 15) console.log(`    ${DIM}… and ${extra.length - 15} more${RESET}`);
    if (mustPass) failed = true;
}

// ─── 2. Backend error-code coverage ──────────────────────────────────────────

console.log('\n── Backend error codes ────────────────────────────────────────');
const docCodes = [...readFileSync(ERROR_CODES_FILE, 'utf8').matchAll(/^\s{4}([A-Z][A-Z0-9_]+):\s*'/gm)].map(
    (m) => m[1],
);
const enErrors = readFileSync(join(LOCALES_DIR, 'en', 'errors.ts'), 'utf8');
const mapped = new Set([...enErrors.matchAll(/^\s{8}([A-Z][A-Z0-9_]+):/gm)].map((m) => m[1]));
const unmapped = docCodes.filter((c) => !mapped.has(c));

if (unmapped.length === 0) {
    console.log(`${GREEN}All ${docCodes.length} codes in api-doc/error-codes.ts are mapped.${RESET}`);
} else {
    console.log(`${RED}${unmapped.length} of ${docCodes.length} codes have no message:${RESET}`);
    unmapped.forEach((c) => console.log(`    ${c}`));
    failed = true;
}

// ─── 3. Hardcoded-string sweep ───────────────────────────────────────────────

console.log('\n── Hardcoded strings in src/ ──────────────────────────────────');

// Files that legitimately hold English: the catalogs themselves, and the
// shadcn/ui primitives, which carry no product copy of their own.
const SKIP = [
    join('src', 'i18n') + sep,
    join('src', 'components', 'ui') + sep,
];

/** Props whose value is rendered to a user. */
const TEXT_PROPS = /\s(?:placeholder|aria-label|title|label|description|hint|hintLabel|info|emptyMessage|alt)="([^"]{3,})"/g;
/**
 * JSX text nodes: `>Some words<`.
 *
 * Deliberately spans newlines (`s` flag, no character class): explainer prose
 * inside an `info={<div><p>…</p></div>}` block is wrapped across several lines,
 * and a single-line pattern misses every one of them — which used to make this
 * count read far lower than the real remaining surface.
 */
const JSX_TEXT = />\s*([A-Z][^<>{}]{4,}?)\s*</gs;
/** Toast / alert literals. */
const TOAST = /\b(?:toast\.(?:success|error|info|warning|message)|window\.alert|confirm)\(\s*'([^']{4,})'/g;

const offenders = [];
for (const file of walk(SRC_DIR)) {
    if (!/\.(tsx|ts)$/.test(file)) continue;
    const rel = relative(ROOT, file);
    if (SKIP.some((s) => rel.startsWith(s))) continue;

    /**
     * Only a .tsx file can contain JSX, and that matters to JSX_TEXT.
     *
     * ⚠ OUTSIDE JSX, `>` AND `<` ARE COMPARISON OPERATORS, so `>…<` matches
     *   ordinary arithmetic. In src/hooks/use-swipe-navigate.ts the pattern read
     *
     *     if (dt > MAX_DURATION_MS) return; if (Math.abs(dx) < …
     *
     *   as one "text node" and reported it as untranslated copy. TypeScript
     *   requires the .tsx extension for JSX, so restricting the pattern by
     *   extension removes that entire class of false positive rather than
     *   filtering its symptoms.
     */
    const canHoldJsx = /\.tsx$/.test(file);

    const source = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1');

    const hits = [];
    for (const re of canHoldJsx ? [TEXT_PROPS, JSX_TEXT, TOAST] : [TEXT_PROPS, TOAST]) {
        re.lastIndex = 0;
        for (const m of source.matchAll(re)) {
            // Collapse the newlines a multi-line JSX node carries so `-v` output
            // stays one line per finding.
            const text = m[1].replace(/\s+/g, ' ').trim();
            // Skip things that are not prose: identifiers, class strings, numbers.
            if (/^[a-z0-9_-]+$/.test(text)) continue;
            if (/^\d/.test(text)) continue;
            if (!/[a-z]/.test(text)) continue;
            // A single short word is almost always an identifier fragment.
            if (!/\s/.test(text) && text.length < 8) continue;
            /**
             * A semicolon or an arrow means this is code, not copy.
             *
             * Inside a .tsx file the JSX_TEXT pattern still spans expressions —
             * `count > LIMIT ? 'a' : 'b'; return (` begins with a `>` and ends at
             * the next `<`. Four findings in ChatRichTextEditor, PreferencesSettings,
             * Analytics and Orders were exactly that.
             *
             * ⚠ Deliberately NOT filtering on parentheses: real copy contains them
             *   ("Price (XAF)"), and every code fragment seen here carried a
             *   semicolon anyway. Narrow beats thorough in a heuristic whose whole
             *   risk is hiding genuine copy.
             */
            if (/;|=>/.test(text)) continue;
            /**
             * A bare URL or domain is user-visible and still not translatable — a
             * hostname does not change per language. `placeholder="wi-mall.com/guide"`
             * in the link dialog is the example: correct as it stands, and it would
             * be wrong to put it in a catalog.
             */
            if (/^[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(text)) continue;
            hits.push(text);
        }
    }
    if (hits.length > 0) offenders.push({ file: rel, count: hits.length, hits });
}

offenders.sort((a, b) => b.count - a.count);
const total = offenders.reduce((n, o) => n + o.count, 0);

/** `--verbose` prints every finding, and `--all` lifts the top-25 cap. */
const VERBOSE = process.argv.includes('--verbose') || process.argv.includes('-v');
const SHOW_ALL = process.argv.includes('--all');

if (total === 0) {
    console.log(`${GREEN}No hardcoded user-visible strings detected.${RESET}`);
} else {
    console.log(
        `${YELLOW}~${total} candidate strings across ${offenders.length} files still to extract.${RESET}`,
    );
    console.log(`${DIM}Heuristic — review before acting. Worst offenders:${RESET}`);
    console.log(`${DIM}(--all for every file, --verbose to print each string)${RESET}`);
    const shown = SHOW_ALL ? offenders : offenders.slice(0, 25);
    for (const o of shown) {
        console.log(`    ${String(o.count).padStart(4)}  ${o.file}`);
        if (VERBOSE) o.hits.forEach((h) => console.log(`${DIM}          ${h.slice(0, 150)}${RESET}`));
    }
    if (!SHOW_ALL && offenders.length > 25) {
        console.log(`    ${DIM}… and ${offenders.length - 25} more files${RESET}`);
    }
}

console.log('');
process.exit(failed ? 1 : 0);
