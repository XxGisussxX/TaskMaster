import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL es requerida"),
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
  API_ORIGINS: z.string().default("*"),
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
  return parsed.data;
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
