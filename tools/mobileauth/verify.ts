import {
  bearerAuthStrategy,
  cookieAuthStrategy,
  type AuthStrategy,
} from '@/platform/auth/strategy';
import {
  isUsableTokens,
  isUsableWireTokens,
  stampExpiry,
  devTokenStore,
  noopTokenStore,
} from '@/platform/auth/tokenStore';
import type { AuthTokens } from '@/types/api';

/**
 * Mobile (bearer) auth verification.
 *
 * The repo has no test runner, so this follows the pattern `i18n:smoke` and
 * `richtext:verify` already established: bundle the real modules with esbuild
 * and execute them in node.
 *
 * What it is actually guarding is narrow and deliberate. The bearer transport
 * has two failure modes that a reviewer cannot see and a device would only
 * reveal weeks later:
 *
 *  1. **Storing only the access token on refresh.** The pair is re-issued at
 *     full lifetime every time, and that re-issue *is* the sliding 30-day
 *     window. Keep the old refresh token and nothing breaks until a vendor is
 *     signed out mid-use, thirty days after they first logged in.
 *  2. **A token envelope that is well-formed but unusable.** `JSON.parse` is
 *     happy with `{}`, and a missing `accessExpiresIn` makes `accessExpiresAt`
 *     NaN — which compares false against every deadline, so a proactive refresh
 *     never fires and the session dies silently.
 *
 * Both are asserted below against the real modules, not mocks.
 *
 * Run with `npm run mobileauth:verify`.
 */

let failures = 0;

function check(group: string, condition: boolean, message: string): void {
  if (condition) {
    console.log(`  PASS  ${group} — ${message}`);
    return;
  }
  failures += 1;
  console.error(`  FAIL  ${group} — ${message}`);
}

function eq<T>(group: string, actual: T, expected: T, message: string): void {
  // The diff is only printed on failure — a passing run that echoed both sides
  // of every comparison would bury the one line anybody reads.
  if (Object.is(actual, expected)) {
    console.log(`  PASS  ${group} — ${message}`);
    return;
  }
  check(
    group,
    false,
    `${message}\n          expected: ${JSON.stringify(expected)}\n          actual:   ${JSON.stringify(actual)}`,
  );
}

const wire: AuthTokens = {
  accessToken: 'access.jwt.value',
  refreshToken: 'refresh.jwt.value',
  accessExpiresIn: 900,
  refreshExpiresIn: 2_592_000,
};

/* ─── The namespace split ─────────────────────────────────────────────────── */
//
// The backend chose a route namespace over a marker header, so these four paths
// ARE the transport switch. A typo in one of them is a 404 on exactly one screen
// and nothing anywhere else.

console.log('\nRoute namespaces');

const expectations: Array<[AuthStrategy, string, string, string, string, string]> = [
  [cookieAuthStrategy, 'cookie', '/auth/login', '/auth/register', '/auth/add-role', '/auth/auth-me/vendor'],
  [
    bearerAuthStrategy,
    'bearer',
    '/auth/mobile/login',
    '/auth/mobile/register',
    '/auth/mobile/add-role',
    '/auth/mobile/auth-me/vendor',
  ],
];

for (const [strategy, mode, login, registerPath, addRole, authMe] of expectations) {
  eq(mode, strategy.mode, mode as AuthStrategy['mode'], 'reports its own mode');
  eq(mode, strategy.paths.login, login, 'login path');
  eq(mode, strategy.paths.register, registerPath, 'register path');
  eq(mode, strategy.paths.addRole, addRole, 'add-role path');
  eq(mode, strategy.paths.authMe('vendor'), authMe, 'auth-me path');
}

/* ─── Credentials mode ────────────────────────────────────────────────────── */
//
// 'omit' on bearer is not a detail: under a custom Capacitor hostname every call
// is cross-origin, and sending credentials would demand a stricter CORS contract
// than a cookieless transport needs.

console.log('\nCredentials mode');
eq('cookie', cookieAuthStrategy.credentials, 'include', "cookie sends credentials");
eq('bearer', bearerAuthStrategy.credentials, 'omit', 'bearer sends none');

/* ─── Own password change ─────────────────────────────────────────────────── */
//
// The replacement pair after `PATCH /me/password` travels as cookies only. Get
// bearer's flag wrong and the phone app is signed out by its own password change
// while the screen says it stays signed in (api-doc/me/password.md).

console.log('\nOwn password change');
eq('cookie', cookieAuthStrategy.passwordChangeKeepsSession, true, 'keeps its session');
eq('bearer', bearerAuthStrategy.passwordChangeKeepsSession, false, 'must sign in again');

/* ─── Headers ─────────────────────────────────────────────────────────────── */

console.log('\nHeaders');

const cookieHeaders = await cookieAuthStrategy.authHeaders();
check('cookie', Object.keys(cookieHeaders).length === 0, 'adds no headers of its own');

// With nothing stored, bearer must send NO Authorization header rather than
// `Bearer undefined` — login and register are themselves unauthenticated, and a
// malformed header turns a clean 401 into a confusing one.
await devTokenStore.clear();
const emptyHeaders = await bearerAuthStrategy.authHeaders();
check(
  'bearer',
  emptyHeaders.Authorization === undefined,
  'omits Authorization entirely when no tokens are stored',
);

/* ─── Token guards ────────────────────────────────────────────────────────── */

console.log('\nToken guards');

check('guards', isUsableWireTokens(wire), 'accepts a complete wire pair');
check('guards', !isUsableWireTokens({}), 'rejects an empty object');
check(
  'guards',
  !isUsableWireTokens({ ...wire, accessExpiresIn: undefined }),
  'rejects a pair with no accessExpiresIn (the NaN trap)',
);
check(
  'guards',
  !isUsableWireTokens({ ...wire, accessToken: '' }),
  'rejects an empty access token',
);
check(
  'guards',
  !isUsableTokens(wire),
  'a WIRE pair is not a STORED pair — it has no accessExpiresAt yet',
);
check('guards', isUsableTokens(stampExpiry(wire)), 'accepts a stamped pair');

/* ─── Expiry stamping ─────────────────────────────────────────────────────── */

console.log('\nExpiry stamping');

const before = Date.now();
const stamped = stampExpiry(wire);
const expected = before + wire.accessExpiresIn * 1000;
check(
  'stamp',
  Number.isFinite(stamped.accessExpiresAt) &&
    stamped.accessExpiresAt >= expected &&
    stamped.accessExpiresAt <= expected + 5_000,
  'turns the duration into an absolute instant at receipt',
);
eq('stamp', stamped.refreshToken, wire.refreshToken, 'carries the refresh token through');

/* ─── The sliding window ──────────────────────────────────────────────────── */
//
// The trap this file exists for. `captureTokens` must replace BOTH tokens; a
// store that kept the old refresh token would still pass every check above.

console.log('\nSliding window');

await devTokenStore.set(wire);
const rotated: AuthTokens = {
  accessToken: 'access.jwt.SECOND',
  refreshToken: 'refresh.jwt.SECOND',
  accessExpiresIn: 900,
  refreshExpiresIn: 2_592_000,
};
await devTokenStore.set(rotated);
const held = await devTokenStore.get();
eq('rotation', held?.accessToken, rotated.accessToken, 'the access token is replaced');
eq(
  'rotation',
  held?.refreshToken,
  rotated.refreshToken,
  'the REFRESH token is replaced too — this is the sliding window',
);

// An unusable envelope must be dropped rather than stored: writing it would
// break the NEXT request instead of this one, from a store that still claims to
// hold a session.
await devTokenStore.set(wire);
await bearerAuthStrategy.captureTokens({ accessToken: 'x' } as unknown as AuthTokens);
const survived = await devTokenStore.get();
eq(
  'rotation',
  survived?.accessToken,
  wire.accessToken,
  'a malformed envelope is dropped, leaving the working pair in place',
);

/* ─── The cookie store holds nothing ──────────────────────────────────────── */

console.log('\nCookie store');
await noopTokenStore.set(wire);
eq('noop', await noopTokenStore.get(), null, 'never retains a token on the cookie transport');
eq(
  'noop',
  await cookieAuthStrategy.canAttemptSession(),
  true,
  'always worth asking the server — httpOnly cookies are invisible to script',
);

await devTokenStore.clear();
eq(
  'bearer',
  await bearerAuthStrategy.canAttemptSession(),
  false,
  'skips a doomed auth-me when it holds no tokens',
);

/* ─── Verdict ─────────────────────────────────────────────────────────────── */

console.log(`\n${'═'.repeat(78)}`);
if (failures > 0) {
  console.error(`${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log('ALL CHECKS PASSED');
