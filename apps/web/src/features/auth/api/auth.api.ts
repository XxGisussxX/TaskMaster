import type {
  AuthSessionResponse,
  OauthProvider,
  OauthProvidersResponse,
} from "@taskmaster/contracts";
import { http } from "@/services/http";
import { useAuthStore } from "@/store/auth.store";
import { usersApi } from "@/features/users/api/users.api";

/**
 * URL del backend para arrancar el flujo.
 *
 * Relativa a propósito, igual que todas las demás llamadas (`http.ts` usa
 * `/api${path}` y el proxy de Vite resuelve). No por estilo: el navegador guarda
 * la cookie `tm_oauth_state` en el origen con el que hablado, y Google vuelve a
 * `GOOGLE_REDIRECT_URI`. Si el botón apuntara al puerto de la API y el redirect
 * volviera al puerto del front (o al revés), la cookie se guardaría en un origen
 * y se buscaría en otro, y el callback siempre daría `invalid_state`.
 *
 * Con todo en el mismo origen, la cookie que se setea en `authorize` es
 * exactamente la que vuelve en `callback`.
 */
function oauthAuthorizeUrl(provider: OauthProvider): string {
  return `/api/auth/oauth/${provider}/authorize`;
}

export async function getOauthProviders(): Promise<OauthProvider[]> {
  const { providers } = await http.get<OauthProvidersResponse>(
    "/auth/oauth/providers",
  );
  return providers;
}

/** Manda al navegador al consentimiento de Google. No hay fallback posible. */
export function startGoogleLogin(): void {
  window.location.href = oauthAuthorizeUrl("google");
}

/**
 * Canjea el token de handoff por la sesión.
 *
 * Devuelve `false` en vez de propagar el error para que la página de callback
 * pueda distinguir "el token no sirvió" de "la sesión se established pero algo
 * después falló": el store ya queda seteado en el camino feliz.
 */
export async function exchangeOauthToken(token: string): Promise<boolean> {
  try {
    const session = await http.post<AuthSessionResponse>(
      "/auth/oauth/exchange",
      { token },
    );
    useAuthStore.getState().setSession(session);
    return true;
  } catch {
    useAuthStore.getState().clear();
    return false;
  }
}

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
    // Siempre se golpea el endpoint, incluso sin sesión en el store: la cookie
    // `tm_refresh` es HttpOnly y sobrevive a un cierre de sesión que falló a
    // mitad de camino, así que llamarlo es la única forma de revocarla y
    // borrarla. El endpoint es `@Public()` justamente para que una sesión con
    // el access token vencido también pueda cerrarse.
    await http.post("/auth/logout");
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
