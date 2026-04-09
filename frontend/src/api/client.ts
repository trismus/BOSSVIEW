import type { AuthResponse } from '../types';

const API_BASE = '/api/v1';

let accessToken: string | null = localStorage.getItem('accessToken');
let refreshToken: string | null = localStorage.getItem('refreshToken');
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

// ============================================
// Token management
// ============================================

export function setTokens(access: string, refresh: string): void {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem('accessToken', access);
  localStorage.setItem('refreshToken', refresh);
}

export function clearTokens(): void {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}

export function getAccessToken(): string | null {
  return accessToken;
}

// ============================================
// Typed error class
// ============================================

export class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }

  /** True for 401/403 errors */
  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }

  /** True for 404 errors */
  get isNotFound(): boolean {
    return this.status === 404;
  }

  /** True for validation errors (400 with VALIDATION_ERROR code) */
  get isValidationError(): boolean {
    return this.status === 400 && this.code === 'VALIDATION_ERROR';
  }

  /** True for 409 conflicts */
  get isConflict(): boolean {
    return this.status === 409;
  }

  /** True for rate limiting (429) */
  get isRateLimited(): boolean {
    return this.status === 429;
  }

  /** True for server errors (5xx) */
  get isServerError(): boolean {
    return this.status >= 500;
  }
}

// ============================================
// Request/Response interceptors
// ============================================

type RequestInterceptor = (config: { path: string; options: RequestInit }) => {
  path: string;
  options: RequestInit;
};
type ResponseInterceptor = (response: Response) => Response | Promise<Response>;
type ErrorInterceptor = (error: ApiClientError) => ApiClientError | Promise<never>;

const requestInterceptors: RequestInterceptor[] = [];
const responseInterceptors: ResponseInterceptor[] = [];
const errorInterceptors: ErrorInterceptor[] = [];

export const interceptors = {
  request: {
    use(fn: RequestInterceptor): () => void {
      requestInterceptors.push(fn);
      return () => {
        const idx = requestInterceptors.indexOf(fn);
        if (idx >= 0) requestInterceptors.splice(idx, 1);
      };
    },
  },
  response: {
    use(fn: ResponseInterceptor): () => void {
      responseInterceptors.push(fn);
      return () => {
        const idx = responseInterceptors.indexOf(fn);
        if (idx >= 0) responseInterceptors.splice(idx, 1);
      };
    },
  },
  error: {
    use(fn: ErrorInterceptor): () => void {
      errorInterceptors.push(fn);
      return () => {
        const idx = errorInterceptors.indexOf(fn);
        if (idx >= 0) errorInterceptors.splice(idx, 1);
      };
    },
  },
};

// ============================================
// Token refresh logic
// ============================================

async function refreshAccessToken(): Promise<boolean> {
  if (!refreshToken) return false;

  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) {
        clearTokens();
        return false;
      }

      const data: AuthResponse = await res.json();
      setTokens(data.accessToken, data.refreshToken);
      return true;
    } catch {
      clearTokens();
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// ============================================
// Core fetch function
// ============================================

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  // Run request interceptors
  let config = { path, options };
  for (const interceptor of requestInterceptors) {
    config = interceptor(config);
  }

  const headers: Record<string, string> = {
    ...((config.options.headers as Record<string, string>) ?? {}),
  };

  // Don't set Content-Type for FormData (browser sets boundary automatically)
  if (!(config.options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  let res = await fetch(`${API_BASE}${config.path}`, {
    ...config.options,
    headers,
  });

  // Auto-refresh on 401
  if (res.status === 401 && refreshToken) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${accessToken}`;
      res = await fetch(`${API_BASE}${config.path}`, {
        ...config.options,
        headers,
      });
    }
  }

  // Run response interceptors
  for (const interceptor of responseInterceptors) {
    res = await interceptor(res);
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({
      error: 'Request failed',
      code: 'UNKNOWN',
    }));

    const apiError = new ApiClientError(
      errorBody.error ?? 'Request failed',
      res.status,
      errorBody.code ?? 'UNKNOWN',
      errorBody.details,
    );

    // Run error interceptors
    for (const interceptor of errorInterceptors) {
      const result = await interceptor(apiError);
      // If interceptor returns a modified error, use it
      if (result instanceof ApiClientError) {
        throw result;
      }
    }

    throw apiError;
  }

  return res.json();
}

// ============================================
// Convenience methods
// ============================================

export const api = {
  get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
    let url = path;
    if (params) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          searchParams.set(key, String(value));
        }
      }
      const qs = searchParams.toString();
      if (qs) url = `${path}?${qs}`;
    }
    return apiFetch<T>(url);
  },

  post<T>(path: string, body?: unknown): Promise<T> {
    return apiFetch<T>(path, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  },

  put<T>(path: string, body?: unknown): Promise<T> {
    return apiFetch<T>(path, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  patch<T>(path: string, body?: unknown): Promise<T> {
    return apiFetch<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  delete<T>(path: string): Promise<T> {
    return apiFetch<T>(path, { method: 'DELETE' });
  },
};
