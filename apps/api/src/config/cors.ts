/**
 * CORS compartido entre la API HTTP (main.ts) y el gateway de Socket.io.
 *
 * El decorador `@WsGateway` se evalúa al importar el módulo, antes de que
 * ConfigModule valide el entorno, así que esto no puede depender de inyección.
 * Por eso el fail-closed se aplica también acá y no solo en main.ts.
 */

export interface CorsOptions {
  origin: string[] | boolean;
  credentials: boolean;
}

export function parseOrigins(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Resuelve la configuración de CORS a partir de API_ORIGINS.
 *
 * Sin origins configurados devuelve `origin: true` (Cualquiera) porque en
 * desarrollo el frontend puede venir de cualquier puerto de Vite. Ese valor es
 * exactamente el que no debe llegar a producción, y por eso `assertProductionSafe`
 * se llama igual en todos los casos.
 */
export function resolveCorsOptions(
  raw: string | undefined,
  nodeEnv: string | undefined,
): CorsOptions {
  const origins = parseOrigins(raw);
  const allowAll = origins.length === 0 || origins.includes("*");

  if (allowAll && nodeEnv === "production") {
    throw new Error(
      "CORS abierto no permitido en producción: definí API_ORIGINS con los dominios permitidos",
    );
  }

  return {
    origin: allowAll ? true : origins,
    credentials: !allowAll,
  };
}
