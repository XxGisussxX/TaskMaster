import {
  oauthCallbackErrorSchema,
  type OauthErrorCode,
} from "@taskmaster/contracts";

/**
 * Lectura de la URL a la que vuelve el backend tras el login con Google.
 *
 * Va aparte de la página a propósito: es lógica pura, sin React ni router, y es
 * justamente donde un error se traduce en dejar al usuario en un loader eterno o
 * en una pantalla en blanco. Testearla no requiere montar nada.
 *
 * Se parsea el `search` crudo en vez de usar `useSearchParams` para que los tests
 * puedan ejercitarla sin un router.
 */
export type OauthCallbackOutcome =
  /** Hay token de handoff: hay que canjearlo. */
  | { kind: "exchange"; token: string }
  /** El backend devolvió un error con un código conocido. */
  | { kind: "error"; code: OauthErrorCode }
  /** Algo no reconocido: ni token ni código de error. */
  | { kind: "unknown" };

export function readOauthCallback(search: string): OauthCallbackOutcome {
  const params = new URLSearchParams(search);

  const error = params.get("error");
  if (error !== null) {
    const parsed = oauthCallbackErrorSchema.safeParse({ error });
    // Un código desconocido se degrada a un error genérico en vez de ignorarse:
    // ignorarlo dejaría la página esperando un token que nunca va a llegar.
    return parsed.success
      ? { kind: "error", code: parsed.data.error }
      : { kind: "error", code: "exchange_failed" };
  }

  const token = params.get("token");
  // Un token vacío cuenta como ausente: `?token=` sin valor significa que el
  // backend construyó la URL mal, no que haya un token de longitud cero.
  if (token !== null && token.length > 0) {
    return { kind: "exchange", token };
  }

  return { kind: "unknown" };
}
