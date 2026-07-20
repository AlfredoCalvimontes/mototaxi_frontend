/**
 * The single fetch wrapper every request goes through.
 *
 * Auth rides on httpOnly cookies (`credentials: 'include'`), so no token ever
 * touches JS or `localStorage`. On a 401 the client attempts exactly one silent
 * refresh and replays the original request; a failed refresh is terminal and
 * ends the session. There is no retry loop by construction — the refresh call
 * itself is excluded from the 401 handling.
 */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

export class ApiError extends Error {
  readonly status: number;
  readonly detail: string | null;
  readonly body: unknown;

  constructor(status: number, detail: string | null, body: unknown) {
    super(detail ?? `HTTP ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
    this.body = body;
  }

  /** The trip/customer changed under us between render and click. */
  get isConflict() {
    return this.status === 409;
  }

  get isNotFound() {
    return this.status === 404;
  }

  /** Failed validation — the form, not the network. */
  get isValidation() {
    return this.status === 422;
  }

  get isUnauthorized() {
    return this.status === 401;
  }
}

/** Raised when the network never produced a response at all. */
export class NetworkError extends Error {
  constructor(cause: unknown) {
    super('No se pudo conectar con el servidor');
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

type SessionExpiredListener = () => void;

let onSessionExpired: SessionExpiredListener | null = null;

/** Registered by `AuthProvider`; called once a refresh has definitively failed. */
export function setSessionExpiredHandler(listener: SessionExpiredListener | null) {
  onSessionExpired = listener;
}

export type RequestOptions = {
  method?: string;
  /** Serialised as JSON. Use `form` for the OAuth2 login endpoint instead. */
  json?: unknown;
  form?: Record<string, string>;
  query?: Record<string, string | number | boolean | null | undefined>;
  signal?: AbortSignal;
  /** Internal: suppresses the refresh-and-replay dance. */
  skipAuthRefresh?: boolean;
  /** Return the raw `Response` instead of parsing (CSV download). */
  raw?: boolean;
};

function buildUrl(path: string, query: RequestOptions['query']): string {
  const url = `${API_BASE_URL}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

/**
 * FastAPI puts the message in `detail`, which is a string for `HTTPException`
 * and a list of field errors for a 422.
 */
function extractDetail(body: unknown): string | null {
  if (typeof body === 'string' && body) return body;
  if (!body || typeof body !== 'object') return null;
  const detail = (body as { detail?: unknown }).detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => (item && typeof item === 'object' ? (item as { msg?: unknown }).msg : null))
      .filter((msg): msg is string => typeof msg === 'string');
    if (messages.length) return messages.join('; ');
  }
  return null;
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function rawRequest(path: string, options: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  let body: BodyInit | undefined;

  if (options.form) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = new URLSearchParams(options.form).toString();
  } else if (options.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.json);
  }

  try {
    return await fetch(buildUrl(path, options.query), {
      method: options.method ?? 'GET',
      credentials: 'include',
      headers,
      body,
      signal: options.signal,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw new NetworkError(cause);
  }
}

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Refreshes the cookie pair. Concurrent 401s share one in-flight call, so a
 * dashboard with five parallel polls does not fire five refreshes.
 */
function refreshSession(): Promise<boolean> {
  refreshInFlight ??= (async () => {
    try {
      // The body is required by the endpoint even when the token comes from
      // the cookie: an absent body is a 422, not a fallback.
      const response = await rawRequest('/users/refresh', {
        method: 'POST',
        json: {},
        skipAuthRefresh: true,
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      // Cleared on the next tick so callers awaiting this promise all observe
      // the same result before a new attempt can start.
      queueMicrotask(() => {
        refreshInFlight = null;
      });
    }
  })();
  return refreshInFlight;
}

/** Test seam: drops any in-flight refresh between cases. */
export function resetAuthRefreshState() {
  refreshInFlight = null;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response = await rawRequest(path, options);

  if (response.status === 401 && !options.skipAuthRefresh) {
    const refreshed = await refreshSession();
    if (refreshed) {
      response = await rawRequest(path, { ...options, skipAuthRefresh: true });
    }
    if (!refreshed || response.status === 401) {
      onSessionExpired?.();
      const body = await parseBody(response);
      throw new ApiError(401, extractDetail(body) ?? 'Sesión expirada', body);
    }
  }

  if (!response.ok) {
    const body = await parseBody(response);
    throw new ApiError(response.status, extractDetail(body), body);
  }

  if (options.raw) return response as unknown as T;
  return (await parseBody(response)) as T;
}
