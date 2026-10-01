import type { AuthSessionResponse } from "@taskmaster/contracts";
import { useAuthStore } from "@/store/auth.store";

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

let refreshing: Promise<string> | null = null;

/**
 * El refresh token va en una cookie HttpOnly, así que acá no hay nada que
 * mandar: el navegador la adjunta solo. `credentials: "include"` es explícito
 * porque la misma función se usaría contra un origen distinto de la API.
 */
async function refreshAccessToken(): Promise<string> {
  const res = await fetch("/api/auth/refresh", {
    method: "POST",
    credentials: "include",
  });

  if (!res.ok) {
    useAuthStore.getState().clear();
    throw new ApiError(401, "Sesión expirada");
  }

  const session = (await res.json()) as AuthSessionResponse;
  useAuthStore.getState().setSession(session);
  return session.accessToken;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const accessToken = useAuthStore.getState().getAccessToken();
  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(!isFormData && { "Content-Type": "application/json" }),
    ...(options.headers as Record<string, string> | undefined),
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let res = await fetch(`/api${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (res.status === 401 && useAuthStore.getState().hasSession()) {
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

  try {
    return (await res.json()) as T;
  } catch {
    return undefined as T;
  }
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
  upload: <T>(path: string, formData: FormData) =>
    request<T>(path, { method: "POST", body: formData }),
};
