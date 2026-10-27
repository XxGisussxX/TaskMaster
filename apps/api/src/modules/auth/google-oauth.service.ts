import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomBytes } from "node:crypto";
import { isGoogleOAuthConfigured } from "../../config/env.config";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Login federado con Google, por authorization code.
 *
 * Por qué no Google Identity Services (el script de JS en el frontend): GIS
 * devuelve un credential al navegador y desde ahí el token de Google existe en
 * la página. Esta implementación mantiene el `code` en el servidor, lo canjea
 * server-to-server contra el token endpoint de Google y solo le devuelve al
 * frontend un token de handoff de un solo uso. El frontend nunca ve un token de
 * Google.
 *
 * El token de handoff existe por el mismo motivo que el refresh token no viaja
 * en la URL: una redirección pone todo en la barra de direcciones, el historial
 * del navegador y potencialmente los logs del proxy. Canjear un token de un solo
 * uso por la sesión en un POST evita por completo que un access token quede
 * registrado en algún log de URL.
 */

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_ENDPOINT =
  "https://openidconnect.googleapis.com/v1/userinfo";

/** El handoff dura poco: es el tiempo que le damos al usuario para canjearlo. */
const HANDOFF_TTL_MS = 2 * 60 * 1000;

export const GOOGLE_PROVIDER = "google";

/** Perfil normalizado de Google. Solo los campos que el producto usa. */
export interface GoogleProfile {
  /** El `sub` de OpenID Connect: identificador estable e inmutable. */
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
}

@Injectable()
export class GoogleOAuthService {
  private readonly logger = new Logger(GoogleOAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  isEnabled(): boolean {
    return isGoogleOAuthConfigured({
      GOOGLE_CLIENT_ID: this.config.get<string>("GOOGLE_CLIENT_ID"),
      GOOGLE_CLIENT_SECRET: this.config.get<string>("GOOGLE_CLIENT_SECRET"),
      GOOGLE_REDIRECT_URI: this.config.get<string>("GOOGLE_REDIRECT_URI"),
    });
  }

  /** Falla ruidosamente si alguien llama el flujo sin credenciales cargadas. */
  private requireConfigured(): void {
    if (!this.isEnabled()) {
      throw new ServiceUnavailableException(
        "El login con Google no está configurado en este entorno",
      );
    }
  }

  /**
   * URL de consentimiento de Google.
   *
   * `prompt=select_account` porque el caso real es la gente que ya está
   * logueada en Google en el mismo navegador y, sin esto, Google la devuelve
   * silenciosamente a la primera cuenta que encuentre en lugar de la que
   * corresponde.
   */
  buildAuthorizeUrl(state: string): string {
    this.requireConfigured();
    const params = new URLSearchParams({
      client_id: this.config.get<string>("GOOGLE_CLIENT_ID")!,
      redirect_uri: this.config.get<string>("GOOGLE_REDIRECT_URI")!,
      response_type: "code",
      scope: "openid email profile",
      state,
      access_type: "online",
      prompt: "select_account",
      // Google muestra "aplicación no verificada" sin esto. La app es de
      // desarrollo: pedir verificación a Google es un trámite aparte.
      include_granted_scopes: "true",
    });
    return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
  }

  /** Canjea el `code` por el perfil del usuario, hablando solo con Google. */
  async fetchProfile(code: string): Promise<GoogleProfile> {
    this.requireConfigured();

    const tokenResponse = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: this.config.get<string>("GOOGLE_CLIENT_ID")!,
        client_secret: this.config.get<string>("GOOGLE_CLIENT_SECRET")!,
        redirect_uri: this.config.get<string>("GOOGLE_REDIRECT_URI")!,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      // El body de Google trae la causa (invalid_grant, redirect_uri mismatch),
      // que es justo lo que hace falta para debuggear, pero no se manda al
      // cliente: el frontend solo necesita saber que falló.
      const detail = await tokenResponse.text().catch(() => "");
      this.logger.error(
        `Google rechazó el canje del code (status=${tokenResponse.status}): ${detail.slice(0, 300)}`,
      );
      throw new UnauthorizedException(
        "No se pudo completar el login con Google",
      );
    }

    const tokens = (await tokenResponse.json()) as { access_token?: string };
    if (!tokens.access_token) {
      throw new UnauthorizedException(
        "No se pudo completar el login con Google",
      );
    }

    const profileResponse = await fetch(GOOGLE_USERINFO_ENDPOINT, {
      headers: { authorization: `Bearer ${tokens.access_token}` },
    });
    if (!profileResponse.ok) {
      this.logger.error(
        `Google no devolvió el perfil (status=${profileResponse.status})`,
      );
      throw new UnauthorizedException(
        "No se pudo completar el login con Google",
      );
    }

    const raw = (await profileResponse.json()) as {
      sub?: unknown;
      email?: unknown;
      email_verified?: unknown;
      name?: unknown;
    };

    if (typeof raw.sub !== "string" || raw.sub.length === 0) {
      throw new UnauthorizedException(
        "Google no devolvió un identificador de usuario",
      );
    }
    if (typeof raw.email !== "string" || raw.email.length === 0) {
      throw new UnauthorizedException("Google no devolvió un email");
    }

    return {
      sub: raw.sub,
      email: raw.email.trim().toLowerCase(),
      // Ojo: `email_verified` puede venir como string "true" según la versión
      // del endpoint. Solo se acepta el booleano real; ante la duda se trata
      // como no verificado, que es la posición segura.
      emailVerified: raw.email_verified === true,
      name: typeof raw.name === "string" ? raw.name.trim() : "",
    };
  }

  /**
   * Resuelve la cuenta local para un perfil de Google, creándola si hace falta.
   *
   * Las reglas que importan, en orden de importancia:
   *
   *  1. Solo se acepta `email_verified === true`. Google permite crear cuentas
   *     con emails sin verificar; aceptar uno permitiría resolver una identidad
   *     que el dominio del email no acredita.
   *  2. Si ya hay una `Account` con ese (provider, sub), es la misma persona:
   *     se reutiliza su usuario, aunque el email de Google haya cambiado.
   *  3. Si no hay `Account` pero hay un `User` con ese email, se vincula. Es el
   *     caso de alguien que ya usaba Taskmaster con contraseña.
   *  4. Si el `User` del email ya está vinculado a *otra* cuenta de Google, se
   *     rechaza: dos identidades federadas sobre el mismo email no se pueden
   *     distinguir, y aceptarlo dejaría que cualquiera con acceso al segundo
   *     Google entre a la cuenta.
   */
  async resolveUser(
    profile: GoogleProfile,
  ): Promise<{ userId: string; created: boolean }> {
    if (!profile.emailVerified) {
      throw new UnauthorizedException(
        "El email de Google no está verificado. Verificalo en Google e intentá de nuevo.",
      );
    }

    const existingAccount = await this.prisma.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: GOOGLE_PROVIDER,
          providerAccountId: profile.sub,
        },
      },
      include: { user: true },
    });

    if (existingAccount) {
      // Misma persona que antes. Se actualiza lo ornamental y no se toca el
      // passwordHash ni el rol.
      await this.prisma.account.update({
        where: { id: existingAccount.id },
        data: { emailAtLinkTime: profile.email },
      });
      return { userId: existingAccount.userId, created: false };
    }

    const userByEmail = await this.prisma.user.findUnique({
      where: { email: profile.email },
      include: { accounts: true },
    });

    if (userByEmail) {
      const alreadyLinked = userByEmail.accounts.some(
        (account) => account.provider === GOOGLE_PROVIDER,
      );
      if (alreadyLinked) {
        throw new ConflictException(
          "Esta cuenta ya está vinculada a otra cuenta de Google. Iniciá sesión con esa.",
        );
      }

      await this.prisma.account.create({
        data: {
          provider: GOOGLE_PROVIDER,
          providerAccountId: profile.sub,
          emailAtLinkTime: profile.email,
          userId: userByEmail.id,
        },
      });

      // Google ya verificó el email, así que la cuenta local deja de depender
      // del correo de bienvenida. Un usuario que solo usa Google no lo necesita,
      // pero el flag también gates accesos de la API.
      if (!userByEmail.isEmailVerified) {
        await this.prisma.user.update({
          where: { id: userByEmail.id },
          data: { isEmailVerified: true },
        });
      }

      this.logger.log(
        `Cuenta de Google vinculada a una cuenta existente (user=${userByEmail.id})`,
      );
      return { userId: userByEmail.id, created: false };
    }

    const created = await this.prisma.user.create({
      data: {
        // Google a veces no manda `name`. El prefijo del email es mejor que un
        // nombre vacío: es lo único que hay para mostrar en la lista de tareas.
        name: profile.name || profile.email.split("@")[0] || profile.email,
        email: profile.email,
        // Sin contraseña: esta cuenta solo entra por Google. Nullable en el
        // schema justamente para esto.
        passwordHash: null,
        // Deliberadamente sin `avatarUrl`: la foto de Google no se importa. El
        // producto muestra las iniciales por defecto (igual que en el registro
        // con email) y la foto es opt-in desde Ajustes → Perfil.
        isEmailVerified: true,
        settings: { create: {} },
        accounts: {
          create: {
            provider: GOOGLE_PROVIDER,
            providerAccountId: profile.sub,
            emailAtLinkTime: profile.email,
          },
        },
      },
    });

    this.logger.log(`Cuenta creada desde Google (user=${created.id})`);
    return { userId: created.id, created: true };
  }

  /**
   * Crea el token de un solo uso que el frontend canjea por la sesión.
   *
   * Reusa `AuthToken` con el tipo `OAUTH_HANDOFF`: es la misma mecánica de
   * "token en claro por email, hash en la base, `usedAt` lo invalida" que usan
   * verificar email y resetear contraseña.
   */
  async createHandoffToken(userId: string): Promise<string> {
    const token = randomBytes(32).toString("base64url");
    await this.prisma.authToken.create({
      data: {
        userId,
        type: "OAUTH_HANDOFF",
        tokenHash: this.hashToken(token),
        expiresAt: new Date(Date.now() + HANDOFF_TTL_MS),
      },
    });
    return token;
  }

  /**
   * Canjea el token de handoff por el usuario y lo invalida en el mismo paso.
   *
   * El `updateMany` con la condición `usedAt: null` es lo que hace que el canje
   * sea de un solo uso aunque dos requests lleguen con el mismo token: el segundo
   * affected 0 filas y cae en el mismo error que un token inexistente.
   */
  async consumeHandoffToken(token: string): Promise<string> {
    const tokenHash = this.hashToken(token);
    const now = new Date();

    const record = await this.prisma.authToken.findUnique({
      where: { tokenHash },
    });

    if (!record || record.type !== "OAUTH_HANDOFF") {
      throw new BadRequestException("El enlace de acceso no es válido");
    }
    if (record.expiresAt.getTime() < now.getTime()) {
      throw new BadRequestException("El enlace de acceso expiró");
    }

    const consumed = await this.prisma.authToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: now },
    });
    if (consumed.count !== 1) {
      throw new BadRequestException("El enlace de acceso ya fue utilizado");
    }

    return record.userId;
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}
