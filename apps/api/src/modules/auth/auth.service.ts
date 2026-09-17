import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  WorkspaceRole,
  type AuthSession,
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
import type { JwtPayload } from "./types";

interface RefreshValidation {
  user: PrismaUser;
}

export interface SessionMetadata {
  ip: string;
  device: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
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

    return this.issueSession(user, metadata);
  }

  async login(
    input: {
      email: string;
      password: string;
    },
    metadata: SessionMetadata,
  ): Promise<AuthSession> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
    });
    if (!user) {
      throw new UnauthorizedException("Credenciales inválidas");
    }

    const ok = await this.verifyPassword(input.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException("Credenciales inválidas");
    }

    return this.issueSession(user, metadata);
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
