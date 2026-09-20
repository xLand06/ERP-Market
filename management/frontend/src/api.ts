export interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
    body?: any;
}

/**
 * Custom event fired when any API request receives a 401 Unauthorized.
 */
export const UNAUTHORIZED_EVENT = 'mgmt:unauthorized';

/**
 * Centralized API client helper.
 * - Injects Authorization: Bearer <token> from localStorage.
 * - Handles JSON serialization and Content-Type header.
 * - Handles 401 by clearing credentials, dispatching event, and throwing.
 * - Validates res.ok and throws descriptive errors with backend messages.
 */
export async function apiFetch<T = any>(url: string, options: ApiFetchOptions = {}): Promise<T> {
    const { headers: customHeaders, body, ...restOptions } = options;
    const headers = new Headers(customHeaders);

    const token = localStorage.getItem('mgmt_token');
    if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
    }

    let finalBody: BodyInit | undefined;
    if (body !== undefined && body !== null) {
        if (
            typeof body === 'object' &&
            !(body instanceof FormData) &&
            !(body instanceof Blob) &&
            !(body instanceof ArrayBuffer) &&
            !(body instanceof URLSearchParams)
        ) {
            finalBody = JSON.stringify(body);
            if (!headers.has('Content-Type')) {
                headers.set('Content-Type', 'application/json');
            }
        } else if (typeof body === 'string') {
            finalBody = body;
            if (!headers.has('Content-Type')) {
                headers.set('Content-Type', 'application/json');
            }
        } else {
            finalBody = body as BodyInit;
        }
    }

    const res = await fetch(url, {
        ...restOptions,
        headers,
        body: finalBody,
    });

    if (res.status === 401) {
        localStorage.removeItem('mgmt_token');
        localStorage.removeItem('mgmt_user');
        window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));

        let errorMsg = 'Sesión expirada o no autorizada';
        try {
            const data = await res.json();
            if (data?.error) errorMsg = data.error;
        } catch {
            // Ignored if response has no JSON body
        }
        throw new Error(errorMsg);
    }

    if (!res.ok) {
        let errorMsg = `Error ${res.status}: ${res.statusText}`;
        try {
            const data = await res.json();
            if (data?.error) errorMsg = data.error;
            else if (data?.message) errorMsg = data.message;
        } catch {
            // Ignored if response has no JSON body
        }
        throw new Error(errorMsg);
    }

    if (res.status === 204) {
        return undefined as unknown as T;
    }

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        return await res.json();
    }

    return (await res.text()) as unknown as T;
}
