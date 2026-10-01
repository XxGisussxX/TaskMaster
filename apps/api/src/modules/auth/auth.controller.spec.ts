import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import type { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import { AuthController } from "./auth.controller";
import { REFRESH_COOKIE } from "./auth-cookie";
import type { AuthService } from "./auth.service";

/**
 * El punto de estos tests es que el refresh token no vuelva a existir en un
 * canal que el JavaScript de la página pueda leer. O sea: ni en el cuerpo de la
 * respuesta, ni en el body del request de refresh, ni en localStorage.
 *
 * Los atributos de la cookie se cubren acá porque son la diferencia entre
 * "inaccessible para JS" y "accesible para JS": un `secure: false` en
 * producción o un `path` mal puesto cambian el comportamiento en silencio.
 */
const REFRESH = "rt_secreto";
const ACCESS = "at_secreto";

const USER = {
  id: "u1",
  email: "a@b.c",
  name: "Ana",
  avatarUrl: null,
  role: "USER",
  isEmailVerified: true,
  createdAt: "2024-01-01T00:00:00.000Z",
};

function setup(nodeEnv = "test") {
  const session = {
    accessToken: ACCESS,
    refreshToken: REFRESH,
    expiresIn: 900,
    user: USER,
  };

  const authService = {
    register: vi.fn().mockResolvedValue(session),
    login: vi.fn().mockResolvedValue(session),
    refresh: vi.fn().mockResolvedValue(session),
    logout: vi.fn().mockResolvedValue({ success: true }),
  };

  const config = {
    get: vi.fn((key: string) => (key === "NODE_ENV" ? nodeEnv : undefined)),
  } as unknown as ConfigService;

  // Los mocks viven sueltos para poder assertearlos con los tipos de vitest,
  // mientras el controller recibe algo con forma de `Response`.
  const cookie = vi.fn();
  const clearCookie = vi.fn();

  const controller = new AuthController(
    authService as unknown as AuthService,
    config,
  );

  return {
    controller,
    authService,
    cookie,
    clearCookie,
    res: { cookie, clearCookie } as unknown as Response,
  };
}

function reqWithCookie(cookies: Record<string, string> = {}): Request {
  return {
    headers: {},
    cookies,
    socket: {},
  } as unknown as Request;
}

const EMPTY = { cookies: {} } as unknown as Request;
const META = { headers: {}, cookies: {}, socket: {} } as unknown as Request;

describe("AuthController: refresh token en cookie HttpOnly", () => {
  it("login no devuelve el refresh token en el cuerpo", async () => {
    const { controller, cookie, res } = setup();
    const result = await controller.login(
      META,
      res,
      { email: "a@b.c", password: "Password123!" },
    );

    expect(result).not.toHaveProperty("refreshToken");
    expect(result).toMatchObject({ accessToken: ACCESS, user: USER });
    expect(cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE,
      REFRESH,
      expect.objectContaining({ httpOnly: true, sameSite: "strict" }),
    );
  });

  it("register tampoco lo devuelve", async () => {
    const { controller, cookie, res } = setup();
    const result = await controller.register(META, res, {
      name: "Ana",
      email: "a@b.c",
      password: "Password123!",
    } as never);

    expect(result).not.toHaveProperty("refreshToken");
    expect(cookie).toHaveBeenCalled();
  });

  it("marca la cookie como Secure solo en producción", async () => {
    const dev = setup("development");
    await dev.controller.login(META, dev.res, {
      email: "a@b.c",
      password: "Password123!",
    });
    expect(dev.cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE,
      REFRESH,
      expect.objectContaining({ secure: false }),
    );

    const prod = setup("production");
    await prod.controller.login(META, prod.res, {
      email: "a@b.c",
      password: "Password123!",
    });
    expect(prod.cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE,
      REFRESH,
      expect.objectContaining({ secure: true }),
    );
  });

  it("limita la cookie a /api/auth y le pone expiración", async () => {
    const { controller, cookie, res } = setup();
    await controller.login(META, res, {
      email: "a@b.c",
      password: "Password123!",
    });

    const call = cookie.mock.calls[0];
    expect(call).toBeDefined();
    const options = call?.[2] as { path: string; maxAge: number };
    expect(options.path).toBe("/api/auth");
    // 30 días de JWT_REFRESH_TTL por defecto, en ms.
    expect(options.maxAge).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it("refresh lee el token de la cookie y no del body", async () => {
    const { controller, authService, res } = setup();
    const result = await controller.refresh(
      reqWithCookie({ [REFRESH_COOKIE]: REFRESH }),
      res,
    );

    expect(authService.refresh).toHaveBeenCalledWith(
      REFRESH,
      expect.objectContaining({ ip: "unknown", device: "unknown" }),
    );
    expect(result).not.toHaveProperty("refreshToken");
  });

  it("refresh rota la cookie con el token nuevo", async () => {
    const { controller, authService, cookie, res } = setup();
    const rotated = {
      accessToken: ACCESS,
      refreshToken: "rt_nuevo",
      expiresIn: 900,
      user: USER,
    };
    authService.refresh.mockResolvedValue(rotated);

    await controller.refresh(reqWithCookie({ [REFRESH_COOKIE]: REFRESH }), res);

    expect(cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE,
      "rt_nuevo",
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it("refresh sin cookie responde 401 y no toca la DB", async () => {
    const { controller, authService, cookie, res } = setup();

    await expect(controller.refresh(EMPTY, res)).rejects.toThrow(
      /Refresh token requerido/,
    );
    expect(authService.refresh).not.toHaveBeenCalled();
    expect(cookie).not.toHaveBeenCalled();
  });

  it("logout revoca el token de la cookie y la borra", async () => {
    const { controller, authService, clearCookie, res } = setup();
    await controller.logout(reqWithCookie({ [REFRESH_COOKIE]: REFRESH }), res);

    expect(authService.logout).toHaveBeenCalledWith(REFRESH);
    expect(clearCookie).toHaveBeenCalledWith(
      REFRESH_COOKIE,
      expect.objectContaining({ httpOnly: true, path: "/api/auth" }),
    );
  });

  it("logout sin cookie igual limpia y responde exitoso", async () => {
    const { controller, authService, clearCookie, res } = setup();
    const result = await controller.logout(EMPTY, res);

    expect(result).toEqual({ success: true });
    expect(authService.logout).not.toHaveBeenCalled();
    expect(clearCookie).toHaveBeenCalled();
  });
});
