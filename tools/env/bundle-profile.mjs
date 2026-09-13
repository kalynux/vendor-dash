#!/usr/bin/env node
/**
 * Which build profile is sitting in the SYNCED Android bundle.
 *
 *   npm run env:which               report it
 *   npm run env:assert:production   report it and exit 1 unless it is production
 *
 * ── The hazard ────────────────────────────────────────────────────────────────
 *
 * `VITE_API_BASE_URL` is inlined by Vite at BUILD time, so the backend a native
 * build talks to is frozen into the JS the moment `vite build` runs. A
 * production APK and a LAN-dev APK are then indistinguishable — same icon, same
 * version, same screens — and the difference only shows up as "nothing loads"
 * on a tester's phone, or worse, as a support ticket after a store release.
 *
 * The env files cannot answer the question. `env/.env.production` says what the
 * NEXT build would use; it says nothing about what is currently sitting in
 * `android/app/src/main/assets/`, which is what gradle packages. Those two
 * disagree constantly, because the normal development loop (`sync:android:lan`)
 * leaves a dev bundle in the tree.
 *
 * So this reads the one artifact that cannot lie: the synced bundle itself.
 *
 * ── What it checks ────────────────────────────────────────────────────────────
 *
 * The expected production values are read from `env/.env.production` rather than
 * hardcoded here, so hosts are written down in exactly one place and this guard
 * cannot drift from the profile it is guarding.
 *
 *   1. the bundle exists at all — an unsynced tree fails rather than passing;
 *   2. the only `…/api` URL in it is `env/.env.production`'s `VITE_API_BASE_URL`;
 *   3. no loopback / private-LAN / Tailscale origin appears ANYWHERE in it —
 *      this is what catches `VITE_STOREFRONT_BASE_URL`, which has no distinctive
 *      shape to match on the way an API URL does;
 *   4. the synced `capacitor.config.json` is not a LAN-dev one, i.e. the WebView
 *      is on `https` and `allowMixedContent` is off. `CAP_LAN_DEV=1` flips both
 *      (see capacitor.config.ts) and a sync copies them in beside the JS, so
 *      they are a second, independent fingerprint of which sync ran last.
 *
 * Rule 2 is deliberately an *exact set* match rather than "contains". This app
 * calls exactly one API, so a second `…/api` host in a release bundle is worth
 * stopping for. If a third party ever legitimately adds one, widen it here
 * rather than dropping the check.
 *
 * Dependency-free on purpose: it runs in the middle of an npm script chain,
 * before gradle, with nothing installed beyond node.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const ENV_DIR = join(ROOT, 'env');
const ASSETS_DIR = join(ROOT, 'android', 'app', 'src', 'main', 'assets');
const PUBLIC_DIR = join(ASSETS_DIR, 'public');
const CAP_CONFIG = join(ASSETS_DIR, 'capacitor.config.json');

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

const ASSERT_PRODUCTION = process.argv.slice(2).includes('--assert-production');

// ── env files ─────────────────────────────────────────────────────────────────

/** Minimal `KEY=value` reader. CRLF-safe; no interpolation, which no profile uses. */
function parseEnv(file) {
    const out = new Map();
    if (!existsSync(file)) return out;
    for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith('#')) continue;
        const eq = line.indexOf('=');
        if (eq < 0) continue;
        const key = line.slice(0, eq).trim();
        const value = line
            .slice(eq + 1)
            .trim()
            .replace(/^(["'])(.*)\1$/, '$2');
        out.set(key, value);
    }
    return out;
}

/** `.env.<mode>` with `.env.<mode>.local` layered on top, the way Vite resolves it. */
function profile(mode) {
    const merged = parseEnv(join(ENV_DIR, `.env.${mode}`));
    for (const [k, v] of parseEnv(join(ENV_DIR, `.env.${mode}.local`))) merged.set(k, v);
    return merged;
}

const trimSlash = (url) => (url ?? '').replace(/\/+$/, '');
const originOf = (url) => {
    try {
        return new URL(url).origin;
    } catch {
        return null;
    }
};
const hostOf = (url) => {
    try {
        return new URL(url).hostname;
    } catch {
        return url;
    }
};

const PROD = profile('production');
const MOBILE = profile('mobile');
const DEV = profile('development');

const EXPECTED_API = trimSlash(PROD.get('VITE_API_BASE_URL'));
const EXPECTED_STOREFRONT = trimSlash(PROD.get('VITE_STOREFRONT_BASE_URL'));

if (!EXPECTED_API) {
    console.error(`${RED}env/.env.production has no VITE_API_BASE_URL — nothing to check against.${RESET}`);
    process.exit(1);
}

// ── host classification ───────────────────────────────────────────────────────

// Every range a dev backend can plausibly be reached on. `10.0.2.2` is listed
// ahead of the `10.` private block so the emulator alias reports as itself.
const DEV_HOST_PATTERNS = [
    [/^localhost$/i, 'loopback'],
    [/^127\./, 'loopback'],
    [/^\[?::1\]?$/, 'loopback'],
    [/^0\.0\.0\.0$/, 'wildcard bind'],
    [/^10\.0\.2\.2$/, 'Android emulator alias for the host machine'],
    [/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, 'Tailscale — CGNAT 100.64.0.0/10'],
    [/^192\.168\./, 'private LAN'],
    [/^172\.(1[6-9]|2\d|3[01])\./, 'private LAN'],
    [/^10\./, 'private LAN'],
    [/\.local$/i, 'mDNS'],
];

const PROD_ORIGINS = new Set([originOf(EXPECTED_API), originOf(EXPECTED_STOREFRONT)].filter(Boolean));

function classify(origin) {
    const host = hostOf(origin);
    for (const [re, why] of DEV_HOST_PATTERNS) {
        if (re.test(host)) return { kind: 'development', why };
    }
    if (PROD_ORIGINS.has(origin)) return { kind: 'production', why: 'env/.env.production' };
    if (/(^|\.)wi-mall\.com$/i.test(host)) return { kind: 'production', why: 'wi-mall.com' };
    // Fonts, CDNs, schema.org, the reserved `.internal` WebView host — neither
    // our backend nor a dev machine, so neither a pass nor a fail signal.
    return { kind: 'other', why: '' };
}

// ── the bundle ────────────────────────────────────────────────────────────────

function walk(dir) {
    const out = [];
    for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) out.push(...walk(path));
        else if (/\.(js|html)$/i.test(name)) out.push(path);
    }
    return out;
}

const URL_RE = /https?:\/\/[a-zA-Z0-9._-]+(?::\d+)?/g;
const API_RE = /https?:\/\/[a-zA-Z0-9._-]+(?::\d+)?\/api(?![a-zA-Z0-9._-])/g;

const bundleFiles = existsSync(PUBLIC_DIR) ? walk(PUBLIC_DIR) : [];

const apiUrls = new Set();
const origins = new Set();
let syncedAt = 0;

for (const file of bundleFiles) {
    syncedAt = Math.max(syncedAt, statSync(file).mtimeMs);
    const text = readFileSync(file, 'utf8');
    for (const m of text.match(API_RE) ?? []) apiUrls.add(m);
    for (const m of text.match(URL_RE) ?? []) origins.add(m);
}

const devOrigins = [...origins].filter((o) => classify(o).kind === 'development').sort();

let capConfig = null;
if (existsSync(CAP_CONFIG)) {
    try {
        capConfig = JSON.parse(readFileSync(CAP_CONFIG, 'utf8'));
    } catch {
        capConfig = null;
    }
}
const androidScheme = capConfig?.server?.androidScheme ?? null;
const allowMixedContent = capConfig?.android?.allowMixedContent ?? false;
const capIsLanDev = capConfig !== null && (androidScheme !== 'https' || allowMixedContent === true);

// ── verdict ───────────────────────────────────────────────────────────────────

const failures = [];

if (bundleFiles.length === 0) {
    failures.push(
        'Nothing synced. android/app/src/main/assets/public/ is missing or holds no JS, ' +
            'so there is no web bundle for gradle to package.',
    );
} else {
    if (apiUrls.size !== 1 || !apiUrls.has(EXPECTED_API)) {
        failures.push(
            'The API host in the bundle is not the production one.\n' +
                `      expected exactly  ${EXPECTED_API}\n` +
                `      found             ${[...apiUrls].sort().join(', ') || '(none)'}`,
        );
    }
    if (devOrigins.length > 0) {
        failures.push(
            `Development host${devOrigins.length > 1 ? 's' : ''} baked into the bundle:\n` +
                devOrigins.map((o) => `      ${o}  ${DIM}(${classify(o).why})${RESET}`).join('\n'),
        );
    }
    if (capIsLanDev) {
        failures.push(
            `capacitor.config.json is the LAN-dev one — androidScheme "${androidScheme}", ` +
                `allowMixedContent ${allowMixedContent}.\n` +
                '      Both come from CAP_LAN_DEV=1, which only sync:android:lan and run:android set.',
        );
    }
}

const isProduction = failures.length === 0;

// ── report ────────────────────────────────────────────────────────────────────

const when = syncedAt ? `${new Date(syncedAt).toISOString().replace('T', ' ').slice(0, 16)} UTC` : '—';

console.log(`\n${BOLD}── Synced Android bundle ──────────────────────────────────────${RESET}`);
if (bundleFiles.length === 0) {
    console.log(`${DIM}${relative(ROOT, PUBLIC_DIR)}${RESET}`);
    console.log(`${RED}nothing synced${RESET}`);
} else {
    console.log(`${DIM}${relative(ROOT, PUBLIC_DIR)} — ${bundleFiles.length} files, last synced ${when}${RESET}\n`);

    const api = [...apiUrls].sort();
    console.log(`  API              ${api.join('\n                   ') || `${RED}none found${RESET}`}`);

    const knownStorefronts = [
        EXPECTED_STOREFRONT,
        MOBILE.get('VITE_STOREFRONT_BASE_URL'),
        DEV.get('VITE_STOREFRONT_BASE_URL'),
    ]
        .filter(Boolean)
        .map((s) => originOf(trimSlash(s)));
    const storefronts = [...origins].filter((o) => knownStorefronts.includes(o)).sort();
    console.log(`  storefront       ${storefronts.join(', ') || `${DIM}not detected${RESET}`}`);

    console.log(
        `  WebView          ${androidScheme ?? '?'}://${capConfig?.server?.hostname ?? '?'}` +
            `${DIM}   allowMixedContent ${allowMixedContent}${RESET}`,
    );
}

console.log('');
if (isProduction) {
    console.log(`  ${GREEN}${BOLD}PROFILE: PRODUCTION${RESET}${GREEN} — safe to build a release from this tree.${RESET}`);
} else {
    console.log(`  ${RED}${BOLD}PROFILE: NOT PRODUCTION${RESET}`);
    for (const f of failures) console.log(`    ${RED}·${RESET} ${f}`);
    console.log('');
    console.log(
        `  ${YELLOW}A release built from this tree right now would ship the above.${RESET}\n` +
            `  ${YELLOW}Re-sync first:${RESET}  ${BOLD}npm run sync:android:release${RESET}`,
    );
}

console.log(`\n${BOLD}── Profiles ───────────────────────────────────────────────────${RESET}`);
console.log(
    `  ${BOLD}PRODUCTION${RESET}   ${DIM}env/.env.production${RESET}\n` +
        `               ${EXPECTED_API}   ${EXPECTED_STOREFRONT}\n` +
        `               ${DIM}sync:android · sync:android:release · build:aab · build:apk:release${RESET}`,
);
console.log(
    `  ${BOLD}DEVELOPMENT${RESET}  ${DIM}env/.env.mobile${RESET}\n` +
        `               ${trimSlash(MOBILE.get('VITE_API_BASE_URL')) || '—'}   ` +
        `${trimSlash(MOBILE.get('VITE_STOREFRONT_BASE_URL')) || '—'}\n` +
        `               ${DIM}sync:android:lan · run:android · build:apk${RESET}`,
);
console.log('');

if (ASSERT_PRODUCTION && !isProduction) {
    console.error(
        `${RED}${BOLD}RELEASE BUILD BLOCKED${RESET}${RED} — the synced bundle is not the production profile.${RESET}\n`,
    );
    process.exit(1);
}

process.exit(0);
