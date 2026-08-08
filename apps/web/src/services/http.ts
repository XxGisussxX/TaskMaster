import type { AuthSession } from "@taskmaster/contracts";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const TOKEN_KEYS = {
  access: "taskmaster.accessToken",
  refresh: "taskmaster.refreshToken",
};

export const tokenStore = {
  getAccess: () => localStorage.getItem(TOKEN_KEYS.access),
  getRefresh: () => localStorage.getItem(TOKEN_KEYS.refresh),
  setSession: (session: AuthSession) => {
    localStorage.setItem(TOKEN_KEYS.access, session.accessToken);
    localStorage.setItem(TOKEN_KEYS.refresh, session.refreshToken);
  },
  setAccess: (token: string) => localStorage.setItem(TOKEN_KEYS.access, token),
  clear: () => {
    localStorage.removeItem(TOKEN_KEYS.access);
    localStorage.removeItem(TOKEN_KEYS.refresh);
  },
};

let refreshing: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refreshToken = tokenStore.getRefresh();
  if (!refreshToken) throw new ApiError(401, "No session");

  const res = await fetch("/api/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    tokenStore.clear();
    throw new ApiError(401, "Sesión expirada");
  }

  const session = (await res.json()) as AuthSession;
  tokenStore.setSession(session);
  return session.accessToken;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const accessToken = tokenStore.getAccess();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let res = await fetch(`/api${path}`, { ...options, headers });

  if (res.status === 401 && tokenStore.getRefresh()) {
    refreshing = refreshing ?? refreshAccessToken();
    try {
      const token = await refreshing;
      headers.Authorization = `Bearer ${token}`;
      res = await fetch(`/api${path}`, { ...options, headers });
    } catch {
      throw new ApiError(401, "Sesión expirada");
    } finally {
      refreshing = null;
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = body?.message ?? res.statusText;
    throw new ApiError(
      res.status,
      Array.isArray(message) ? message.join(", ") : message,
      body?.code,
    );
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await res.json()) as T;
  }

  return undefined as T;
}

export const http = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body ?? {}) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body ?? {}) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
