import type { AuthSessionResponse } from "@taskmaster/contracts";
import { http } from "@/services/http";
import { useAuthStore } from "@/store/auth.store";
import { usersApi } from "@/features/users/api/users.api";

export async function login(input: {
  email: string;
  password: string;
}): Promise<void> {
  const session = await http.post<AuthSessionResponse>("/auth/login", input);
  useAuthStore.getState().setSession(session);
}

export async function register(input: {
  name: string;
  email: string;
  password: string;
}): Promise<void> {
  await http.post("/auth/register", input);
}

export async function verifyEmail(token: string): Promise<{ success: true }> {
  return http.post<{ success: true }>("/auth/verify-email", { token });
}

export async function resendVerification(
  email: string,
): Promise<{ sent: boolean }> {
  return http.post<{ sent: boolean }>("/auth/resend-verification", { email });
}

export async function forgotPassword(
  email: string,
): Promise<{ sent: boolean }> {
  return http.post<{ sent: boolean }>("/auth/forgot-password", { email });
}

export async function resetPassword(
  token: string,
  password: string,
): Promise<{ success: true }> {
  return http.post<{ success: true }>("/auth/reset-password", {
    token,
    password,
  });
}

/** Refresca el perfil del usuario en el store (p. ej. tras verificar). */
export async function refreshCurrentUser(): Promise<void> {
  const user = await usersApi.getProfile();
  useAuthStore.getState().setUser(user);
}

export async function logout(): Promise<void> {
  try {
    // Sin cuerpo: el servidor revoca el token de la cookie HttpOnly y la
    // borra. Solo tiene sentido si hay sesión en curso; sin sesión, `http`
    // devolvería 401 y el catch lo terminaría tragando igual.
    if (useAuthStore.getState().hasSession()) {
      await http.post("/auth/logout");
    }
  } catch {
    // El token se revoca igual por expiración o por el cron de limpieza.
  } finally {
    useAuthStore.getState().clear();
  }
}

export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ success: true }> {
  return http.post<{ success: true }>("/auth/change-password", input);
}
