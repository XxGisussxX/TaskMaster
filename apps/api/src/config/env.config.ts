import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL es requerida"),
  JWT_ACCESS_SECRET: z.string().min(8, "JWT_ACCESS_SECRET requerido"),
  JWT_REFRESH_SECRET: z.string().min(8, "JWT_REFRESH_SECRET requerido"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("30d"),
  API_ORIGINS: z.string().default("*"),
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
    process.env.JWT_ACCESS_SECRET ?? "dev-access-secret-change-me",
  refreshSecret: () =>
    process.env.JWT_REFRESH_SECRET ?? "dev-refresh-secret-change-me",
  accessTtl: () => process.env.JWT_ACCESS_TTL ?? "15m",
  refreshTtl: () => process.env.JWT_REFRESH_TTL ?? "30d",
};
