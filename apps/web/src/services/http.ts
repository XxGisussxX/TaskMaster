import { useAuthStore } from "@/store/auth.store";
import { refreshAccessToken } from "./session-refresh";
import { ApiError } from "./api-error";

export { ApiError };

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const accessToken = useAuthStore.getState().getAccessToken();
  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(!isFormData && { "Content-Type": "application/json" }),
    ...(options.headers as Record<string, string> | undefined),
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  // `credentials` va dentro de `init` y no en la llamada a `fetch` para que el
  // reintento post-refresh lo herede: la cookie `tm_refresh` es la que permite
  // renovar la sesión y vive en el request, no en un header.
  const init: RequestInit = { ...options, headers, credentials: "include" };

  let res = await fetch(`/api${path}`, init);

  if (res.status === 401 && useAuthStore.getState().hasSession()) {
    let token: string;
    try {
      token = await refreshAccessToken();
    } catch {
      throw new ApiError(401, "Sesión expirada");
    }
    headers.Authorization = `Bearer ${token}`;
    res = await fetch(`/api${path}`, { ...init, headers });
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
