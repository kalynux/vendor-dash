// ─── The request path ─────────────────────────────────────────────────────────
//
// One core, two transports. Which headers go out, whether cookies are sent, and
// how a session is renewed are all answered by `authStrategy`
// (src/platform/auth/strategy.ts) — this file never asks what platform it is on.
// That is what keeps the subtle part below, the single-flight refresh queue,
// written once instead of forked per transport.
//
// The low-level primitives (`BASE_URL`, `unwrapEnvelope`, `errorFromBody`) moved
// to `./http` to break the cycle between this file and the strategy. They are
// re-exported here so every existing import site still resolves.

import { ApiError } from '@/types/api';
import { BASE_URL, buildApiError } from './http';
import { authStrategy } from '@/platform/auth/strategy';
import { refreshSession } from '@/platform/auth/refreshScheduler';

export { BASE_URL, unwrapEnvelope, errorFromBody } from './http';

// ─── Refresh queue ────────────────────────────────────────────────────────────
// Ensures only one token refresh is in-flight at a time.
// All concurrent 401s are held and resolved/rejected after the refresh settles.

type QueueItem = {
    resolve: () => void;
    reject: (err: ApiError) => void;
};

let isRefreshing = false;
let pendingQueue: QueueItem[] = [];

function flushQueue(err?: ApiError) {
    pendingQueue.forEach((item) => {
        if (err) item.reject(err);
        else item.resolve();
    });
    pendingQueue = [];
}

// Hard logout: end the session on whichever transport is active, then tell the
// app. `endSession()` clears the server's cookies on web and forgets the stored
// pair on native — the strategy owns that difference, not this file.
async function hardLogout(): Promise<void> {
    await authStrategy.endSession();
    // Signal to the app that auth is gone
    window.dispatchEvent(new Event('auth:logout'));
}

// ─── Terminal vs. recoverable auth failures ───────────────────────────────────

/**
 * 401s and 403s that no refresh can fix. Branch on `error.code`, never on the
 * status — the status is the same for the one case that IS recoverable.
 *
 * `AUTH_TOKEN_EXPIRED` is deliberately absent: it is the only non-terminal one,
 * and it means *refresh now*. Anything not listed here also falls through to the
 * refresh attempt, which is the conservative direction — an unrecognised code
 * costs one doomed round trip rather than signing someone out by surprise.
 *
 * See backend api-doc/auth/FRONTEND-CHANGELOG-mobile-auth.md §3.
 */
const TERMINAL_AUTH_CODES: ReadonlySet<string> = new Set([
    // No token and no refresh credential — refreshing cannot help.
    'AUTH_MISSING_TOKEN',
    // The refresh token itself was rejected. In development this most often
    // means the ACCESS token was posted to the refresh endpoint.
    'AUTH_REFRESH_TOKEN_INVALID',
    // Refresh unavailable or already failed.
    'AUTH_SESSION_EXPIRED',
    // Tampered or wrongly-signed.
    'AUTH_TOKEN_INVALID',
    // The password changed, and BOTH credential paths refuse every token minted
    // before it — the refresh credential included. Do not retry. Worth
    // surfacing verbatim: to someone who did not change their own password, it
    // is the first sign that somebody else did.
    'AUTH_PASSWORD_CHANGED',
    'AUTH_USER_NOT_FOUND',
    // 403, not 401 — but equally unrecoverable from here.
    'AUTH_ACCOUNT_SUSPENDED',
]);

/**
 * A response that ends the session outright.
 *
 * Returns the error to throw, or `null` when the ordinary refresh-and-retry is
 * worth attempting.
 */
async function terminalAuthError(res: Response): Promise<ApiError | null> {
    const err = await buildApiError(res);
    if (!TERMINAL_AUTH_CODES.has(err.code)) return null;
    // Anything parked behind an in-flight refresh is dead too — the same rule
    // refuses every credential this session holds.
    isRefreshing = false;
    flushQueue(err);
    await hardLogout();
    return err;
}

/**
 * Run the shared single-flight refresh, then hand back a retry of the original
 * request. Written once and used by both the JSON and the multipart paths, which
 * is the whole reason it is a function rather than two copies of a `try`.
 */
async function refreshThenRetry<T>(retry: () => Promise<T>): Promise<T> {
    // If another refresh is already in flight, queue this request behind it.
    if (isRefreshing) {
        return new Promise<T>((resolve, reject) => {
            pendingQueue.push({
                resolve: () => retry().then(resolve).catch(reject),
                reject,
            });
        });
    }

    isRefreshing = true;
    try {
        // `refreshSession()`, not `authStrategy.refresh()` directly: the proactive
        // scheduler (P2.5) owns the single-flight lock, and both callers have to
        // share it. With two locks, a resume-triggered refresh and a 401-triggered
        // one can run at once — and the second posts a refresh token the first has
        // already rotated away, signing the user out for reasons nothing in the
        // logs explains. The queue below is a different thing: it holds the
        // *requests* that 401'd, and stays here.
        await refreshSession();
        isRefreshing = false;
        flushQueue(); // resolve all queued requests
        return await retry();
    } catch (refreshErr) {
        isRefreshing = false;
        const apiErr =
            refreshErr instanceof ApiError
                ? refreshErr
                : new ApiError(401, 'REFRESH_FAILED', 'Session expired');
        flushQueue(apiErr); // reject all queued requests
        await hardLogout();
        throw apiErr;
    }
}

// ─── Core request function ────────────────────────────────────────────────────

async function request<T>(
    path: string,
    init: RequestInit = {},
    isRetry = false,
): Promise<T> {
    const url = `${BASE_URL}${path}`;

    const res = await fetch(url, {
        ...init,
        credentials: authStrategy.credentials,
        headers: {
            'Content-Type': 'application/json',
            ...(await authStrategy.authHeaders()),
            ...(init.headers ?? {}),
        },
    });

    if (res.status === 401 && !isRetry) {
        const terminal = await terminalAuthError(res);
        if (terminal) throw terminal;
        return refreshThenRetry(() => request<T>(path, init, true));
    }

    if (!res.ok) {
        throw await buildApiError(res);
    }

    // 204 No Content
    if (res.status === 204) return undefined as T;

    return res.json() as Promise<T>;
}

// ─── Multipart request function ──────────────────────────────────────────────
// Used for file uploads. Does NOT set Content-Type — the browser sets it
// automatically with the correct multipart/form-data boundary.

async function requestFormData<T>(
    path: string,
    method: 'POST' | 'PUT' | 'PATCH',
    body: FormData,
    isRetry = false,
): Promise<T> {
    const url = `${BASE_URL}${path}`;

    const res = await fetch(url, {
        method,
        credentials: authStrategy.credentials,
        // No Content-Type header — browser sets multipart/form-data with boundary
        headers: await authStrategy.authHeaders(),
        body,
    });

    if (res.status === 401 && !isRetry) {
        const terminal = await terminalAuthError(res);
        if (terminal) throw terminal;
        return refreshThenRetry(() => requestFormData<T>(path, method, body, true));
    }

    if (!res.ok) {
        throw await buildApiError(res);
    }

    if (res.status === 204) return undefined as T;

    return res.json() as Promise<T>;
}

// ─── XHR support ──────────────────────────────────────────────────────────────

/**
 * Apply the active transport's credentials to a raw `XMLHttpRequest`.
 *
 * `files.service.ts` uploads through XHR rather than `fetch` because it is the
 * only way to get `upload.onprogress`, and the media UI reports real byte
 * progress. That path therefore cannot go through `request()` and needs the same
 * auth applied by hand — this is the one seam where that is allowed.
 *
 * **Must be called after `xhr.open()`**: `setRequestHeader` throws otherwise.
 */
export async function authorizeXhr(xhr: XMLHttpRequest): Promise<void> {
    xhr.withCredentials = authStrategy.credentials === 'include';
    const headers = await authStrategy.authHeaders();
    for (const [name, value] of Object.entries(headers)) {
        xhr.setRequestHeader(name, value);
    }
}

/**
 * Refresh the session once, for the XHR upload path.
 *
 * A large upload over a slow connection can outlive a 15-minute access token, so
 * a 401 there is a real case rather than a theoretical one. Shares the same
 * single-flight lock as `fetch`, so an upload and a page load racing a dead
 * token perform one refresh between them, not two.
 *
 * Returns `true` when the caller should retry, `false` when the session is over
 * (in which case the logout has already been dispatched).
 */
export async function refreshForXhr(): Promise<boolean> {
    try {
        await refreshThenRetry(async () => undefined);
        return true;
    } catch {
        return false;
    }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const api = {
    get<T>(path: string): Promise<T> {
        return request<T>(path, { method: 'GET' });
    },

    post<T>(path: string, body?: unknown): Promise<T> {
        return request<T>(path, {
            method: 'POST',
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
    },

    patch<T>(path: string, body?: unknown): Promise<T> {
        return request<T>(path, {
            method: 'PATCH',
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
    },

    put<T>(path: string, body?: unknown): Promise<T> {
        return request<T>(path, {
            method: 'PUT',
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
    },

    delete<T>(path: string, body?: unknown): Promise<T> {
        return request<T>(path, {
            method: 'DELETE',
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
    },

    postFormData<T>(path: string, body: FormData): Promise<T> {
        return requestFormData<T>(path, 'POST', body);
    },

    putFormData<T>(path: string, body: FormData): Promise<T> {
        return requestFormData<T>(path, 'PUT', body);
    },

    patchFormData<T>(path: string, body: FormData): Promise<T> {
        return requestFormData<T>(path, 'PATCH', body);
    },
};
