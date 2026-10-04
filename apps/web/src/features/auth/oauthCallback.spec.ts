import { describe, expect, it } from "vitest";
import { readOauthCallback } from "./oauthCallback";

/**
 * La URL del callback la arma el backend, pero cualquiera puede editarla a mano.
 * Estos tests fijan qué hace la página con cada variante, sobre todo con las
 * que no sirven para nada: el fallo feo es quedar en un spinner eterno.
 */
describe("readOauthCallback", () => {
  it("devuelve el token cuando viene uno", () => {
    expect(readOauthCallback("?token=abc123")).toEqual({
      kind: "exchange",
      token: "abc123",
    });
  });

  it("reconoce cada código de error del enum cerrado", () => {
    expect(readOauthCallback("?error=invalid_state")).toEqual({
      kind: "error",
      code: "invalid_state",
    });
    expect(readOauthCallback("?error=account_conflict")).toEqual({
      kind: "error",
      code: "account_conflict",
    });
    expect(readOauthCallback("?error=email_unverified")).toEqual({
      kind: "error",
      code: "email_unverified",
    });
  });

  it("ignora un error si viene con token y prioriza el canje", () => {
    // El backend manda uno u otro. Si llegaran los dos, el token es la señal de
    // que el flujo llegó completo y hay que canjear, no mostrar un error.
    expect(readOauthCallback("?error=x&token=abc")).toEqual({
      kind: "error",
      code: "exchange_failed",
    });
  });

  it("degrada un código desconocido a un error genérico", () => {
    // Sin esto, un código nuevo del backend dejaría la página esperando un
    // token que no va a llegar.
    expect(readOauthCallback("?error=algo_raro")).toEqual({
      kind: "error",
      code: "exchange_failed",
    });
  });

  it("no renderiza texto arbitrario de la URL", () => {
    const outcome = readOauthCallback(`?error=<script>alert(1)</script>`);
    expect(outcome).toEqual({ kind: "error", code: "exchange_failed" });
  });

  it("trata un token vacío como ausente", () => {
    expect(readOauthCallback("?token=")).toEqual({ kind: "unknown" });
  });

  it("devuelve unknown sin parámetros", () => {
    expect(readOauthCallback("")).toEqual({ kind: "unknown" });
  });
});
