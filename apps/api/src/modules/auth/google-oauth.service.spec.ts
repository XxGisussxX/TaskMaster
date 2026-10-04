import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { GoogleOAuthService } from "./google-oauth.service";
import type { PrismaService } from "../../prisma/prisma.service";

/**
 * Tests del servicio de Google focusing en las decisiones de seguridad, que es
 * donde un error no se ve: un `resolveUser` mal escrito deja entrar a cualquiera
 * con un email parecido.
 *
 * `fetch` se stubea a mano en vez de usar mocks de red: interesa probar qué
 * hace el servicio con la respuesta de Google, no la mécanique de `fetch`.
 */

const CONFIGURED = {
  GOOGLE_CLIENT_ID: "client-id.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "secret",
  GOOGLE_REDIRECT_URI: "http://localhost:3000/api/auth/oauth/google/callback",
};

function makeService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    account: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    authToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  } as unknown as PrismaService;

  const config = {
    get: vi.fn((key: string) => (CONFIGURED as Record<string, unknown>)[key]),
  } as unknown as ConfigService;

  return {
    service: new GoogleOAuthService(prisma, config),
    prisma,
    config,
    ...overrides,
  };
}

const verifiedProfile = {
  sub: "google-sub-123",
  email: "ana@example.com",
  emailVerified: true,
  name: "Ana",
  picture: "https://lh3.google.com/a/ana",
};

describe("GoogleOAuthService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("isEnabled", () => {
    it("exige las tres credenciales", () => {
      const { prisma } = makeService();
      const partial = {
        get: vi.fn((key: string) =>
          key === "GOOGLE_REDIRECT_URI"
            ? CONFIGURED.GOOGLE_REDIRECT_URI
            : undefined,
        ),
      } as unknown as ConfigService;

      const service = new GoogleOAuthService(prisma, partial);
      expect(service.isEnabled()).toBe(false);
    });

    it("true con las tres presentes", () => {
      const { service } = makeService();
      expect(service.isEnabled()).toBe(true);
    });
  });

  describe("resolveUser", () => {
    it("rechaza un email que Google no dice verificado", async () => {
      const { service, prisma } = makeService();

      await expect(
        service.resolveUser({ ...verifiedProfile, emailVerified: false }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      // Ni una sola consulta: el rechazo es antes de tocar la base.
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(prisma.account.findUnique).not.toHaveBeenCalled();
    });

    it("reutiliza el usuario si la cuenta de Google ya existía", async () => {
      const { service, prisma } = makeService();
      (prisma.account.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        {
          id: "acc-1",
          userId: "user-1",
          user: {},
        },
      );

      const result = await service.resolveUser(verifiedProfile);

      expect(result).toEqual({ userId: "user-1", created: false });
      // No crea otra `Account`: el `sub` es único por persona.
      expect(prisma.account.create).not.toHaveBeenCalled();
    });

    it("rechaza un email ya vinculado a OTRA cuenta de Google", async () => {
      const { service, prisma } = makeService();
      (prisma.account.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      );
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "user-1",
        isEmailVerified: true,
        accounts: [{ provider: "google", providerAccountId: "otro-sub" }],
      });

      // Sin este chequeo, cualquiera con el mismo email en un segundo Google
      // entraría a una cuenta ajena.
      await expect(service.resolveUser(verifiedProfile)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.account.create).not.toHaveBeenCalled();
    });

    it("vincula un usuario que existía con contraseña", async () => {
      const { service, prisma } = makeService();
      (prisma.account.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      );
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "user-1",
        isEmailVerified: false,
        accounts: [],
      });

      const result = await service.resolveUser(verifiedProfile);

      expect(result).toEqual({ userId: "user-1", created: false });
      expect(prisma.account.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          provider: "google",
          providerAccountId: "google-sub-123",
          userId: "user-1",
        }),
      });
      // Google ya probó el email, así que la cuenta local deja de estar
      // pendiente de verificación.
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { isEmailVerified: true },
      });
    });

    it("crea la cuenta sin passwordHash y marcada como verificada", async () => {
      const { service, prisma } = makeService();
      (prisma.account.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      );
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      );
      (prisma.user.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "user-new",
      });

      const result = await service.resolveUser(verifiedProfile);

      expect(result).toEqual({ userId: "user-new", created: true });
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: "ana@example.com",
          passwordHash: null,
          isEmailVerified: true,
        }),
      });
    });

    it("cae al prefijo del email cuando Google no manda nombre", async () => {
      const { service, prisma } = makeService();
      (prisma.account.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      );
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      );
      (prisma.user.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "user-new",
      });

      await service.resolveUser({ ...verifiedProfile, name: "" });

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: "ana" }),
      });
    });
  });

  describe("handoff de un solo uso", () => {
    it("no deja reutilizar un token ya canjeado", async () => {
      const { service, prisma } = makeService();
      const now = new Date();
      (
        prisma.authToken.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: "tok-1",
        userId: "user-1",
        type: "OAUTH_HANDOFF",
        expiresAt: new Date(now.getTime() + 60_000),
        usedAt: null,
      });
      // El updateMany condicionado devuelve 0 filas: otro request ya lo gastó.
      (
        prisma.authToken.updateMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ count: 0 });

      await expect(service.consumeHandoffToken("token")).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it("rechaza un token de otro tipo", async () => {
      const { service, prisma } = makeService();
      (
        prisma.authToken.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: "tok-1",
        userId: "user-1",
        // Si un token de reset de contraseña se pudiera canjear acá, sería
        // una vía para obtener sesión sin clickear nada.
        type: "PASSWORD_RESET",
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
      });

      await expect(service.consumeHandoffToken("token")).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.authToken.updateMany).not.toHaveBeenCalled();
    });

    it("rechaza un token expirado", async () => {
      const { service, prisma } = makeService();
      (
        prisma.authToken.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: "tok-1",
        userId: "user-1",
        type: "OAUTH_HANDOFF",
        expiresAt: new Date(Date.now() - 1_000),
        usedAt: null,
      });

      await expect(service.consumeHandoffToken("token")).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it("devuelve el userId y marca el token como usado", async () => {
      const { service, prisma } = makeService();
      (
        prisma.authToken.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: "tok-1",
        userId: "user-7",
        type: "OAUTH_HANDOFF",
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
      });
      (
        prisma.authToken.updateMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ count: 1 });

      await expect(service.consumeHandoffToken("token")).resolves.toBe(
        "user-7",
      );
      expect(prisma.authToken.updateMany).toHaveBeenCalledWith({
        where: { id: "tok-1", usedAt: null },
        data: { usedAt: expect.any(Date) },
      });
    });

    it("guarda solo el hash del token, nunca el token en claro", async () => {
      const { service, prisma } = makeService();
      (prisma.authToken.create as ReturnType<typeof vi.fn>).mockResolvedValue(
        {},
      );

      const token = await service.createHandoffToken("user-1");

      const call = (prisma.authToken.create as ReturnType<typeof vi.fn>).mock
        .calls[0]?.[0] as { data: { tokenHash: string } };
      expect(call.data.tokenHash).not.toBe(token);
      expect(call.data.tokenHash).toMatch(/^[a-f0-9]{64}$/);
      // El hash sí es determinístico: el canje lo vuelve a calcular y compara.
      expect(call.data.tokenHash).toHaveLength(64);
    });
  });

  describe("fetchProfile", () => {
    it("normaliza el email y exige email_verified booleano", async () => {
      const { service } = makeService();
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ access_token: "at" }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              sub: "sub-1",
              email: "  ANA@Example.COM ",
              // Google mandaría el booleano, pero si llega el string "true"
              // tratarlo como verificado sería aceptar un valor no confirmado.
              email_verified: "true",
              name: "Ana",
              picture: null,
            }),
          }),
      );

      const profile = await service.fetchProfile("code-1");

      expect(profile.email).toBe("ana@example.com");
      expect(profile.emailVerified).toBe(false);
      vi.unstubAllGlobals();
    });

    it("falla si Google rechaza el canje del code", async () => {
      const { service } = makeService();
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 400,
          text: async () => '{"error":"invalid_grant"}',
        }),
      );

      await expect(service.fetchProfile("code-malo")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      vi.unstubAllGlobals();
    });

    it("falla si Google no devuelve un sub", async () => {
      const { service } = makeService();
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ access_token: "at" }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ email: "ana@example.com" }),
          }),
      );

      await expect(service.fetchProfile("code-1")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      vi.unstubAllGlobals();
    });
  });

  describe("buildAuthorizeUrl", () => {
    it("incluye state, scope y select_account", () => {
      const { service } = makeService();
      const url = new URL(service.buildAuthorizeUrl("state-abc"));

      expect(url.origin + url.pathname).toBe(
        "https://accounts.google.com/o/oauth2/v2/auth",
      );
      expect(url.searchParams.get("state")).toBe("state-abc");
      expect(url.searchParams.get("scope")).toBe("openid email profile");
      expect(url.searchParams.get("response_type")).toBe("code");
      // Sin esto, Google devuelve a la primera cuenta del navegador y no a la
      // que el usuario está pensando usar.
      expect(url.searchParams.get("prompt")).toBe("select_account");
    });
  });
});
