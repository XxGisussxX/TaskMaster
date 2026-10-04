import { z } from "zod";

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(80),
  email: z.string().trim().toLowerCase().email("Email inválido"),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .max(128),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email inválido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

// El refresh token no tiene schema a propósito: viaja en una cookie HttpOnly.
// Aceptarlo en el body dejaría el endpoint de refresh accesible a cualquier
// script de la página, que es justo lo que la cookie evita.

export const verifyEmailSchema = z.object({
  token: z.string().min(1, "Token requerido"),
});

export const resendVerificationSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email inválido"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email inválido"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token requerido"),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .max(128),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .max(128),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  avatarUrl: z.string().url().or(z.literal("")).nullable().optional(),
});

export const updateUserSettingsSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  language: z.string().min(2).max(10).optional(),
  defaultView: z.string().min(1).optional(),
  weeklyDigest: z.boolean().optional(),
  timezone: z.string().min(1).optional(),
  emailPrefs: z.record(z.boolean()).optional(),
});

// ── OAuth ─────────────────────────────────────────────────────────────

/**
 * Proveedores de login federado disponibles.
 *
 * El frontend lo consulta para no dibujar un botón que después falla: si el
 * backend no tiene las credenciales de Google, el botón no aparece y el usuario
 * no pierde tiempo en una pantalla de consentimiento que va a morir en el
 * callback.
 */
export const OAUTH_PROVIDERS = ["google"] as const;
export type OauthProvider = (typeof OAUTH_PROVIDERS)[number];

export interface OauthProvidersResponse {
  providers: OauthProvider[];
}

/**
 * Canje del token de handoff por una sesión.
 *
 * Solo viaja el token. El `code` de Google no se reenvía porque para entonces ya
 * se canjeó server-side, y el `state` ya se validó contra la cookie en el
 * callback: volver a mandarlo no agrega nada y abre la puerta a meterlo en el
 * body por error.
 */
export const oauthExchangeSchema = z.object({
  token: z.string().min(1, "Token requerido"),
});
export type OauthExchangeInput = z.infer<typeof oauthExchangeSchema>;

/**
 * Códigos de error que el callback de OAuth puede devolver por query string.
 *
 * Se mapean a un enum cerrado en vez de pasar texto libre a la UI: el callback
 * redirige con `?error=`, y el mensaje se decide en el frontend para poder
 * traducirlo sin que el server mande HTML a una URL.
 */
export const OAUTH_ERROR_CODES = [
  "access_denied",
  "invalid_state",
  "provider_error",
  "exchange_failed",
  "email_unverified",
  "account_conflict",
  "not_configured",
] as const;
export type OauthErrorCode = (typeof OAUTH_ERROR_CODES)[number];

export const oauthCallbackErrorSchema = z.object({
  error: z.enum(OAUTH_ERROR_CODES),
});
export type OauthCallbackErrorInput = z.infer<typeof oauthCallbackErrorSchema>;

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateUserSettingsInput = z.infer<typeof updateUserSettingsSchema>;

/** Resultado de acciones que confirman éxito sin datos adicionales. */
export interface AuthActionResult {
  success: true;
}

/** Resultado de envío de emails transaccionales. */
export interface EmailDeliveryResult {
  sent: boolean;
}
