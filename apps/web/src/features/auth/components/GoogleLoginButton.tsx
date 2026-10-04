import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getOauthProviders, startGoogleLogin } from "../api/auth.api";

/** El "G" de Google. Los cuatro colores son parte de la marca. */
function GoogleLogo() {
  return (
    <svg viewBox="0 0 18 18" className="size-4" aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

/**
 * Si Google está disponible se resuelve una sola vez por sesión de la app.
 *
 * Login y Register se montan en navegaciones distintas, así que sin este caché
 * cada ida y vuelta pegaría `/auth/oauth/providers`. Además el resultado casi no
 * cambia durante la vida del proceso: son credenciales del servidor.
 */
let providersPromise: Promise<string[]> | null = null;

function loadProviders(): Promise<string[]> {
  providersPromise ??= getOauthProviders().catch(() => []);
  return providersPromise;
}

/**
 * Botón de login con Google.
 *
 * Se oculta por completo cuando el backend no tiene Google configurado, en vez
 * de mostrarse deshabilitado: un botón que no se puede usar ocupa espacio y
 * genera la sensación de que la app está rota. La configuración vive en un solo
 * lugar, el servidor, así que el frontend no puede desincronizarse de ella.
 */
export function GoogleLoginButton({ label }: { label: string }) {
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    void loadProviders().then((providers) => {
      if (alive) setAvailable(providers.includes("google"));
    });
    return () => {
      alive = false;
    };
  }, []);

  // `null` = todavía consultando. Se reserva el espacio con un placeholder
  // invisible para que la página no salte cuando se determina la disponibilidad.
  if (available !== true) {
    return <div className="h-0" aria-hidden />;
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">o</span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={startGoogleLogin}
      >
        <GoogleLogo />
        {label}
      </Button>
    </div>
  );
}
