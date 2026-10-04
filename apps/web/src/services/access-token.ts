/**
 * Lectura del `exp` del access token para decidir si conviene renovarlo antes de
 * gastar una request.
 *
 * Esto no es verificación de firma: el servidor sigue validando el token en
 * cada request y es el único que puede rechazarlo. Acá solo se mira el claim
 * para no pegarle a `/auth/refresh` en cada arranque de página: una decisión
 * equivocada cuesta, en el peor caso, un 401 que el propio `http` sabe
 * recuperar por su cuenta.
 */

const CLOCK_SKEW_MS = 60_000;

function decodeBase64Url(segment: string): string | null {
  try {
    const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padding = (4 - (normalized.length % 4)) % 4;
    const binary = atob(normalized.padEnd(normalized.length + padding, "="));
    // `atob` devuelve latin1: hay que rearmar los bytes como UTF-8 antes de
    // pasarle el string a `JSON.parse`.
    const percentEncoded = Array.from(
      binary,
      (char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`,
    ).join("");
    return decodeURIComponent(percentEncoded);
  } catch {
    return null;
  }
}

/** `exp` del access token en milisegundos, o `null` si no se puede leer. */
export function accessTokenExpiresAt(
  token: string | null | undefined,
): number | null {
  if (!token) return null;
  const segments = token.split(".");
  if (segments.length !== 3) return null;
  const payload = decodeBase64Url(segments[1]!);
  if (!payload) return null;
  try {
    const parsed = JSON.parse(payload) as { exp?: unknown };
    return typeof parsed.exp === "number" ? parsed.exp * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * `true` si el access token no sirve o está tan cerca de expirar que conviene
 * renovarlo ya. Un token ilegible cuenta como "hay que renovar": el refresh es
 * la única forma de averiguarlo.
 */
export function shouldRefreshAccessToken(
  token: string | null | undefined,
  skewMs: number = CLOCK_SKEW_MS,
): boolean {
  const expiresAt = accessTokenExpiresAt(token);
  if (expiresAt === null) return true;
  return expiresAt - skewMs <= Date.now();
}
