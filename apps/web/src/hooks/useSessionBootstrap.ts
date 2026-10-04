import { useEffect } from "react";
import { useAuthStore } from "@/store/auth.store";
import { shouldRefreshAccessToken } from "@/services/access-token";
import { refreshAccessToken } from "@/services/session-refresh";

/**
 * Decide una sola vez, al arrancar, si la sesión persistida sirve.
 *
 * Sin esto el arranque confabulaba: `localStorage` decía que había usuario,
 * `AppShell` pedía `/workspaces`, el access token estaba vencido, esa query
 * 401 y el handler de `http` intentaba refrescar. Con varias consultas
 * protegidas en vuelo a la vez y `retry: 1` de React Query, eso se multiplicaba
 * en un estallido de 401 seguidos de un refresh que también fallaba, para
 * terminar en la misma pantalla de login. Con el bootstrap hay una decisión,
 * tomada una vez, y como mucho una request.
 *
 * No refresca de más: si el access token vigente alcanza, la cookie se renueva
 * sola más adelante, cuando una request reciba 401.
 */
export function useSessionBootstrap(): void {
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    // `status` arranca en `unknown` y es idempotente: el chequeo se dispara
    // una sola vez, incluso con el doble montaje de `StrictMode`.
    if (!isHydrated || status !== "unknown") return;

    const { user, accessToken } = useAuthStore.getState();

    if (!user) {
      // Nunca hubo sesión en este navegador: no hay cookie que validar.
      useAuthStore.setState({ status: "anonymous" });
      return;
    }

    if (!shouldRefreshAccessToken(accessToken)) {
      useAuthStore.setState({ status: "authenticated" });
      return;
    }

    useAuthStore.getState().beginCheck();
    refreshAccessToken()
      .catch(() => {
        // `rotate` ya limpia la sesión cuando el 401 viene del servidor.
      })
      .finally(() => {
        const state = useAuthStore.getState();
        if (state.status !== "checking") return;
        // Un fallo de red no es una sesión inválida: si el usuario sigue en el
        // store se lo deja pasar y son las queries las que reportan el error, en
        // vez de cerrar la app sobre un problema de conexión.
        useAuthStore.setState({
          status: state.user ? "authenticated" : "anonymous",
        });
      });
  }, [isHydrated, status]);
}
