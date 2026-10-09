import { ApiError } from "./api-error";
import { useAuthStore } from "@/store/auth.store";
import { refreshAccessToken } from "./session-refresh";

export type UploadProgressCallback = (percent: number) => void;

interface ImageUploadPayload {
  url: string;
}

function readErrorMessage(xhr: XMLHttpRequest): string {
  try {
    const body = JSON.parse(xhr.responseText) as {
      message?: string | string[];
    };
    if (typeof body.message === "string") return body.message;
    if (Array.isArray(body.message)) return body.message.join(", ");
  } catch {
    // Si el cuerpo no es JSON, queda el statusText como mensaje.
  }
  return xhr.statusText || "Error al subir la imagen";
}

function sendImage(
  token: string,
  file: File,
  onProgress?: UploadProgressCallback,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/uploads/image");
    xhr.withCredentials = true;
    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    }
    if (onProgress && typeof xhr.upload !== "undefined") {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const payload = JSON.parse(xhr.responseText) as ImageUploadPayload;
          resolve(payload.url);
        } catch {
          reject(new ApiError(xhr.status, "Respuesta inválida del servidor"));
        }
        return;
      }
      reject(new ApiError(xhr.status, readErrorMessage(xhr)));
    };
    xhr.onerror = () =>
      reject(new ApiError(0, "Error de red al subir la imagen"));
    xhr.send(formData);
  });
}

/**
 * Sube una imagen a `/api/uploads/image` y devuelve la URL pública.
 *
 * Usa XHR en vez de `fetch` para exponer el progreso real de subida
 * (`upload.onprogress`). Maneja un 401 rotando el access token una vez, igual
 * que `http.ts`.
 */
export async function uploadImageFile(
  file: File,
  onProgress?: UploadProgressCallback,
): Promise<string> {
  const token = useAuthStore.getState().getAccessToken();
  try {
    return await sendImage(token ?? "", file, onProgress);
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status === 401 &&
      useAuthStore.getState().hasSession()
    ) {
      const fresh = await refreshAccessToken();
      return sendImage(fresh, file, onProgress);
    }
    throw error;
  }
}
