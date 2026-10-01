import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import {
  WorkspaceRole,
  type AuthActionResult,
  type AuthSession,
  type EmailDeliveryResult,
  type User,
} from "@taskmaster/contracts";
import type { User as PrismaUser } from "@prisma/client";
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: string,
  keylen: number,
) => Promise<Buffer>;
import { PrismaService } from "../../prisma/prisma.service";
import { jwtConstants, parseDurationToSeconds } from "../../config/env.config";
import { MailService } from "../mail/mail.service";
import { LoginLockoutService } from "./login-lockout.service";
import type { JwtPayload } from "./types";

const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

interface RefreshValidation {
  user: PrismaUser;
}

export interface SessionMetadata {
  ip: string;
  device: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    private readonly lockout: LoginLockoutService,
  ) {}

  async register(
    input: {
      name: string;
      email: string;
      password: string;
    },
    metadata: SessionMetadata,
  ): Promise<AuthSession> {
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email },
    });
    if (existing) {
      throw new ConflictException("Ya existe una cuenta con este email");
    }

    const passwordHash = await this.hashPassword(input.password);

    const user = await this.prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        settings: { create: {} },
      },
    });

    await this.createDefaultWorkspace(user.id, user.name);

    try {
      await this.sendVerificationEmail(user);
    } catch (error) {
      this.logger.error(
        `Registro OK pero falló el envío de verificación a ${user.email}: ${String(error)}`,
      );
    }

    return this.issueSession(user, metadata);
  }

  async login(
    input: {
      email: string;
      password: string;
    },
    metadata: SessionMetadata,
  ): Promise<AuthSession> {
    const lockout = this.lockout.check(input.email);
    if (lockout.locked) {
      this.logger.warn(
        `Login bloqueado por lockout (email=${this.maskEmail(input.email)}, ip=${metadata.ip}, retryEn=${lockout.retryAfterSeconds}s)`,
      );
      throw new HttpException(
        `Demasiados intentos. Reintentá en ${lockout.retryAfterSeconds} segundos.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
    });

    // Mismo mensaje y mismo trabajo para "no existe" y "contraseña mala":
    // si divergieran, /auth/login serviría para enumerar qué emails están
    // registrados. Contra un email inexistente igual hasheamos la contraseña
    // para que el tiempo de respuesta no lo delate.
    let ok = false;
    if (user) {
      ok = await this.verifyPassword(input.password, user.passwordHash);
    } else {
      await this.hashPassword(input.password);
    }

    if (!user || !ok) {
      this.lockout.recordFailure(input.email);
      this.logger.warn(
        `Login fallido (email=${this.maskEmail(input.email)}, ip=${metadata.ip}, device=${metadata.device})`,
      );
      throw new UnauthorizedException("Credenciales inválidas");
    }

    this.lockout.recordSuccess(input.email);

    if (!user.isEmailVerified) {
      this.logger.warn(
        `Login sin email verificado (user=${user.id}, ip=${metadata.ip})`,
      );
    }

    return this.issueSession(user, metadata);
  }

  /** Log seguro: conserva el dominio, oculta la parte local. */
  private maskEmail(email: string): string {
    const at = email.lastIndexOf("@");
    if (at <= 0) return "***";
    const domain = email.slice(at);
    const local = email.slice(0, at);
    return `${local[0] ?? "*"}***${domain}`;
  }

  /** Valida un refresh token y devuelve su usuario (usado por el guard). */
  async validateRefreshToken(token: string): Promise<RefreshValidation> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hashToken(token) },
      include: { user: true },
    });

    if (!record) {
      throw new UnauthorizedException("Refresh token inválido");
    }
    if (record.revokedAt) {
      throw new UnauthorizedException("Refresh token revocado");
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException("Refresh token expirado");
    }

    return { user: record.user };
  }

  /** Rota el refresh token: revoca el actual y emite uno nuevo. */
  async rotateRefreshToken(
    token: string,
    metadata: SessionMetadata,
  ): Promise<AuthSession> {
    const tokenHash = this.hashToken(token);

    // Atomic validate + revoke: solo revoca si no fue revocado y no expiró.
    // Si count === 0, otro request ya rotó este token.
    const { count } = await this.prisma.refreshToken.updateMany({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { revokedAt: new Date() },
    });

    if (count === 0) {
      throw new UnauthorizedException("Refresh token inválido o ya utilizado");
    }

    const record = await this.prisma.refreshToken.findUniqueOrThrow({
      where: { tokenHash },
      select: { userId: true },
    });

    const newSession = await this.issueSessionForUser(record.userId, metadata);

    await this.prisma.refreshToken.update({
      where: { tokenHash },
      data: { replacedBy: this.hashToken(newSession.refreshToken) },
    });

    return newSession;
  }

  async refresh(
    token: string,
    metadata: SessionMetadata,
  ): Promise<AuthSession> {
    return this.rotateRefreshToken(token, metadata);
  }

  async logout(token: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string): Promise<User> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    return this.toPublicUser(user);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ success: true }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    const ok = await this.verifyPassword(currentPassword, user.passwordHash);
    if (!ok) {
      throw new BadRequestException("La contraseña actual es incorrecta");
    }

    if (currentPassword === newPassword) {
      throw new BadRequestException(
        "La nueva contraseña debe ser diferente a la actual",
      );
    }

    const passwordHash = await this.hashPassword(newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await this.revokeUserTokens(userId);

    return { success: true };
  }

  /**
   * Revoca todas las sesiones activas (refresh tokens no revocados) de un usuario.
   * Fuente única del criterio de "qué cuenta como sesión activa": reusada por
   * cambio de rol (workspace y sistema) y por cambio de contraseña.
   */
  async revokeUserTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // ── Verificación de email y restablecimiento de contraseña ─────────

  /** Marca el email como verificado consumiendo el token de un solo uso. */
  async verifyEmail(token: string): Promise<AuthActionResult> {
    const record = await this.readAuthToken(token, "EMAIL_VERIFY");
    if (record.isVerified) {
      return { success: true };
    }
    await this.prisma.user.update({
      where: { id: record.userId },
      data: { isEmailVerified: true },
    });
    await this.prisma.authToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
    return { success: true };
  }

  /** Reenvía el email de verificación a un email no verificado. */
  async resendVerification(email: string): Promise<EmailDeliveryResult> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.isEmailVerified) {
      return { sent: false };
    }
    try {
      return await this.sendVerificationEmail(user);
    } catch (error) {
      this.logger.error(
        `No se pudo reenviar la verificación a ${email}: ${String(error)}`,
      );
      return { sent: false };
    }
  }

  /** Genera un token de reset y envía el email (sin enumerar usuarios). */
  async forgotPassword(email: string): Promise<EmailDeliveryResult> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return { sent: false };
    }

    const token = await this.createAuthToken(
      user.id,
      "PASSWORD_RESET",
      PASSWORD_RESET_TTL_MS,
    );

    try {
      return await this.sendResetUrl(user.email, token);
    } catch (error) {
      this.logger.error(
        `No se pudo enviar el reset a ${email}: ${String(error)}`,
      );
      return { sent: false };
    }
  }

  /** Aplica la nueva contraseña consumiendo el token de reset. */
  async resetPassword(
    token: string,
    password: string,
  ): Promise<AuthActionResult> {
    const record = await this.readAuthToken(token, "PASSWORD_RESET");

    const passwordHash = await this.hashPassword(password);
    await this.prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    });

    await this.revokeUserTokens(record.userId);

    await this.prisma.authToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    return { success: true };
  }

  private async sendVerificationEmail(
    user: PrismaUser,
  ): Promise<EmailDeliveryResult> {
    const token = await this.createAuthToken(
      user.id,
      "EMAIL_VERIFY",
      EMAIL_VERIFY_TTL_MS,
    );

    try {
      return await this.sendVerifyUrl(user.email, token);
    } catch (error) {
      this.logger.error(
        `No se pudo enviar la verificación a ${user.email}: ${String(error)}`,
      );
      return { sent: false };
    }
  }

  /** Crea un token de un solo uso y devuelve su valor en claro para el link. */
  private async createAuthToken(
    userId: string,
    type: "EMAIL_VERIFY" | "PASSWORD_RESET",
    ttlMs: number,
  ): Promise<string> {
    const token = randomBytes(32).toString("base64url");
    await this.prisma.authToken.create({
      data: {
        userId,
        type,
        tokenHash: this.hashToken(token),
        expiresAt: new Date(Date.now() + ttlMs),
      },
    });
    return token;
  }

  /**
   * Valida un token de un solo uso sin consumirlo y devuelve su registro.
   * Rechaza tokens inexistentes, ya usados o expirados.
   */
  private async readAuthToken(
    token: string,
    type: "EMAIL_VERIFY" | "PASSWORD_RESET",
  ): Promise<{ id: string; userId: string; isVerified: boolean }> {
    const tokenHash = this.hashToken(token);
    const record = await this.prisma.authToken.findUnique({
      where: { tokenHash },
    });

    if (!record || record.type !== type) {
      throw new BadRequestException("El enlace es inválido o ya no existe");
    }
    if (record.usedAt) {
      throw new BadRequestException("El enlace ya fue utilizado");
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException("El enlace expiró");
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: record.userId },
    });
    return {
      id: record.id,
      userId: record.userId,
      isVerified: user.isEmailVerified,
    };
  }

  private async sendVerifyUrl(
    to: string,
    token: string,
  ): Promise<EmailDeliveryResult> {
    const actionUrl = this.buildAuthUrl("/verify-email", token);
    return this.mail.sendVerification({
      to,
      actionUrl,
      expiresAt: new Date(Date.now() + EMAIL_VERIFY_TTL_MS),
    });
  }

  private async sendResetUrl(
    to: string,
    token: string,
  ): Promise<EmailDeliveryResult> {
    const actionUrl = this.buildAuthUrl("/reset-password", token);
    return this.mail.sendPasswordReset({
      to,
      actionUrl,
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
    });
  }

  private buildAuthUrl(path: string, token: string): string {
    const webUrl =
      this.config.get<string>("WEB_URL") ?? "http://localhost:5173";
    return `${webUrl.replace(/\/+$/, "")}${path}?token=${encodeURIComponent(token)}`;
  }

  // ── helpers ──────────────────────────────────────────────────────────

  private async issueSession(
    user: PrismaUser,
    metadata: SessionMetadata,
  ): Promise<AuthSession> {
    return this.issueSessionForUser(user.id, metadata);
  }

  private async issueSessionForUser(
    userId: string,
    metadata: SessionMetadata,
  ): Promise<AuthSession> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    const accessToken = this.jwt.sign(payload);
    const refreshToken = randomBytes(32).toString("base64url");

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        device: metadata.device,
        ip: metadata.ip,
        expiresAt: new Date(
          Date.now() + parseDurationToSeconds(jwtConstants.refreshTtl()) * 1000,
        ),
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: parseDurationToSeconds(jwtConstants.accessTtl()),
      user: this.toPublicUser(user),
    };
  }

  private async createDefaultWorkspace(
    userId: string,
    name: string,
  ): Promise<void> {
    const base = this.slugify(name || "mi-espacio");
    let slug = base;
    let n = 2;
    while (true) {
      const existing = await this.prisma.workspace.findUnique({
        where: { slug },
      });
      if (!existing) break;
      slug = `${base}-${n}`;
      n += 1;
    }

    await this.prisma.workspace.create({
      data: {
        name: name ? `Espacio de ${name}` : "Mi espacio",
        slug,
        ownerId: userId,
        members: {
          create: { userId, role: WorkspaceRole.OWNER },
        },
      },
    });
  }

  private slugify(value: string): string {
    const normalized = value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
    return normalized.length >= 2 ? normalized : "mi-espacio";
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private async hashPassword(plain: string): Promise<string> {
    // scrypt con salt aleatorio (formato propio: scrypt$salt$hash).
    const salt = randomBytes(16).toString("hex");
    const key = await scryptAsync(plain, salt, 64);
    return `scrypt$${salt}$${key.toString("hex")}`;
  }

  private async verifyPassword(
    plain: string,
    stored: string,
  ): Promise<boolean> {
    if (!stored.startsWith("scrypt$")) return false;
    const [, salt, hashHex] = stored.split("$");
    if (!salt || !hashHex) return false;

    const key = await scryptAsync(plain, salt, 64);
    const a = Buffer.from(key.toString("hex"), "utf8");
    const b = Buffer.from(hashHex, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private toPublicUser(user: PrismaUser): User {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}
