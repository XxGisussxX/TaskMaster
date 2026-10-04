import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL es requerida"),
  REDIS_HOST: z.string().min(1).default("localhost"),
  REDIS_PORT: z.coerce.number().int().min(1).max(65535).default(6379),
  REDIS_PASSWORD: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().optional(),
  ),
  REDIS_DB: z.coerce.number().int().min(0).default(0),
  REDIS_KEY_PREFIX: z.string().min(1).default("taskmaster"),
  JWT_ACCESS_SECRET: z
    .string()
    .regex(
      /^(?=.*[a-zA-Z])(?=.*\d)/,
      "JWT_ACCESS_SECRET debe combinar letras y números",
    )
    .refine((value) => new Set(value).size >= 8, {
      message:
        "JWT_ACCESS_SECRET tiene muy poca entropía (demasiados caracteres repetidos)",
    })
    .refine(
      (value) =>
        ![
          "dev-access-secret-change-me",
          "change-me-access-secret",
          "secret",
          "changeme",
        ].some((p) => value.toLowerCase().includes(p)),
      {
        message:
          "JWT_ACCESS_SECRET no puede usar placeholders (generá uno con: openssl rand -base64 32)",
      },
    ),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("30d"),
  API_ORIGINS: z.string().default(""),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  LOGIN_MAX_FAILURES: z.coerce.number().int().min(1).default(5),
  LOGIN_FAIL_WINDOW_SECONDS: z.coerce.number().int().min(1).default(900),
  LOGIN_LOCK_SECONDS: z.coerce.number().int().min(1).default(900),
  WEB_URL: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z
      .string()
      .url("WEB_URL debe ser una URL válida")
      .default("http://localhost:5173"),
  ),
  RESEND_API_KEY: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().optional(),
  ),
  MAIL_FROM: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().optional(),
  ),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  GEMINI_API_KEY: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().optional(),
  ),
  GEMINI_MODEL: z.string().default("gemini-3.6-flash"),
  GEMINI_EMBEDDING_MODEL: z.string().default("text-embedding-004"),
  GEMINI_DAILY_LIMIT: z.coerce.number().int().positive().default(15),
  // Google OAuth es opcional y entero: los tres se configuran juntos o ninguno.
  // La regla cruzada que lo fuerza está en `oauthRules`.
  GOOGLE_CLIENT_ID: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().optional(),
  ),
  GOOGLE_CLIENT_SECRET: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().optional(),
  ),
  GOOGLE_REDIRECT_URI: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().url("GOOGLE_REDIRECT_URI debe ser una URL válida").optional(),
  ),
});

/**
 * Google OAuth se activa solo si están las tres piezas.
 *
 * Medio configurado es peor que no configurado: el botón aparece, el usuario
 * llega a la pantalla de consentimiento de Google y solo después se le dice que
 * algo falla. Conviene refuse to start.
 */
const oauthRules = z
  .object({
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GOOGLE_REDIRECT_URI: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    const present = [
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      env.GOOGLE_REDIRECT_URI,
    ].filter((value) => value !== undefined);

    if (present.length === 0 || present.length === 3) return;

    const missing = [
      ["GOOGLE_CLIENT_ID", env.GOOGLE_CLIENT_ID],
      ["GOOGLE_CLIENT_SECRET", env.GOOGLE_CLIENT_SECRET],
      ["GOOGLE_REDIRECT_URI", env.GOOGLE_REDIRECT_URI],
    ]
      .filter(([, value]) => value === undefined)
      .map(([name]) => name);

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["GOOGLE_CLIENT_ID"],
      message: `Google OAuth está a medio configurar. Faltan: ${missing.join(", ")}. Dejalo completo o vacialo: con la mitad, el login con Google llega a Google y recién ahí falla.`,
    });
  });

/**
 * Reglas que dependen del entorno y no se pueden expresar con el tipo del campo.
 *
 * En producción la API nunca debe aceptar cualquier origin: `/auth/login` y
 * `/workspaces/invites/:token` son endpoints públicos y con CORS abierto cualquier
 * sitio puede leer sus respuestas. Preferimos fallar al arrancar antes que exponerlo.
 */
const productionRules = z
  .object({
    NODE_ENV: z.string(),
    API_ORIGINS: z.string(),
    TRUST_PROXY: z.coerce.number().int().min(0),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== "production") return;

    const origins = env.API_ORIGINS.split(",")
      .map((o) => o.trim())
      .filter(Boolean);

    if (origins.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["API_ORIGINS"],
        message:
          "API_ORIGINS es obligatoria en producción. Lista los dominios separados por coma (ej: https://app.taskmaster.app)",
      });
      return;
    }

    if (origins.includes("*")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["API_ORIGINS"],
        message:
          "API_ORIGINS no puede ser '*' en producción: habilitaría CORS abierto sobre /auth/login y /workspaces/invites/:token",
      });
    }

    const insecure = origins.filter(
      (o) => o !== "*" && !o.startsWith("https://"),
    );
    if (insecure.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["API_ORIGINS"],
        message: `API_ORIGINS debe usar https en producción. Inseguro(s): ${insecure.join(", ")}`,
      });
    }

    if (env.TRUST_PROXY === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["TRUST_PROXY"],
        message:
          "TRUST_PROXY debe ser >= 1 en producción (ej: 1 si hay un reverse proxy como Caddy). Sin esto, el rate limit ve la IP del proxy y no la del cliente real.",
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join(", ");
    throw new Error(`Configuración de entorno inválida: ${issues}`);
  }

  const crossField = productionRules.safeParse({
    NODE_ENV: parsed.data.NODE_ENV,
    API_ORIGINS: parsed.data.API_ORIGINS,
    TRUST_PROXY: parsed.data.TRUST_PROXY,
  });
  if (!crossField.success) {
    const issues = crossField.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join(", ");
    throw new Error(`Configuración de entorno inválida: ${issues}`);
  }

  const oauth = oauthRules.safeParse({
    GOOGLE_CLIENT_ID: parsed.data.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: parsed.data.GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI: parsed.data.GOOGLE_REDIRECT_URI,
  });
  if (!oauth.success) {
    const issues = oauth.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join(", ");
    throw new Error(`Configuración de entorno inválida: ${issues}`);
  }

  return parsed.data;
}

/**
 * Si el login con Google está operativo.
 *
 * Los tres campos son opcionales, así que la respuesta se deriva de que estén
 * todos: es lo que decide si la web dibuja el botón y si `/auth/oauth/google/*`
 * responde o dice que no está configurado.
 */
export function isGoogleOAuthConfigured(
  config: Record<string, unknown>,
): boolean {
  return Boolean(
    config.GOOGLE_CLIENT_ID &&
    config.GOOGLE_CLIENT_SECRET &&
    config.GOOGLE_REDIRECT_URI,
  );
}

export const jwtConstants = {
  accessSecret: () =>
    process.env.JWT_ACCESS_SECRET ??
    (() => {
      throw new Error(
        "JWT_ACCESS_SECRET no está definido (generá uno con: openssl rand -base64 32)",
      );
    })(),
  accessTtl: () => process.env.JWT_ACCESS_TTL ?? "15m",
  refreshTtl: () => process.env.JWT_REFRESH_TTL ?? "30d",
};

export function parseDurationToSeconds(ttl: string): number {
  const match = /^(\d+)([smhd])$/.exec(ttl);
  if (!match) return 900;
  const val = Number(match[1]);
  switch (match[2]) {
    case "s":
      return val;
    case "m":
      return val * 60;
    case "h":
      return val * 3600;
    case "d":
      return val * 86400;
    default:
      return 900;
  }
}
