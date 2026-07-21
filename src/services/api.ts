import { ApiError, type ApiErrorDetail, type UploadViolation, type BlockedAddress, type ApiRowError } from '@/types/api';

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

async function refreshTokens(): Promise<void> {
    const res = await fetch(`${BASE_URL}/auth/me`, {
        method: 'GET',
        credentials: 'include',
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

async function buildApiError(res: Response): Promise<ApiError> {
    let body: Record<string, unknown> = {};
    try {
        body = await res.json();
    } catch {
        // response body may not be JSON
    }

    const error = (body.error ?? body) as Record<string, unknown>;
    const message =
        (error.message as string) ??
        (body.message as string) ??
        `Request failed with status ${res.status}`;
    const code = (error.code as string) ?? String(res.status);
    const requestId = (body.requestId as string) ?? undefined;

    // `error.details` shape varies by code:
    //  - VALIDATION_ERROR                 → an array of { field, message }
    //  - UPLOAD_POLICY_VIOLATION          → an object { violations: [...] }
    //  - VENDOR_BUSINESS_ADDRESS_IN_USE   → an object { blockedAddresses: [...] }
    // Keep the array path as `details`; lift the object-shaped payloads out separately.
    const rawDetails = error.details;
    const details = Array.isArray(rawDetails) ? (rawDetails as ApiErrorDetail[]) : undefined;
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

    return new ApiError(res.status, code, message, details, requestId, violations, blockedAddresses, rowErrors);
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
