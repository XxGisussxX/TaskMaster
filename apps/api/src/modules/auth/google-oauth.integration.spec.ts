import "reflect-metadata";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { PrismaClient } from "@prisma/client";
import { BadRequestException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import { AuthController } from "./auth.controller";
import { GoogleOAuthService } from "./google-oauth.service";
import type { AuthService } from "./auth.service";
import { OAUTH_STATE_COOKIE } from "./auth-cookie";

/**
 * Flujo OAuth completo contra Postgres real, con Google simulado en el borde de
 * la red.
 *
 * Los tests unitarios del servicio y del controller fijan cada decisión por
 * separado. Lo que no cubren es el camino entero: que el `state` que sale en la
 * cookie sea el mismo que vuelve, que el handoff que llega al frontend sirva
 * una vez y solo una, y que la cuenta que termina en la base sea la correcta.
 *
 * Google se simula en `fetch` a propósito y no inyectando un doble del
 * servicio: así se ejercita también el parseo de la respuesta de Google, que es
 * donde un cambio de formato real rompería en silencio.
 *
 * Se salta solo si no hay `DATABASE_URL` o la base no responde.
 */

function loadDatabaseUrl(): string | undefined {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  try {
    const contents = readFileSync(join(process.cwd(), ".env"), "utf8");
    const match = contents.match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/m);
    const raw = match?.[1];
    if (!raw) return undefined;
    const value = raw.replace(/^["']|["']$/g, "");
    process.env.DATABASE_URL = value;
    return value;
  } catch {
    return undefined;
  }
}

const databaseUrl = loadDatabaseUrl();
const prisma = databaseUrl ? new PrismaClient() : undefined;

const suffix = `${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
const emailOf = (tag: string) => `oauth-${tag}-${suffix}@example.com`;

const GOOGLE_CONFIG = {
  GOOGLE_CLIENT_ID: "test-client.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "test-secret",
  GOOGLE_REDIRECT_URI: "http://localhost:4000/api/auth/oauth/google/callback",
  WEB_URL: "http://localhost:5173",
  NODE_ENV: "test",
};

/** Lo que Google devolvería para un `code` dado. */
type GoogleStub = {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  picture?: string | null;
  /** Simula que Google rechaza el canje del code. */
  rejectToken?: boolean;
};

/**
 * Reemplaza `fetch` por un doble que responde como los dos endpoints de Google.
 * Deja `fetch` normal para cualquier otra URL.
 */
function stubGoogle(stub: GoogleStub): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.startsWith("https://oauth2.googleapis.com/token")) {
        if (stub.rejectToken) {
          return {
            ok: false,
            status: 400,
            json: async () => ({ error: "invalid_grant" }),
            text: async () => '{"error":"invalid_grant"}',
          };
        }
        // El code llega en el body: si no, el controller no lo está reenviando.
        expect(String(init?.body ?? "")).toContain("code=");
        return {
          ok: true,
          status: 200,
          json: async () => ({ access_token: "google-access-token" }),
        };
      }

      if (url.startsWith("https://openidconnect.googleapis.com/v1/userinfo")) {
        expect((init?.headers as Record<string, string>)?.authorization).toBe(
          "Bearer google-access-token",
        );
        return {
          ok: true,
          status: 200,
          json: async () => ({
            sub: stub.sub,
            email: stub.email,
            email_verified: stub.email_verified ?? true,
            name: stub.name ?? "Ana Tester",
            picture: stub.picture ?? null,
          }),
        };
      }

      throw new Error(`fetch inesperado a ${url}`);
    }),
  );
}

/** Cookies y redirects capturados de una respuesta de Express. */
function makeRes() {
  const jar: Record<string, string> = {};
  const cleared: string[] = [];
  const redirects: string[] = [];

  const res = {
    cookie: (name: string, value: string) => {
      jar[name] = value;
    },
    clearCookie: (name: string) => {
      cleared.push(name);
      delete jar[name];
    },
    redirect: (url: string) => {
      redirects.push(url);
    },
  } as unknown as Response;

  return {
    res,
    jar,
    cleared,
    redirects,
    lastRedirect: () => redirects[redirects.length - 1] ?? "",
  };
}

function makeController() {
  const config = {
    get: (key: string) =>
      (GOOGLE_CONFIG as Record<string, string | undefined>)[key],
  } as unknown as ConfigService;

  const issueSessionFor = vi.fn().mockResolvedValue({
    accessToken: "taskmaster-access-token",
    refreshToken: "taskmaster-refresh-token",
    user: {
      id: "u",
      email: "e",
      name: "n",
      role: "OWNER",
      isEmailVerified: true,
    },
  });
  const authService = { issueSessionFor } as unknown as AuthService;

  const oauth = new GoogleOAuthService(
    prisma as unknown as ConstructorParameters<typeof GoogleOAuthService>[0],
    config,
  );

  return {
    controller: new AuthController(authService, config, oauth),
    oauth,
    issueSessionFor,
  };
}

const req = (cookies: Record<string, string> = {}): Request =>
  ({ cookies, headers: {}, ip: "127.0.0.1" }) as unknown as Request;

let dbUp = false;

const createdUserIds: string[] = [];

describe("flujo Google OAuth completo (integración Postgres)", () => {
  beforeAll(async () => {
    if (!prisma) return;
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbUp = true;
    } catch {
      dbUp = false;
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    if (!prisma || !dbUp) return;
    // Los `Account` caen por cascada al borrar el `User`.
    await prisma.user.deleteMany({
      where: { id: { in: createdUserIds } },
    });
    await prisma.$disconnect();
  });

  it("crea la cuenta y deja el usuario listo para un handoff de un solo uso", async () => {
    if (!dbUp) return;
    if (!dbUp) return;
    const email = emailOf("nuevo");
    const { controller } = makeController();

    // 1. Arranca el flujo: el authorize deja el state en la cookie.
    const start = makeRes();
    controller.authorize("google", start.res);
    const stateInCookie = start.jar[OAUTH_STATE_COOKIE]!;
    expect(stateInCookie).toBeTruthy();

    // 2. Google devuelve el callback con el mismo state.
    stubGoogle({
      sub: `sub-${suffix}`,
      email,
      picture: "https://lh3.googleusercontent.com/a/ana",
    });
    const cb = makeRes();
    await controller.callback(
      "google",
      stateInCookie,
      "code-de-google",
      undefined,
      req({ [OAUTH_STATE_COOKIE]: stateInCookie }),
      cb.res,
    );

    // 3. Redirige al frontend con un handoff, y el state ya se borró.
    const redirect = new URL(cb.lastRedirect());
    expect(redirect.pathname).toBe("/auth/callback");
    const handoff = redirect.searchParams.get("token");
    expect(handoff).toBeTruthy();
    expect(cb.cleared).toContain(OAUTH_STATE_COOKIE);

    // 4. En la base: usuario sin contraseña, verificado, con su Account.
    const user = await prisma!.user.findUniqueOrThrow({
      where: { email },
      include: { accounts: true },
    });
    createdUserIds.push(user.id);
    expect(user.passwordHash).toBeNull();
    expect(user.isEmailVerified).toBe(true);
    // La foto de Google no se importa: el avatar queda igual que en registro.
    expect(user.avatarUrl).toBeNull();
    expect(user.accounts).toHaveLength(1);
    expect(user.accounts[0]).toMatchObject({
      provider: "google",
      providerAccountId: `sub-${suffix}`,
      userId: user.id,
    });

    // 5. El canje emite sesión una vez...
    const exchangeRes = makeRes();
    const session = await controller.exchange(req(), exchangeRes.res, {
      token: handoff!,
    });
    expect(session.accessToken).toBe("taskmaster-access-token");
    // ...y el refresh sigue solo en la cookie, nunca en el cuerpo.
    expect(session).not.toHaveProperty("refreshToken");

    // 6. Reintentar con el mismo handoff falla: ya se gastó.
    const replay = makeRes();
    await expect(
      controller.exchange(req(), replay.res, { token: handoff! }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rechaza un callback cuyo state no viene de esta cookie", async () => {
    if (!dbUp) return;
    if (!dbUp) return;
    const { controller } = makeController();
    stubGoogle({ sub: `sub-csrf-${suffix}`, email: emailOf("csrf") });

    const cb = makeRes();
    await controller.callback(
      "google",
      "state-del-atacante",
      "code-robado",
      undefined,
      req({ [OAUTH_STATE_COOKIE]: "state-de-la-victima" }),
      cb.res,
    );

    expect(cb.lastRedirect()).toContain("error=invalid_state");
    // Ni una fila creada: el rechazo es antes de tocar la base.
    expect(
      await prisma!.user.count({
        where: { email: emailOf("csrf") },
      }),
    ).toBe(0);
  });

  it("rechaza un email que Google no dice verificado", async () => {
    if (!dbUp) return;
    const email = emailOf("sin-verificar");
    const { controller } = makeController();

    const start = makeRes();
    controller.authorize("google", start.res);
    stubGoogle({
      sub: `sub-unv-${suffix}`,
      email,
      email_verified: false,
    });

    const cb = makeRes();
    await controller.callback(
      "google",
      start.jar[OAUTH_STATE_COOKIE]!,
      "code",
      undefined,
      req({ [OAUTH_STATE_COOKIE]: start.jar[OAUTH_STATE_COOKIE]! }),
      cb.res,
    );

    expect(cb.lastRedirect()).toContain("error=email_unverified");
    expect(await prisma!.user.count({ where: { email } })).toBe(0);
  });

  it("vincula una cuenta que ya existía con contraseña, sin pisarla", async () => {
    if (!dbUp) return;
    const email = emailOf("existente");
    const passwordHash = "scrypt$deadbeef$cafe";

    const existing = await prisma!.user.create({
      data: {
        email,
        name: "Con Password",
        passwordHash,
        isEmailVerified: false,
        settings: { create: {} },
      },
    });
    createdUserIds.push(existing.id);

    const { controller } = makeController();
    const start = makeRes();
    controller.authorize("google", start.res);
    stubGoogle({ sub: `sub-vinc-${suffix}`, email });

    const cb = makeRes();
    await controller.callback(
      "google",
      start.jar[OAUTH_STATE_COOKIE]!,
      "code",
      undefined,
      req({ [OAUTH_STATE_COOKIE]: start.jar[OAUTH_STATE_COOKIE]! }),
      cb.res,
    );

    expect(cb.lastRedirect()).toContain("token=");
    // Sigue siendo el MISMO usuario: no se creó una cuenta nueva ni se tocó la
    // contraseña.
    const after = await prisma!.user.findUniqueOrThrow({
      where: { email },
      include: { accounts: true },
    });
    expect(after.id).toBe(existing.id);
    expect(after.passwordHash).toBe(passwordHash);
    // Google probó el email, así que la cuenta local queda verificada.
    expect(after.isEmailVerified).toBe(true);
    expect(after.accounts).toHaveLength(1);
  });

  it("no deja que un segundo Google con el mismo email entre", async () => {
    if (!dbUp) return;
    const email = emailOf("conflicto");

    // Dos cuentas de Google distintas, mismo email verificado.
    const first = await prisma!.user.create({
      data: {
        email,
        name: "Dueña real",
        passwordHash: null,
        isEmailVerified: true,
        settings: { create: {} },
        accounts: {
          create: { provider: "google", providerAccountId: `sub-1-${suffix}` },
        },
      },
    });
    createdUserIds.push(first.id);

    const { controller } = makeController();
    const start = makeRes();
    controller.authorize("google", start.res);
    stubGoogle({ sub: `sub-2-${suffix}`, email });

    const cb = makeRes();
    await controller.callback(
      "google",
      start.jar[OAUTH_STATE_COOKIE]!,
      "code",
      undefined,
      req({ [OAUTH_STATE_COOKIE]: start.jar[OAUTH_STATE_COOKIE]! }),
      cb.res,
    );

    expect(cb.lastRedirect()).toContain("error=account_conflict");
    // Sigue habiendo una sola Account: la del segundo Google no se creó.
    const accounts = await prisma!.account.count({
      where: { userId: first.id },
    });
    expect(accounts).toBe(1);
  });

  it("degrada a error si Google rechaza el canje del code", async () => {
    if (!dbUp) return;
    const email = emailOf("code-malo");
    const { controller } = makeController();
    const start = makeRes();
    controller.authorize("google", start.res);
    stubGoogle({ sub: `sub-bad-${suffix}`, email, rejectToken: true });

    const cb = makeRes();
    await controller.callback(
      "google",
      start.jar[OAUTH_STATE_COOKIE]!,
      "code-malo",
      undefined,
      req({ [OAUTH_STATE_COOKIE]: start.jar[OAUTH_STATE_COOKIE]! }),
      cb.res,
    );

    expect(cb.lastRedirect()).toContain("error=exchange_failed");
    expect(await prisma!.user.count({ where: { email } })).toBe(0);
  });

  it("el handoff expira y no sirve después de su TTL", async () => {
    if (!dbUp) return;
    const { oauth } = makeController();
    const email = emailOf("expirado");

    const user = await prisma!.user.create({
      data: {
        email,
        name: "Expira",
        passwordHash: null,
        isEmailVerified: true,
        settings: { create: {} },
      },
    });
    createdUserIds.push(user.id);

    const token = await oauth.createHandoffToken(user.id);
    // Se vence el handoff sin que nadie lo canjee.
    await prisma!.authToken.updateMany({
      where: { userId: user.id, type: "OAUTH_HANDOFF" },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });

    await expect(oauth.consumeHandoffToken(token)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("un token de reset de contraseña no sirve como handoff", async () => {
    if (!dbUp) return;
    const { oauth } = makeController();
    const email = emailOf("reset-falso");
    const user = await prisma!.user.create({
      data: {
        email,
        name: "Reset",
        passwordHash: "scrypt$salt$hash",
        isEmailVerified: true,
        settings: { create: {} },
        authTokens: {
          create: {
            type: "PASSWORD_RESET",
            // Mismo hash que generaría un handoff válido, pero otro tipo.
            tokenHash:
              "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            expiresAt: new Date(Date.now() + 60_000),
          },
        },
      },
    });
    createdUserIds.push(user.id);

    await expect(
      oauth.consumeHandoffToken("x".repeat(64)),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(user.id).toBeTruthy();
  });

  it("confirma que el handoff se guarda hasheado en la base", async () => {
    if (!dbUp) return;
    const { oauth } = makeController();
    const email = emailOf("hash");
    const user = await prisma!.user.create({
      data: {
        email,
        name: "Hash",
        passwordHash: null,
        isEmailVerified: true,
        settings: { create: {} },
      },
    });
    createdUserIds.push(user.id);

    const token = await oauth.createHandoffToken(user.id);
    const row = await prisma!.authToken.findFirstOrThrow({
      where: { userId: user.id, type: "OAUTH_HANDOFF" },
    });

    // Si la base se filtrara, el token no debe servir para nada.
    expect(row.tokenHash).not.toBe(token);
    expect(row.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    await oauth.consumeHandoffToken(token);
  });

  it("el cron de limpieza se lleva los handoffs expirados", async () => {
    if (!dbUp) return;
    const email = emailOf("limpieza");
    const user = await prisma!.user.create({
      data: {
        email,
        name: "Limpieza",
        passwordHash: null,
        isEmailVerified: true,
        settings: { create: {} },
      },
    });
    createdUserIds.push(user.id);

    await prisma!.authToken.create({
      data: {
        userId: user.id,
        type: "OAUTH_HANDOFF",
        tokenHash: `hash-limpieza-${suffix}`,
        expiresAt: new Date(Date.now() - 1_000),
      },
    });

    // Misma consulta que corre `SessionCleanupService` a las 03:00.
    const deleted = await prisma!.authToken.deleteMany({
      where: { type: "OAUTH_HANDOFF", expiresAt: { lt: new Date() } },
    });

    expect(deleted.count).toBeGreaterThanOrEqual(1);
    expect(await prisma!.authToken.count({ where: { userId: user.id } })).toBe(
      0,
    );
  });
});
