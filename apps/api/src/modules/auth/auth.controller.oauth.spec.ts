import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthController } from "./auth.controller";
import { GoogleOAuthService } from "./google-oauth.service";
import type { AuthService } from "./auth.service";
import type { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";

/**
 * Tests de los endpoints OAuth del controller.
 *
 * El foco es el manejo de `state` y de la redirección: son la parte del flujo que
 * decide si el `code` de Google pertenece a esta sesión o a la de otro. Si acá
 * un caso se escapa, el síntoma es un 401 en vez de una cuenta ajena, así que
 * conviene que estén explícitos.
 */

const WEB_URL = "http://localhost:5173";

function setup(options: { enabled?: boolean } = {}) {
  const enabled = options.enabled ?? true;

  const authService = {
    issueSessionFor: vi
      .fn()
      .mockResolvedValue({ accessToken: "at", refreshToken: "rt", user: {} }),
  } as unknown as AuthService;

  const config = {
    get: vi.fn((key: string) => {
      if (key === "NODE_ENV") return "test";
      if (key === "WEB_URL") return WEB_URL;
      return undefined;
    }),
  } as unknown as ConfigService;

  const googleOAuth = {
    isEnabled: vi.fn(() => enabled),
    buildAuthorizeUrl: vi.fn(
      () => "https://accounts.google.com/o/oauth2/v2/auth?x=1",
    ),
    fetchProfile: vi.fn(),
    resolveUser: vi.fn(),
    createHandoffToken: vi.fn(),
    consumeHandoffToken: vi.fn(),
  } as unknown as GoogleOAuthService;

  const controller = new AuthController(authService, config, googleOAuth);

  const redirect = vi.fn();
  const cookie = vi.fn();
  const clearCookie = vi.fn();
  const res = {
    redirect,
    cookie,
    clearCookie,
  } as unknown as Response;

  return {
    controller,
    authService,
    googleOAuth,
    redirect,
    cookie,
    clearCookie,
    res,
  };
}

function reqWithCookie(cookies: Record<string, string> = {}): Request {
  return {
    cookies,
    // `requestMetadata` lee el `x-forwarded-for` para el lockout y el log. En un
    // request real de Express `headers` siempre existe.
    headers: {},
    ip: "127.0.0.1",
  } as unknown as Request;
}

describe("AuthController OAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /auth/oauth/providers", () => {
    it("lista google cuando está configurado", () => {
      const { controller } = setup({ enabled: true });
      expect(controller.oauthProviders()).toEqual({ providers: ["google"] });
    });

    it("devuelve lista vacía sin credenciales, para que el botón no aparezca", () => {
      const { controller } = setup({ enabled: false });
      expect(controller.oauthProviders()).toEqual({ providers: [] });
    });
  });

  describe("GET /auth/oauth/:provider/authorize", () => {
    it("guarda el state en cookie SameSite=Lax y redirige", () => {
      const { controller, res, cookie, redirect } = setup();

      controller.authorize("google", res);

      expect(cookie).toHaveBeenCalledWith(
        "tm_oauth_state",
        expect.any(String),
        expect.objectContaining({
          httpOnly: true,
          // `Strict` haría que el callback, que vuelve cross-site desde Google,
          // nunca reciba la cookie y el login falle siempre.
          sameSite: "lax",
        }),
      );
      expect(redirect).toHaveBeenCalledWith(
        "https://accounts.google.com/o/oauth2/v2/auth?x=1",
      );
    });

    it("el state de la cookie es el mismo que se manda a Google", () => {
      const { controller, res, cookie, googleOAuth } = setup();

      controller.authorize("google", res);

      const stateInCookie = cookie.mock.calls[0]?.[1] as string;
      const stateToProvider = vi.mocked(googleOAuth.buildAuthorizeUrl).mock
        .calls[0]?.[0];
      // Si fueran distintos, el callback compararía uno contra el otro y siempre
      // daría `invalid_state`.
      expect(stateInCookie).toBe(stateToProvider);
      expect(stateInCookie).toHaveLength(43);
    });

    it("404 para un proveedor desconocido", () => {
      const { controller, res } = setup();
      expect(() => controller.authorize("github", res)).toThrow();
      expect(res.redirect).not.toHaveBeenCalled();
    });
  });

  describe("GET /auth/oauth/:provider/callback", () => {
    it("rechaza un state que no coincide con la cookie", async () => {
      const { controller, res, googleOAuth } = setup();

      await controller.callback(
        "google",
        "state-del-atacante",
        "code-ajeno",
        undefined,
        reqWithCookie({ tm_oauth_state: "state-legitimo" }),
        res,
      );

      expect(res.redirect).toHaveBeenCalledWith(
        `${WEB_URL}/auth/callback?error=invalid_state`,
      );
      // Lo importante: ni se canjeó el code ni se tocó la base.
      expect(googleOAuth.fetchProfile).not.toHaveBeenCalled();
      expect(googleOAuth.createHandoffToken).not.toHaveBeenCalled();
    });

    it("rechaza cuando no hay cookie de state", async () => {
      const { controller, res, googleOAuth } = setup();

      await controller.callback(
        "google",
        "state-cualquiera",
        "code",
        undefined,
        reqWithCookie(),
        res,
      );

      expect(res.redirect).toHaveBeenCalledWith(
        `${WEB_URL}/auth/callback?error=invalid_state`,
      );
      expect(googleOAuth.fetchProfile).not.toHaveBeenCalled();
    });

    it("borra la cookie aunque el flujo falle", async () => {
      const { controller, res, clearCookie } = setup();

      await controller.callback(
        "google",
        "malo",
        "code",
        undefined,
        reqWithCookie({ tm_oauth_state: "bueno" }),
        res,
      );

      // Si el state sobrevive, el próximo intento hereda un token ya usado.
      expect(clearCookie).toHaveBeenCalledWith(
        "tm_oauth_state",
        expect.objectContaining({ sameSite: "lax" }),
      );
    });

    it("traduce el cancelamiento del usuario sin tratarlo como error técnico", async () => {
      const { controller, res, googleOAuth } = setup();

      await controller.callback(
        "google",
        "state",
        undefined,
        "access_denied",
        reqWithCookie({ tm_oauth_state: "state" }),
        res,
      );

      expect(res.redirect).toHaveBeenCalledWith(
        `${WEB_URL}/auth/callback?error=access_denied`,
      );
      expect(googleOAuth.resolveUser).not.toHaveBeenCalled();
    });

    it("traduce un conflicto de cuenta al código de la UI", async () => {
      const { controller, res, googleOAuth } = setup();
      const { ConflictException } = await import("@nestjs/common");
      (googleOAuth.fetchProfile as ReturnType<typeof vi.fn>).mockResolvedValue({
        sub: "s",
        email: "a@b.com",
        emailVerified: true,
        name: "A",
        picture: null,
      });
      (googleOAuth.resolveUser as ReturnType<typeof vi.fn>).mockRejectedValue(
        new ConflictException("otra cuenta"),
      );

      await controller.callback(
        "google",
        "state",
        "code",
        undefined,
        reqWithCookie({ tm_oauth_state: "state" }),
        res,
      );

      expect(res.redirect).toHaveBeenCalledWith(
        `${WEB_URL}/auth/callback?error=account_conflict`,
      );
    });

    it("traduce un email no verificado al código de la UI", async () => {
      const { controller, res, googleOAuth } = setup();
      const { UnauthorizedException } = await import("@nestjs/common");
      (googleOAuth.fetchProfile as ReturnType<typeof vi.fn>).mockResolvedValue({
        sub: "s",
        email: "a@b.com",
        emailVerified: false,
        name: "A",
        picture: null,
      });
      (googleOAuth.resolveUser as ReturnType<typeof vi.fn>).mockRejectedValue(
        new UnauthorizedException("no verificado"),
      );

      await controller.callback(
        "google",
        "state",
        "code",
        undefined,
        reqWithCookie({ tm_oauth_state: "state" }),
        res,
      );

      expect(res.redirect).toHaveBeenCalledWith(
        `${WEB_URL}/auth/callback?error=email_unverified`,
      );
    });

    it("flujo feliz: redirige al frontend con el token de handoff", async () => {
      const { controller, res, googleOAuth } = setup();
      (googleOAuth.fetchProfile as ReturnType<typeof vi.fn>).mockResolvedValue({
        sub: "s",
        email: "a@b.com",
        emailVerified: true,
        name: "A",
        picture: null,
      });
      (googleOAuth.resolveUser as ReturnType<typeof vi.fn>).mockResolvedValue({
        userId: "user-1",
        created: true,
      });
      (
        googleOAuth.createHandoffToken as ReturnType<typeof vi.fn>
      ).mockResolvedValue("handoff-abc");

      await controller.callback(
        "google",
        "state",
        "code",
        undefined,
        reqWithCookie({ tm_oauth_state: "state" }),
        res,
      );

      // El token de handoff sí va en la URL; el access token de Google nunca.
      expect(res.redirect).toHaveBeenCalledWith(
        `${WEB_URL}/auth/callback?token=handoff-abc`,
      );
      expect(vi.mocked(googleOAuth.createHandoffToken).mock.calls).toHaveLength(
        1,
      );
    });

    it("no pone el access token de Google en la redirección", async () => {
      const { controller, res, googleOAuth } = setup();
      (googleOAuth.fetchProfile as ReturnType<typeof vi.fn>).mockResolvedValue({
        sub: "s",
        email: "a@b.com",
        emailVerified: true,
        name: "A",
        picture: null,
      });
      (googleOAuth.resolveUser as ReturnType<typeof vi.fn>).mockResolvedValue({
        userId: "user-1",
        created: false,
      });
      (
        googleOAuth.createHandoffToken as ReturnType<typeof vi.fn>
      ).mockResolvedValue("handoff-abc");

      await controller.callback(
        "google",
        "state",
        "code",
        undefined,
        reqWithCookie({ tm_oauth_state: "state" }),
        res,
      );

      const url = String(vi.mocked(res.redirect).mock.calls[0]?.[0] ?? "");
      expect(url).not.toContain("ya29.");
      expect(url).not.toContain("access_token");
    });
  });

  describe("POST /auth/oauth/exchange", () => {
    it("emite la misma sesión que login y no devuelve el refresh en el cuerpo", async () => {
      const { controller, authService, googleOAuth, res } = setup();
      (
        googleOAuth.consumeHandoffToken as ReturnType<typeof vi.fn>
      ).mockResolvedValue("user-9");

      const result = await controller.exchange(reqWithCookie(), res, {
        token: "handoff-abc",
      });

      expect(googleOAuth.consumeHandoffToken).toHaveBeenCalledWith(
        "handoff-abc",
      );
      expect(authService.issueSessionFor).toHaveBeenCalledWith(
        "user-9",
        expect.anything(),
      );
      // El refresh sigue yendo solo por cookie HttpOnly.
      expect(result).not.toHaveProperty("refreshToken");
    });

    it("propaga el error si el token ya se gastó", async () => {
      const { controller, googleOAuth, res } = setup();
      const { BadRequestException } = await import("@nestjs/common");
      (
        googleOAuth.consumeHandoffToken as ReturnType<typeof vi.fn>
      ).mockRejectedValue(new BadRequestException("ya fue utilizado"));

      await expect(
        controller.exchange(reqWithCookie(), res, { token: "gastado" }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
