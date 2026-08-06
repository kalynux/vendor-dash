#!/usr/bin/env node
/**
 * Deep i18n audit — run with `npm run i18n:audit:deep`.
 *
 * `audit.mjs` only sees JSX text nodes and a whitelist of single-line
 * attributes. That blind spot hid ~250 real strings: this pass adds
 *   - object-literal values (title:, label:, description:, message:, …)
 *   - JSX expression literals `{'Text'}` and ternaries `{x ? 'A' : 'B'}`
 *   - prose interleaved with interpolation (`Page {n} of {m}`)
 *   - template literals containing prose
 *   - any string-valued JSX prop (blacklist of non-text props, not a whitelist)
 *   - toast.*, `new Error()`, confirm/alert, document.title, zod messages
 *
 * It is a *heuristic*, so it reports rather than fails: expect a residue of
 * false positives (Tailwind class templates, enum identifiers, brand names,
 * strings already composed from `t()`/`fmt.*`). Read each finding before acting.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.argv[2] || process.cwd();
const SRC = join(ROOT, 'src');

const SKIP_DIRS = [join('src', 'i18n') + sep, join('src', 'components', 'ui') + sep];

function walk(dir, out = []) {
    for (const e of readdirSync(dir)) {
        const full = join(dir, e);
        if (statSync(full).isDirectory()) walk(full, out);
        else out.push(full);
    }
    return out;
}

// ── prose detection ──────────────────────────────────────────────────────────

const TAILWINDISH =
    /^(?:[a-z0-9]+:)?-?(?:flex|grid|block|inline|hidden|absolute|relative|fixed|sticky|static|container|truncate|italic|uppercase|lowercase|capitalize|underline|overflow|isolate|antialiased|shrink|grow|group|peer|sr-only|not-sr-only|contents|table|list-none|whitespace|break|cursor|select|resize|appearance|outline|ring|shadow|opacity|transition|duration|ease|animate|transform|rotate|scale|translate|origin|z|order|col|row|gap|space|divide|border|rounded|bg|text|font|leading|tracking|p|px|py|pt|pb|pl|pr|ps|pe|m|mx|my|mt|mb|ml|mr|ms|me|w|h|min|max|top|bottom|left|right|start|end|inset|items|justify|self|content|place|basis|object|aspect|size|pointer-events|touch|scroll|snap|will-change|backdrop|filter|blur|brightness|invert|saturate|line-clamp|caret|accent|fill|stroke|data|aria|dark|hover|focus|active|disabled|first|last|odd|even|sm|md|lg|xl|print|motion|rtl|ltr)(?:[-/[].*)?$/;

function isClassString(s) {
    const toks = s.split(/\s+/).filter(Boolean);
    if (toks.length < 2) return false;
    const hits = toks.filter((t) => TAILWINDISH.test(t)).length;
    return hits / toks.length >= 0.6;
}

function isTranslationKey(s) {
    return /^[a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9_]+)+$/.test(s.trim());
}

/** Does this string look like prose a human would read? */
function isProse(raw) {
    const s = raw.replace(/\s+/g, ' ').trim();
    if (s.length < 3) return false;
    if (!/[A-Za-z]/.test(s)) return false;
    if (!/[a-z]/.test(s)) return false; // ALL_CAPS codes / SCREAMING_SNAKE
    if (isTranslationKey(s)) return false;
    if (isClassString(s)) return false;
    if (/^(?:https?:|mailto:|tel:|\/|\.\/|\.\.\/|#|data:|blob:)/.test(s)) return false;
    if (/^[\w.-]+\.(?:tsx?|jsx?|json|css|svg|png|jpe?g|webp|mjs|md)$/.test(s)) return false;
    if (/^[a-z0-9]+(?:[-_/][a-z0-9]+)*$/.test(s)) return false; // kebab/snake/path ids
    if (/^[a-z]+(?:[A-Z][a-z0-9]*)+$/.test(s)) return false; // camelCase identifier
    if (/^[\d\s.,:%+-]+$/.test(s)) return false;
    if (/^(?:[yMdHhmsSaZ]|[-/.:,\s'])+$/.test(s)) return false; // date format patterns
    if (/^\d+(?:px|rem|em|%|vh|vw|s|ms)$/.test(s)) return false;
    if (/^#[0-9a-fA-F]{3,8}$/.test(s)) return false;
    if (/^(?:rgb|rgba|hsl|hsla|var|calc|url|translate|linear-gradient)\(/.test(s)) return false;
    // must contain either a space + 2 real words, or be a capitalised word >= 4 chars
    const words = s.split(/\s+/).filter((w) => /[A-Za-z]{2,}/.test(w));
    if (words.length >= 2) return true;
    return /^[A-Z][a-z]{3,}$/.test(s);
}

// ── comment / string-aware helpers ───────────────────────────────────────────

function stripComments(src) {
    return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
        .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));
}

function lineOf(src, idx) {
    return src.slice(0, idx).split('\n').length;
}

// ── rules ────────────────────────────────────────────────────────────────────

/** JSX props that never render user-visible prose. */
const NON_TEXT_PROPS = new Set([
    'className', 'class', 'id', 'key', 'type', 'name', 'variant', 'size', 'href', 'to', 'src',
    'path', 'role', 'value', 'defaultValue', 'htmlFor', 'style', 'accept', 'autoComplete',
    'inputMode', 'mode', 'align', 'side', 'position', 'color', 'fill', 'stroke', 'viewBox',
    'd', 'width', 'height', 'method', 'action', 'target', 'rel', 'lang', 'dir', 'charSet',
    'property', 'content', 'httpEquiv', 'as', 'layout', 'direction', 'orientation', 'testId',
    'data-testid', 'dataKey', 'nameKey', 'strokeDasharray', 'axisLine', 'tickLine', 'itemKey',
    'currency', 'locale', 'format', 'pattern', 'step', 'min', 'max', 'maxLength', 'minLength',
    'rows', 'cols', 'tabIndex', 'crossOrigin', 'loading', 'decoding', 'referrerPolicy',
    'sizes', 'srcSet', 'media', 'preload', 'kind', 'srcLang', 'slot', 'is', 'form', 'list',
    'capture', 'enterKeyHint', 'spellCheck', 'translate', 'contentEditable', 'draggable',
    'radius', 'offset', 'sortKey', 'field', 'icon', 'iconName', 'gradientId', 'stopColor',
    'labelKey', 'titleKey', 'descriptionKey', 'messageKey', 'emptyKey', 'placeholderKey',
]);

/** Fragments that are TypeScript/JS, not prose — the JSX rules over-match in .tsx. */
function looksLikeCode(s) {
    return /=>|;|===|!==|\?\?|&&|\|\||\.\w+\(|\bconst\b|\breturn\b|\bnew\s+[A-Z]|\bimport\b|\btypeof\b|\bkeyof\b|\bextends\b|\bPromise\b|\bRecord\b|\bPartial\b|\bvoid\b|=\s|\{|\}/.test(s);
}

const RULES = [
    {
        id: 'jsx-text',
        // >Text< with no braces/tags between
        re: />\s*([A-Za-z][^<>{}]{2,}?)\s*</gs,
        pick: (m) => (looksLikeCode(m[1]) ? null : m[1]),
    },
    {
        id: 'jsx-mixed-text',
        // prose sitting next to an interpolation:  >Page {n} of {m} total<
        // Only pure-prose captures: anything with |, quotes, digits or brackets is a type.
        re: /[>}]([^<>{}]*[A-Za-z]{3,}[^<>{}]*)[{<]/g,
        tsxOnly: true,
        pick: (m) => {
            const s = m[1].trim();
            if (!/^[A-Za-z][A-Za-z\s.,!?·—–'()%/:-]*$/.test(s)) return null;
            if (looksLikeCode(s)) return null;
            // JS/TS statement heads that survive the prose filter
            if (/^(?:function|catch|export|interface|type|if|else|switch|async|for|of|while|do|try|class|enum|declare|let|var|await|in|instanceof|case|default|yield|super|this)\b/.test(s)) return null;
            if (/\($/.test(s) || /\(\s*\w+[:)]/.test(s)) return null;
            return s;
        },
    },
    {
        id: 'jsx-prop-dq',
        re: /\s([a-zA-Z][\w:-]*)="([^"\n]{3,})"/g,
        pick: (m) => (NON_TEXT_PROPS.has(m[1]) ? null : m[2]),
        label: (m) => m[1],
    },
    {
        id: 'jsx-prop-expr',
        re: /\s([a-zA-Z][\w:-]*)=\{\s*'((?:[^'\\]|\\.){3,}?)'\s*\}/g,
        pick: (m) => (NON_TEXT_PROPS.has(m[1]) ? null : m[2]),
        label: (m) => m[1],
    },
    {
        id: 'jsx-prop-tmpl',
        re: /\s([a-zA-Z][\w:-]*)=\{\s*`([^`]{3,}?)`\s*\}/g,
        pick: (m) => (NON_TEXT_PROPS.has(m[1]) ? null : m[2]),
        label: (m) => m[1],
    },
    {
        id: 'jsx-expr-literal',
        // {'Text'} or {"Text"} standing alone as a child
        re: /\{\s*(['"])((?:[^'"\\]|\\.){3,}?)\1\s*\}/g,
        pick: (m) => m[2],
    },
    {
        id: 'ternary-literal',
        re: /\?\s*(['"])((?:[^'"\\]|\\.){3,}?)\1\s*:\s*(['"])((?:[^'"\\]|\\.){3,}?)\3/g,
        pick: (m) => `${m[2]} | ${m[4]}`,
    },
    {
        id: 'object-text-value',
        re: /\b(title|label|description|message|placeholder|text|heading|subtitle|subheading|caption|hint|tooltip|helper|helperText|emptyText|emptyMessage|error|errorMessage|summary|content|body|prompt|question|answer|name|displayName|shortLabel|longLabel|badge|status|cta|action|note|warning|success|info|alt|ariaLabel|aria-label|sublabel|detail|details|footnote|legend|header|value)\s*:\s*(['"])((?:[^'"\\]|\\.){3,}?)\2/g,
        pick: (m) => m[3],
        label: (m) => m[1],
    },
    {
        id: 'object-text-tmpl',
        re: /\b(title|label|description|message|placeholder|text|heading|subtitle|hint|tooltip|emptyText|emptyMessage|error|errorMessage|summary|note|alt)\s*:\s*`([^`]{3,}?)`/g,
        pick: (m) => m[2],
        label: (m) => m[1],
    },
    {
        id: 'toast',
        re: /\btoast(?:\.(?:success|error|info|warning|message|loading|custom))?\s*\(\s*(['"`])([\s\S]{3,}?)\1/g,
        pick: (m) => m[2],
    },
    {
        id: 'thrown-error',
        re: /new\s+Error\s*\(\s*(['"`])([\s\S]{3,}?)\1/g,
        pick: (m) => m[2],
    },
    {
        id: 'browser-dialog',
        re: /\b(?:window\.)?(?:alert|confirm|prompt)\s*\(\s*(['"`])([\s\S]{3,}?)\1/g,
        pick: (m) => m[2],
    },
    {
        id: 'document-title',
        re: /document\.title\s*=\s*(['"`])([\s\S]{3,}?)\1/g,
        pick: (m) => m[2],
    },
    {
        id: 'zod-message',
        re: /\.(?:min|max|length|email|url|regex|refine|superRefine|nonempty|positive|int|gt|lt|gte|lte|startsWith|endsWith|uuid)\s*\([^)]*?(['"])((?:[^'"\\]|\\.){4,}?)\1\s*\)/g,
        pick: (m) => m[2],
    },
    {
        id: 'setError-message',
        re: /message\s*:\s*(['"`])([\s\S]{4,}?)\1/g,
        pick: (m) => m[2],
    },
    {
        id: 'template-prose',
        // template literal with prose AND an interpolation — dynamic UI text
        re: /`((?:[^`\\]|\\.)*\$\{(?:[^`}]|\}(?!`))*\}(?:[^`\\]|\\.)*)`/g,
        pick: (m) => m[1],
    },
];

// ── run ──────────────────────────────────────────────────────────────────────

const findings = [];
for (const file of walk(SRC)) {
    if (!/\.(tsx|ts)$/.test(file)) continue;
    const rel = relative(ROOT, file);
    if (SKIP_DIRS.some((s) => rel.startsWith(s))) continue;

    const raw = readFileSync(file, 'utf8');
    const src = stripComments(raw);
    const seen = new Set();

    for (const rule of RULES) {
        if (rule.tsxOnly && !file.endsWith('.tsx')) continue;
        rule.re.lastIndex = 0;
        for (const m of src.matchAll(rule.re)) {
            const picked = rule.pick(m);
            if (picked == null) continue;
            const parts = rule.id === 'ternary-literal' ? picked.split(' | ') : [picked];
            if (!parts.some((p) => isProse(p))) continue;
            const line = lineOf(src, m.index);
            const key = `${line}:${picked.slice(0, 40)}`;
            if (seen.has(key)) continue;
            seen.add(key);
            findings.push({
                file: rel,
                line,
                rule: rule.id,
                prop: rule.label ? rule.label(m) : '',
                text: picked.replace(/\s+/g, ' ').trim().slice(0, 160),
            });
        }
    }
}

const byFile = new Map();
for (const f of findings) {
    if (!byFile.has(f.file)) byFile.set(f.file, []);
    byFile.get(f.file).push(f);
}

const sorted = [...byFile.entries()].sort((a, b) => b[1].length - a[1].length);
console.log(`TOTAL ${findings.length} findings across ${sorted.length} files\n`);
for (const [file, hits] of sorted) {
    console.log(`${String(hits.length).padStart(4)}  ${file}`);
    for (const h of hits.sort((a, b) => a.line - b.line)) {
        console.log(`        L${String(h.line).padEnd(5)} [${h.rule}${h.prop ? ':' + h.prop : ''}] ${h.text}`);
    }
}
