/**
 * Runtime smoke test for the translation layer — `npm run i18n:smoke`.
 *
 * Bundled with esbuild and run in Node so it exercises the *real* catalogs and
 * the real resolver, not a mock. Covers the things a type-check cannot: plural
 * category selection per locale, interpolation, the fallback chain, and the
 * guarantee that a raw backend message never reaches a user.
 */
import en from '../../src/i18n/locales/en';
import fr from '../../src/i18n/locales/fr';
import { createTranslator, createHasKey } from '../../src/i18n/translator';
import { resolveApiError } from '../../src/i18n/api-errors';
import { formatCurrency, formatDate, formatNumber } from '../../src/i18n/format';
import { ApiError } from '../../src/types/api';
import type { MessageCatalog } from '../../src/i18n/types';

const enCat = en as unknown as MessageCatalog;
const frCat = fr as unknown as MessageCatalog;

const tEn = createTranslator('en', enCat, enCat);
const tFr = createTranslator('fr', frCat, enCat);
const hasEn = createHasKey(enCat, enCat);
const hasFr = createHasKey(frCat, enCat);

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
    const ok = actual === expected;
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}\n        got:      ${JSON.stringify(actual)}${ok ? '' : `\n        expected: ${JSON.stringify(expected)}`}`);
}

console.log('\n── Lookup & interpolation ─────────────────────────────────────');
check('en simple key', tEn('common.actions.save'), 'Save');
check('fr simple key', tFr('common.actions.save'), 'Enregistrer');
check('fr nested page key', tFr('overview.title'), 'Vue d’ensemble');
check('interpolation', tEn('common.pagination.pageOf', { page: 2, total: 9 }), 'Page 2 of 9');
check('fr interpolation', tFr('common.pagination.pageOf', { page: 2, total: 9 }), 'Page 2 sur 9');

console.log('\n── Pluralization (Intl.PluralRules) ───────────────────────────');
check('en one', tEn('common.units.orders', { count: 1 }), '1 order');
check('en other', tEn('common.units.orders', { count: 5 }), '5 orders');
check('en zero → other', tEn('common.units.orders', { count: 0 }), '0 orders');
// French treats 0 and 1 as singular — the reason plural forms cannot be a
// count===1 ternary at the call site.
check('fr zero → one', tFr('common.units.orders', { count: 0 }), '0 commande');
check('fr one', tFr('common.units.orders', { count: 1 }), '1 commande');
check('fr other', tFr('common.units.orders', { count: 5 }), '5 commandes');

console.log('\n── Fallback chain ─────────────────────────────────────────────');
const tEs = createTranslator('es', {} as MessageCatalog, enCat);
check('untranslated locale falls back to en', tEs('common.actions.save'), 'Save');
check('unknown key returns the key', tEn('nope.not.here'), 'nope.not.here');
check('namespace node is not a leaf', tEn('common.actions'), 'common.actions');
check('hasKey true for leaf', hasEn('common.actions.save'), true);
check('hasKey false for namespace', hasEn('common.actions'), false);

console.log('\n── Backend error resolution ───────────────────────────────────');
const raw = 'Vendor 68f1 has insufficient stock in shard 3 [trace 9a2c]';
const stockErr = new ApiError(409, 'CATALOG_INSUFFICIENT_STOCK', raw);
check(
    'en code → catalog message (never err.message)',
    resolveApiError(stockErr, tEn, hasEn),
    'There is not enough stock for that.',
);
check(
    'fr code → translated message',
    resolveApiError(stockErr, tFr, hasFr),
    'Le stock est insuffisant pour cela.',
);
check(
    'raw backend text never surfaces',
    resolveApiError(stockErr, tEn, hasEn).includes('shard 3'),
    false,
);
check(
    'context override wins over generic',
    resolveApiError(new ApiError(409, 'CATALOG_PRODUCT_SIMPLE_MODE_LOCKED', raw), tEn, hasEn, {
        context: 'simpleProduct',
    }),
    'This product uses the quick editor, so that action is not available. Switch it to the advanced editor first.',
);
check(
    'unmapped code → HTTP status message',
    resolveApiError(new ApiError(403, 'SOME_BRAND_NEW_CODE', raw), tEn, hasEn),
    "You don't have permission to do that.",
);
check(
    'unmapped code, fr',
    resolveApiError(new ApiError(403, 'SOME_BRAND_NEW_CODE', raw), tFr, hasFr),
    "Vous n'avez pas l'autorisation de faire cela.",
);
check(
    'network failure',
    resolveApiError(new TypeError('Failed to fetch'), tFr, hasFr),
    'Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.',
);

console.log('\n── Locale-aware formatting ────────────────────────────────────');
check('en number', formatNumber('en', 1234567.5), '1,234,567.5');
check('fr number groups with NBSP', formatNumber('fr', 1234567.5).includes(','), true);
// XAF renders as its local symbol "FCFA", and Intl places it per locale:
// prefixed in English, suffixed in French. No decimals either way.
// Intl separates symbol from amount with a non-breaking space (U+00A0).
const nbsp = (s: string) => s.replace(/ | /g, ' ');
check('en XAF', nbsp(formatCurrency('en', 45000, 'XAF')), 'FCFA 45,000');
check('fr XAF is suffixed', formatCurrency('fr', 45000, 'XAF').endsWith('FCFA'), true);
check('fr XAF has no decimals', formatCurrency('fr', 45000, 'XAF').includes(','), false);
check('EUR keeps its minor unit', formatCurrency('en', 12.5, 'EUR'), '€12.50');
check('en date', formatDate('en', '2026-03-14T10:00:00Z', 'medium'), 'Mar 14, 2026');
check('fr date', formatDate('fr', '2026-03-14T10:00:00Z', 'medium'), '14 mars 2026');
check('null date → dash', formatDate('en', null), '—');

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
