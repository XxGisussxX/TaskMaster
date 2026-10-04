import { describe, expect, it } from "vitest";
import { accessTokenExpiresAt, shouldRefreshAccessToken } from "./access-token";

function makeToken(payload: Record<string, unknown>): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}.firma`;
}

describe("services/access-token → decisión de renovar", () => {
  it("lee el exp del token", () => {
    const exp = 1_800_000_000;
    expect(accessTokenExpiresAt(makeToken({ sub: "u1", exp }))).toBe(
      exp * 1000,
    );
  });

  it("no renueva un token que todavía tiene margen", () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    expect(shouldRefreshAccessToken(makeToken({ exp }))).toBe(false);
  });

  it("renueva un token vencido", () => {
    const exp = Math.floor(Date.now() / 1000) - 1;
    expect(shouldRefreshAccessToken(makeToken({ exp }))).toBe(true);
  });

  // El margen existe para que el token no expire en pleno vuelo entre el
  // chequeo del cliente y la validación del servidor.
  it("renueva un token que vence dentro del margen", () => {
    const exp = Math.floor(Date.now() / 1000) + 10;
    expect(shouldRefreshAccessToken(makeToken({ exp }))).toBe(true);
    expect(shouldRefreshAccessToken(makeToken({ exp }), 5_000)).toBe(false);
  });

  it.each([
    ["nada", null],
    ["vacío", ""],
    ["sin puntos", "no-es-un-jwt"],
    ["payload que no es base64", "a.!!!.c"],
    ["payload que no es JSON", `a.${btoa("no soy json")}.c`],
    ["payload sin exp", makeToken({ sub: "u1" })],
  ])("no puede leer el exp de un token %s, así que renueva", (_case, token) => {
    expect(accessTokenExpiresAt(token)).toBeNull();
    expect(shouldRefreshAccessToken(token)).toBe(true);
  });
});
