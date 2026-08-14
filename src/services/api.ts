import {
    ApiError,
    type ApiErrorCategory,
    type ApiErrorDetail,
    type UploadViolation,
    type BlockedAddress,
    type ApiRowError,
} from '@/types/api';

export const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8022/api';

/**
 * Unwrap the standard `{ success, data }` envelope, tolerating the pre-envelope
 * bare payload.
 *
 * The 2026-07-17 breaking change moved auth and the Telegram/WhatsApp link-status
 * endpoints onto the platform-standard envelope (see api-doc/README.md). A few
 * per-feature docs still show the older bare payload, so — to be correct under
 * either documented shape — this returns `res.data` when the response looks
 * enveloped and the response as-is otherwise.
 */
export function unwrapEnvelope<T>(res: unknown): T {
    if (res && typeof res === 'object' && 'success' in res && 'data' in res) {
        return (res as { data: T }).data;
    }
    return res as T;
}

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

/**
 * Mint a fresh access cookie from the refresh cookie.
 *
 * `POST /auth/browser/refresh` is the only refresh endpoint on the service —
 * there is no `POST /auth/refresh`. It sits behind `requireJsonContent` (a CSRF
 * mitigation), so the JSON content type is mandatory even though it takes no
 * body. `requireAuth` also refreshes silently for cookie clients, so reaching
 * here usually means the refresh cookie is dead too.
 */
async function refreshTokens(): Promise<void> {
    const res = await fetch(`${BASE_URL}/auth/browser/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
        throw await buildApiError(res);
    }
}

// Hard logout: clear cookies server-side and reload to login
async function hardLogout(): Promise<void> {
    try {
        await fetch(`${BASE_URL}/auth/logout`, {
            method: 'POST',
            credentials: 'include',
        });
    } catch {
        // best-effort
    }
    // Signal to the app that auth is gone
    window.dispatchEvent(new Event('auth:logout'));
}

// ─── Error builder ────────────────────────────────────────────────────────────

/**
 * Turn a parsed error body into an `ApiError`.
 *
 * Shared with the XHR upload path (`files.service.ts`), which cannot use
 * `fetch`'s `Response` but hits exactly the same envelope — keeping one parser
 * is what stops the two drifting.
 *
 * `retryAfterHeader` is the raw `Retry-After` value; the docs say to prefer the
 * headers over the body's convenience field.
 */
export function errorFromBody(
    status: number,
    body: Record<string, unknown>,
    retryAfterHeader?: string | null,
): ApiError {
    const error = (body.error ?? body) as Record<string, unknown>;
    const message =
        (error.message as string) ??
        (body.message as string) ??
        `Request failed with status ${status}`;
    const code = (error.code as string) ?? String(status);
    const requestId = (body.requestId as string) ?? undefined;
    // Present on every error since Phase 16 — the default branch for a code we
    // have no specific handling for. Not narrowed at runtime: an unrecognised
    // value simply misses the category lookup and falls through to the status.
    const category = (error.category as ApiErrorCategory) ?? undefined;

    // `error.details` shape varies by code:
    //  - VALIDATION_ERROR                 → an object { fields: [{ path, message, code }] }
    //                                       (older endpoints: a bare array of { field, message })
    //  - UPLOAD_POLICY_VIOLATION          → an object { violations: [...] }
    //  - VENDOR_BUSINESS_ADDRESS_IN_USE   → an object { blockedAddresses: [...] }
    //  - RATE_LIMIT_EXCEEDED              → an object { retryAfterSeconds }
    // Field errors are normalized to `details` from either shape; the other
    // object-shaped payloads are lifted out separately.
    const rawDetails = error.details;
    const details = normalizeFieldErrors(rawDetails);
    const violations =
        rawDetails && typeof rawDetails === 'object' && Array.isArray((rawDetails as Record<string, unknown>).violations)
            ? ((rawDetails as Record<string, unknown>).violations as UploadViolation[])
            : undefined;
    const blockedAddresses =
        rawDetails && typeof rawDetails === 'object' && Array.isArray((rawDetails as Record<string, unknown>).blockedAddresses)
            ? ((rawDetails as Record<string, unknown>).blockedAddresses as BlockedAddress[])
            : undefined;

    // All-or-nothing bulk ops (e.g. inventory bulk-update) return per-row failures.
    // Confirmed shape is a top-level `errors` array; the older
    // `error.details.rowErrors` shape is also tolerated.
    const topLevelErrors = Array.isArray(body.errors) ? (body.errors as ApiRowError[]) : undefined;
    const detailRowErrors =
        rawDetails && typeof rawDetails === 'object' && Array.isArray((rawDetails as Record<string, unknown>).rowErrors)
            ? ((rawDetails as Record<string, unknown>).rowErrors as ApiRowError[])
            : undefined;
    const rowErrors = topLevelErrors ?? detailRowErrors;

    // Object-shaped `error.details` payloads that aren't one of the three keys
    // special-cased above were being parsed and dropped — e.g.
    // CATALOG_PRODUCT_SIMPLE_MODE_LOCKED's `{ mode, convertEndpoint }` and
    // VALIDATION_ERROR's `{ fields }`. Keep the raw object so per-feature code
    // can read it. Deliberately not exclusive with the branches above.
    const detailsObject =
        rawDetails && typeof rawDetails === 'object' && !Array.isArray(rawDetails)
            ? (rawDetails as Record<string, unknown>)
            : undefined;

    return new ApiError(status, code, message, {
        details,
        requestId,
        category,
        retryAfterSeconds: readRetryAfter(retryAfterHeader, detailsObject),
        violations,
        blockedAddresses,
        rowErrors,
        detailsObject,
    });
}

/**
 * Flatten `error.details` into field errors, from either documented shape.
 *
 * The platform-wide Zod projection sends `{ fields: [{ path, message, code }] }`;
 * a handful of older endpoints documented a bare `[{ field, message }]`. Callers
 * only ever want `field`, so both become that — otherwise a form maps nothing
 * and `detail.field.split(...)` throws on the shape the backend actually sends.
 */
function normalizeFieldErrors(rawDetails: unknown): ApiErrorDetail[] | undefined {
    const source = Array.isArray(rawDetails)
        ? rawDetails
        : rawDetails && typeof rawDetails === 'object'
          ? (rawDetails as Record<string, unknown>).fields
          : undefined;
    if (!Array.isArray(source) || source.length === 0) return undefined;

    const normalized: ApiErrorDetail[] = [];
    for (const raw of source) {
        if (!raw || typeof raw !== 'object') continue;
        const entry = raw as Record<string, unknown>;
        const path = typeof entry.path === 'string' ? entry.path : undefined;
        const field = typeof entry.field === 'string' ? entry.field : path;
        if (!field) continue;
        normalized.push({
            field,
            message: typeof entry.message === 'string' ? entry.message : '',
            path,
            code: typeof entry.code === 'string' ? entry.code : undefined,
        });
    }

    return normalized.length ? normalized : undefined;
}

/**
 * Seconds to wait after a 429. The header is authoritative (it is what the
 * gateway actually enforces); `details.retryAfterSeconds` is the convenience
 * copy. `Retry-After` may also be an HTTP-date — convert that to a delay.
 */
function readRetryAfter(
    header: string | null | undefined,
    detailsObject: Record<string, unknown> | undefined,
): number | undefined {
    if (header) {
        const seconds = Number(header);
        if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
        const at = Date.parse(header);
        if (!Number.isNaN(at)) return Math.max(0, Math.ceil((at - Date.now()) / 1000));
    }
    const fromBody = detailsObject?.retryAfterSeconds;
    return typeof fromBody === 'number' && Number.isFinite(fromBody) ? fromBody : undefined;
}

/** Read a `fetch` failure into an `ApiError`, tolerating a non-JSON body. */
async function buildApiError(res: Response): Promise<ApiError> {
    let body: Record<string, unknown> = {};
    try {
        body = await res.json();
    } catch {
        // response body may not be JSON
    }
    return errorFromBody(res.status, body, res.headers.get('Retry-After'));
}

/**
 * A 401 that no refresh can fix.
 *
 * `AUTH_PASSWORD_CHANGED` means the account's password changed, and *both*
 * credential paths refuse any token minted before it — the refresh cookie
 * included. The contract is explicit: do not retry, do not attempt a refresh,
 * clear local state and send the user to sign-in. Returns the error to throw,
 * or `null` when the ordinary refresh-and-retry is worth attempting.
 *
 * The message is worth surfacing verbatim: to someone who did not change their
 * own password, it is the first sign that somebody else did.
 */
async function terminalAuthError(res: Response): Promise<ApiError | null> {
    const err = await buildApiError(res);
    if (!err.isPasswordChanged) return null;
    // Anything parked behind an in-flight refresh is dead too — the same rule
    // refuses every token this session holds.
    isRefreshing = false;
    flushQueue(err);
    await hardLogout();
    return err;
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
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...(init.headers ?? {}),
        },
    });

    if (res.status === 401 && !isRetry) {
        const terminal = await terminalAuthError(res);
        if (terminal) throw terminal;

        // If another refresh is already in flight, queue this request
        if (isRefreshing) {
            return new Promise<T>((resolve, reject) => {
                pendingQueue.push({
                    resolve: () => request<T>(path, init, true).then(resolve).catch(reject),
                    reject,
                });
            });
        }

        // Begin refresh
        isRefreshing = true;
        try {
            await refreshTokens();
            isRefreshing = false;
            flushQueue(); // resolve all queued requests
            return request<T>(path, init, true); // retry original
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
        credentials: 'include',
        body,
        // No Content-Type header — browser sets multipart/form-data with boundary
    });

    if (res.status === 401 && !isRetry) {
        const terminal = await terminalAuthError(res);
        if (terminal) throw terminal;

        if (isRefreshing) {
            return new Promise<T>((resolve, reject) => {
                pendingQueue.push({
                    resolve: () => requestFormData<T>(path, method, body, true).then(resolve).catch(reject),
                    reject,
                });
            });
        }

        isRefreshing = true;
        try {
            await refreshTokens();
            isRefreshing = false;
            flushQueue();
            return requestFormData<T>(path, method, body, true);
        } catch (refreshErr) {
            isRefreshing = false;
            const apiErr =
                refreshErr instanceof ApiError
                    ? refreshErr
                    : new ApiError(401, 'REFRESH_FAILED', 'Session expired');
            flushQueue(apiErr);
            await hardLogout();
            throw apiErr;
        }
    }

    if (!res.ok) {
        throw await buildApiError(res);
    }

    if (res.status === 204) return undefined as T;

    return res.json() as Promise<T>;
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
