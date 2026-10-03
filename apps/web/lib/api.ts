/** API origin; an empty string means same origin (production behind one reverse proxy). */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const ACCESS = 'lumi.access';
const REFRESH = 'lumi.refresh';

export const tokens = {
  get access() {
    return typeof window === 'undefined' ? null : localStorage.getItem(ACCESS);
  },
  get refresh() {
    return typeof window === 'undefined' ? null : localStorage.getItem(REFRESH);
  },
  set(access: string, refresh: string) {
    localStorage.setItem(ACCESS, access);
    localStorage.setItem(REFRESH, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
  },
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

let refreshing: Promise<boolean> | null = null;

/** Exchanges the refresh token once, shared by concurrent 401s. */
async function refreshTokens(): Promise<boolean> {
  const refreshToken = tokens.refresh;
  if (!refreshToken) return false;
  refreshing ??= fetch(`${API_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  })
    .then(async (res) => {
      if (!res.ok) return false;
      const body = await res.json();
      tokens.set(body.accessToken, body.refreshToken);
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}, retry = true): Promise<T> {
  const res = await fetch(`${API_URL}/api${path}`, {
    method: init.method ?? 'GET',
    headers: {
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(tokens.access ? { Authorization: `Bearer ${tokens.access}` } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });

  if (res.status === 401 && retry && (await refreshTokens())) return api<T>(path, init, false);
  if (res.status === 401) {
    tokens.clear();
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('lumi:logout'));
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = Array.isArray(body.message) ? body.message.join(', ') : (body.message ?? res.statusText);
    throw new ApiError(res.status, message);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const get = <T>(path: string) => api<T>(path);
export const post = <T>(path: string, body?: unknown) => api<T>(path, { method: 'POST', body: body ?? {} });
export const patch = <T>(path: string, body: unknown) => api<T>(path, { method: 'PATCH', body });
export const put = <T>(path: string, body: unknown) => api<T>(path, { method: 'PUT', body });
export const del = <T = void>(path: string) => api<T>(path, { method: 'DELETE' });
