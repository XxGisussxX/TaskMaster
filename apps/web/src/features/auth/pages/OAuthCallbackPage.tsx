import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import type { OauthErrorCode } from "@taskmaster/contracts";
import { exchangeOauthToken } from "../api/auth.api";
import { readOauthCallback } from "../oauthCallback";

/**
 * Textos de error del callback.
 *
 * Vive en el frontend a propósito: el backend redirige con un código de un enum
 * cerrado, no con un mensaje. Así el texto se puede traducir y, sobre todo, se
 * evita que algo controlado por el exterior termine renderizado en la pantalla.
 */
const ERROR_MESSAGES: Record<OauthErrorCode, string> = {
  access_denied: "Cancelaste el acceso a tu cuenta de Google.",
  invalid_state:
    "La sesión de acceso no es válida o caducó. Volvé a intentarlo desde la pantalla de login.",
  provider_error: "Google no devolvió una autorización válida.",
  exchange_failed: "No pudimos completar el acceso con Google. Probá de nuevo.",
  email_unverified:
    "Tu email de Google no está verificado. Verificalo en Google e intentá otra vez.",
  account_conflict:
    "Ese email ya está vinculado a otra cuenta de Google. Iniciá sesión con la que usaste la primera vez.",
  not_configured: "El acceso con Google no está habilitado en este entorno.",
};

/**
 * Punto de retorno del login con Google.
 *
 * El backend deja un token de un solo uso en la URL y esta página lo canjea por
 * la sesión con un POST. El token se borra de la barra de direcciones apenas se
 * canjea, con `replace`, para que no quede en el historial ni en el botón
 * "atrás" del navegador.
 */
export function OAuthCallbackPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState<OauthErrorCode | null>(null);

  const outcome = useMemo(
    () => readOauthCallback(location.search),
    [location.search],
  );

  // `useEffect` con dependencia del token: si el usuario recarga la página, el
  // token de la URL ya se gastó y hay que mostrar el error, no reintentar el
  // canje. El ref evita un doble canje por el doble mount de React 18 en
  // desarrollo, que en producción sería dos tokens quemados por un clic.
  const exchanged = useRef(false);

  useEffect(() => {
    if (outcome.kind === "error") {
      setError(outcome.code);
      return;
    }

    if (outcome.kind === "unknown") {
      setError("provider_error");
      return;
    }
    if (exchanged.current) return;
    exchanged.current = true;

    void (async () => {
      const ok = await exchangeOauthToken(outcome.token);
      // `replace` en vez de `push`: el token no debe quedar en el historial.
      void navigate(ok ? "/" : "/login", { replace: true });
      if (!ok) setError("exchange_failed");
    })();
  }, [outcome, navigate]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
        <h1 className="text-xl font-semibold">No pudimos iniciar sesión</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {ERROR_MESSAGES[error]}
        </p>
        <Link
          to="/login"
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          Volver a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3">
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Completando el acceso…</p>
    </div>
  );
}
