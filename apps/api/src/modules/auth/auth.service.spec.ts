import "reflect-metadata";
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { AuthService } from "./auth.service";

const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");

const USER = {
  id: "u1",
  email: "ana@example.com",
  name: "Ana",
  passwordHash: "scrypt$salt$hash",
  role: "USER",
  isEmailVerified: false,
  avatarUrl: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

type FakeAuthToken = {
  id: string;
  userId: string;
  type: "EMAIL_VERIFY" | "PASSWORD_RESET";
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
};

function authTokenRow(overrides: Partial<FakeAuthToken> = {}): FakeAuthToken {
  return {
    id: "t1",
    userId: "u1",
    type: "EMAIL_VERIFY",
    tokenHash: sha256("token-1"),
    expiresAt: new Date(Date.now() + 86_400_000),
    usedAt: null,
    ...overrides,
  };
}

type FakeDb = {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    findUniqueOrThrow: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  authToken: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  refreshToken: {
    updateMany: ReturnType<typeof vi.fn>;
  };
};

function setup(options: {
  user?: typeof USER | null;
  token?: FakeAuthToken | null;
  userAlreadyVerified?: boolean;
}): {
  db: FakeDb;
  mail: {
    sendVerification: ReturnType<typeof vi.fn>;
    sendPasswordReset: ReturnType<typeof vi.fn>;
  };
  service: AuthService;
} {
  const db: FakeDb = {
    user: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    authToken: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    refreshToken: {
      updateMany: vi.fn(),
    },
  };

  const user = options.user === null ? null : { ...USER, ...options.user };
  if (options.userAlreadyVerified) {
    user!.isEmailVerified = true;
  }
  db.user.findUniqueOrThrow.mockResolvedValue(user);
  db.authToken.findUnique.mockResolvedValue(options.token ?? authTokenRow());
  db.authToken.create.mockResolvedValue(authTokenRow());
  db.authToken.update.mockResolvedValue(options.token ?? authTokenRow());

  const mail = {
    sendVerification: vi.fn().mockResolvedValue({ sent: true }),
    sendPasswordReset: vi.fn().mockResolvedValue({ sent: true }),
  };
  const config = { get: vi.fn(() => "http://localhost:5173") };
  const jwt = {};

  const service = new AuthService(
    db as any,
    jwt as any,
    mail as any,
    config as any,
  );

  return { db, mail, service };
}

describe("AuthService · verificación y reset de contraseña", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("verifyEmail", () => {
    it("marca el email como verificado y consume el token", async () => {
      const { db, service } = setup({});

      const result = await service.verifyEmail("token-1");

      expect(result).toEqual({ success: true });
      expect(db.user.update).toHaveBeenCalledWith({
        where: { id: "u1" },
        data: { isEmailVerified: true },
      });
      expect(db.authToken.update).toHaveBeenCalledWith({
        where: { id: "t1" },
        data: { usedAt: expect.any(Date) },
      });
    });

    it("no consume nada si el email ya estaba verificado", async () => {
      const { db, service } = setup({ userAlreadyVerified: true });

      const result = await service.verifyEmail("token-1");

      expect(result).toEqual({ success: true });
      expect(db.user.update).not.toHaveBeenCalled();
      expect(db.authToken.update).not.toHaveBeenCalled();
    });

    it("rechaza un token de otro tipo", async () => {
      const { service } = setup({
        token: authTokenRow({ type: "PASSWORD_RESET" }),
      });

      await expect(service.verifyEmail("token-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("rechaza un token ya utilizado", async () => {
      const { service } = setup({
        token: authTokenRow({ usedAt: new Date() }),
      });

      await expect(service.verifyEmail("token-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("rechaza un token expirado", async () => {
      const { service } = setup({
        token: authTokenRow({ expiresAt: new Date(Date.now() - 1000) }),
      });

      await expect(service.verifyEmail("token-1")).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("resendVerification", () => {
    it("genera un token y envía el email", async () => {
      const { db, mail, service } = setup({ user: null });
      db.user.findUnique.mockResolvedValue(USER);

      const result = await service.resendVerification("ana@example.com");

      expect(result).toEqual({ sent: true });
      expect(db.authToken.create).toHaveBeenCalled();
      expect(mail.sendVerification).toHaveBeenCalled();
    });

    it("no envía nada si el email ya está verificado", async () => {
      const { db, mail, service } = setup({ user: null });
      db.user.findUnique.mockResolvedValue({ ...USER, isEmailVerified: true });

      const result = await service.resendVerification("ana@example.com");

      expect(result).toEqual({ sent: false });
      expect(db.authToken.create).not.toHaveBeenCalled();
      expect(mail.sendVerification).not.toHaveBeenCalled();
    });

    it("es silencioso si el email no existe", async () => {
      const { db, mail, service } = setup({ user: null });
      db.user.findUnique.mockResolvedValue(null);

      const result = await service.resendVerification("nadie@example.com");

      expect(result).toEqual({ sent: false });
      expect(db.authToken.create).not.toHaveBeenCalled();
      expect(mail.sendVerification).not.toHaveBeenCalled();
    });
  });

  describe("forgotPassword", () => {
    it("genera un token de reset y envía el email", async () => {
      const { db, mail, service } = setup({ user: null });
      db.user.findUnique.mockResolvedValue(USER);

      const result = await service.forgotPassword("ana@example.com");

      expect(result).toEqual({ sent: true });
      expect(db.authToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: "PASSWORD_RESET" }),
        }),
      );
      expect(mail.sendPasswordReset).toHaveBeenCalled();
    });

    it("no envía nada si el email no existe (sin enumerar)", async () => {
      const { db, mail, service } = setup({ user: null });
      db.user.findUnique.mockResolvedValue(null);

      const result = await service.forgotPassword("nadie@example.com");

      expect(result).toEqual({ sent: false });
      expect(db.authToken.create).not.toHaveBeenCalled();
      expect(mail.sendPasswordReset).not.toHaveBeenCalled();
    });
  });

  describe("resetPassword", () => {
    it("actualiza la contraseña, revoca sesiones y marca el token como usado", async () => {
      const { db, service } = setup({
        token: authTokenRow({ type: "PASSWORD_RESET" }),
      });

      const result = await service.resetPassword("token-1", "nuevaClave123");

      expect(result).toEqual({ success: true });
      expect(db.user.update).toHaveBeenCalledWith({
        where: { id: "u1" },
        data: { passwordHash: expect.stringMatching(/^scrypt\$/) },
      });
      expect(db.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: "u1", revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(db.authToken.update).toHaveBeenCalledWith({
        where: { id: "t1" },
        data: { usedAt: expect.any(Date) },
      });
    });

    it("rechaza un token de verificación usado como reset", async () => {
      const { service } = setup({ token: authTokenRow() });

      await expect(
        service.resetPassword("token-1", "nuevaClave123"),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
