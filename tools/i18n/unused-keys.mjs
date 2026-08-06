#!/usr/bin/env node
/**
 * Find catalog keys that no source file references, and English values that are
 * duplicated across keys. Conservative: any key whose *parent namespace* is
 * accessed dynamically (a template literal or a variable index) is treated as
 * used, because those resolve at runtime.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.argv[2] || process.cwd();
const SRC = join(ROOT, 'src');
const EN = join(ROOT, 'src', 'i18n', 'locales', 'en');

function walk(dir, out = []) {
    for (const e of readdirSync(dir)) {
        const full = join(dir, e);
        if (statSync(full).isDirectory()) walk(full, out);
        else out.push(full);
    }
    return out;
}

// ─── catalog keys (same extraction as tools/i18n/audit.mjs) ─────────────────
function blankStrings(source) {
    return source.replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/gs, (lit) =>
        lit[0] + ' '.repeat(Math.max(0, lit.length - 2)) + lit[lit.length - 1]);
}

function extractKeys(source) {
    const clean = blankStrings(source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1'));
    const keys = [];
    const stack = [];
    let depth = 0, pluralDepth = -1;
    for (const m of clean.matchAll(/([A-Za-z_$][\w$]*|\d+)\s*:\s*(plural\s*\()?|[{}]/g)) {
        const tok = m[0];
        if (tok === '{') { depth++; continue; }
        if (tok === '}') {
            depth--;
            if (pluralDepth >= 0 && depth <= pluralDepth) pluralDepth = -1;
            while (stack.length && stack[stack.length - 1].contentDepth > depth) stack.pop();
            continue;
        }
        if (pluralDepth >= 0) continue;
        const name = m[1];
        const isPlural = Boolean(m[2]);
        const valueStartsObject = clean.slice(m.index + tok.length).trimStart().startsWith('{');
        while (stack.length && stack[stack.length - 1].contentDepth > depth) stack.pop();
        const path = [...stack.map((s) => s.name), name].join('.');
        if (isPlural) { keys.push(path); pluralDepth = depth; }
        else if (valueStartsObject) stack.push({ name, contentDepth: depth + 1 });
        else keys.push(path);
    }
    return keys;
}

// English values, for the duplicate report.
function extractPairs(source) {
    const out = [];
    for (const m of source.matchAll(/^\s*([A-Za-z_$][\w$]*)\s*:\s*(['"])((?:[^'"\\]|\\.){2,}?)\2\s*,?\s*$/gm)) {
        out.push([m[1], m[3]]);
    }
    return out;
}

const allKeys = new Set();
const valueIndex = new Map(); // english text -> [keys]
for (const file of readdirSync(EN).filter((f) => f.endsWith('.ts') && f !== 'index.ts')) {
    const ns = file.replace(/\.ts$/, '');
    const src = readFileSync(join(EN, file), 'utf8');
    for (const k of extractKeys(src)) allKeys.add(`${ns}.${k}`);
    for (const [leaf, value] of extractPairs(src)) {
        if (!valueIndex.has(value)) valueIndex.set(value, []);
        valueIndex.get(value).push(`${ns}…${leaf}`);
    }
}

// ─── every string literal that appears anywhere in src/ ─────────────────────
const literals = new Set();
const dynamicPrefixes = new Set();
const SKIP = [join('src', 'i18n', 'locales') + sep];

for (const file of walk(SRC)) {
    if (!/\.(tsx|ts)$/.test(file)) continue;
    const rel = relative(ROOT, file);
    if (SKIP.some((s) => rel.startsWith(s))) continue;
    const src = readFileSync(file, 'utf8');

    // plain 'a.b.c' literals
    for (const m of src.matchAll(/['"]([a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9_]+)+)['"]/g)) {
        literals.add(m[1]);
    }
    // template-literal keys: `products.status.${x}` → prefix products.status
    for (const m of src.matchAll(/`([a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9_]+)*)\.\$\{/g)) {
        dynamicPrefixes.add(m[1]);
    }
    // computed access: t(SOME_MAP[x]) can't be resolved — record map-valued keys
    // by treating every 'a.b.c' literal (already covered) plus indexed namespaces.
    for (const m of src.matchAll(/['"]([a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9_]+)+)\.['"]?\s*\+/g)) {
        dynamicPrefixes.add(m[1]);
    }
}

function isUsed(key) {
    if (literals.has(key)) return true;
    for (const p of dynamicPrefixes) if (key.startsWith(p + '.')) return true;
    return false;
}

const unused = [...allKeys].filter((k) => !isUsed(k)).sort();

// Group by namespace prefix for readability.
const byNs = new Map();
for (const k of unused) {
    const ns = k.split('.').slice(0, 2).join('.');
    if (!byNs.has(ns)) byNs.set(ns, []);
    byNs.get(ns).push(k);
}

console.log(`UNUSED: ${unused.length} of ${allKeys.size} keys have no literal reference\n`);
for (const [ns, keys] of [...byNs.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`${String(keys.length).padStart(4)}  ${ns}`);
    for (const k of keys) console.log(`        ${k}`);
}

console.log('\n\nDUPLICATE ENGLISH VALUES (same text, >2 keys):\n');
for (const [value, keys] of [...valueIndex.entries()].sort((a, b) => b[1].length - a[1].length)) {
    if (keys.length < 3) continue;
    console.log(`${String(keys.length).padStart(3)}×  "${value.slice(0, 60)}"`);
    console.log(`      ${keys.slice(0, 12).join(', ')}${keys.length > 12 ? ' …' : ''}`);
}
