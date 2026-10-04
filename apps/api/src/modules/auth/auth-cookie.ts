import type { Request, Response } from "express";
import { ConfigService } from "@nestjs/config";
import { jwtConstants, parseDurationToSeconds } from "../../config/env.config";

/**
 * El refresh token viaja en una cookie HttpOnly y no en el cuerpo de la
 * respuesta.
 *
 * Antes vivía en `localStorage`, que es legible por cualquier XSS que se
 * meta en la página. Como dura 30 días, un XSS no compromete una sesión: se
 * lleva la sesión entera, incluidas las sesiones de otros dispositivos, hasta
 * que el usuario lo nota. Con HttpOnly el token no existe para el JavaScript de
 * la página, así que la lectura se vuelve imposible por esa vía.
 *
 * `SameSite=Strict` cubre el CSRF de los dos endpoints que la usan: un POST
 * cross-site no manda la cookie. Sumado a que CORS exige origins explícitos en
 * producción, no hay superficie desde otro origen.
 *
 * `Path=/api/auth` la limita a los dos endpoints que la necesitan, para que no
 * viaje en cada request.
 */

export const REFRESH_COOKIE = "tm_refresh";
const COOKIE_PATH = "/api/auth";

export function refreshCookieMaxAgeSeconds(): number {
  return parseDurationToSeconds(jwtConstants.refreshTtl());
}

export function setRefreshCookie(
  res: Response,
  token: string,
  isProduction: boolean,
): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    // En local el server corre por http, y `Secure` sobre http hace que el
    // navegador descarte la cookie y el refresh falle siempre.
    secure: isProduction,
    sameSite: "strict",
    path: COOKIE_PATH,
    maxAge: refreshCookieMaxAgeSeconds() * 1000,
  });
}

/** Borra la cookie. Mismos atributos que al setear, si no el browser no la saca. */
export function clearRefreshCookie(res: Response, isProduction: boolean): void {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    path: COOKIE_PATH,
  });
}

export function readRefreshCookie(req: Request): string | undefined {
  const raw = (req.cookies as Record<string, string> | undefined)?.[
    REFRESH_COOKIE
  ];
  return typeof raw === "string" && raw.length > 0 ? raw : undefined;
}

/**
 * Saca el refresh token de la respuesta JSON para que no llegue al cliente por
 * ningún otro canal que la cookie.
 */
export function withoutRefreshToken<T extends { refreshToken: string }>(
  session: T,
): Omit<T, "refreshToken"> {
  const { refreshToken: _refreshToken, ...rest } = session;
  return rest;
}

export function isProduction(config: ConfigService): boolean {
  return config.get<string>("NODE_ENV") === "production";
}

// ── OAuth ─────────────────────────────────────────────────────────────

/**
 * Cookie con el `state` del flujo OAuth.
 *
 * `SameSite=Lax` es el trade-off clave del flujo. El callback es una navegación
 * que *vuelve* desde accounts.google.com, y con `Strict` el navegador no manda
 * ninguna cookie en una navegación cross-site de primer nivel: el `state` nunca
 * llegaría y todo login fallaría. `Lax` sí la manda en ese caso, que es el único
 * que hace falta, y sigue bloqueando los POST cross-site, que es de donde sale el
 * CSRF de verdad.
 *
 * El `Path` la acota a `/api/auth` como la del refresh: no tiene por qué viajar
 * en cada request de la API.
 */
export const OAUTH_STATE_COOKIE = "tm_oauth_state";
export const OAUTH_COOKIE_PATH = "/api/auth";

/** Margen para completar el login: Google puede pedir permisos extras. */
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export function readOAuthStateCookie(req: Request): string | undefined {
  const raw = (req.cookies as Record<string, string> | undefined)?.[
    OAUTH_STATE_COOKIE
  ];
  return typeof raw === "string" && raw.length > 0 ? raw : undefined;
}

export function clearOAuthStateCookie(
  res: Response,
  isProduction: boolean,
): void {
  res.clearCookie(OAUTH_STATE_COOKIE, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: OAUTH_COOKIE_PATH,
  });
}
