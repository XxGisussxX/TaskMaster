import { describe, expect, it } from "vitest";
import { parseOrigins, resolveCorsOptions } from "./cors";
import { validateEnv } from "./env.config";

const validSecrets = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  JWT_ACCESS_SECRET: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8",
};

describe("parseOrigins", () => {
  it("descarta entradas vacías y espacios", () => {
    expect(parseOrigins(" https://a.app , ,https://b.app ")).toEqual([
      "https://a.app",
      "https://b.app",
    ]);
  });

  it("devuelve lista vacía si no hay nada configurado", () => {
    expect(parseOrigins(undefined)).toEqual([]);
    expect(parseOrigins("")).toEqual([]);
  });
});

describe("resolveCorsOptions", () => {
  it("rechaza origins vacíos en cualquier entorno", () => {
    expect(() => resolveCorsOptions(undefined, "development")).toThrow(
      /CORS abierto no permitido/,
    );
    expect(() => resolveCorsOptions(" , ", "development")).toThrow(
      /CORS abierto no permitido/,
    );
  });

  it("rechaza CORS abierto en producción", () => {
    expect(() => resolveCorsOptions("*", "production")).toThrow(
      /CORS abierto no permitido/,
    );
    expect(() => resolveCorsOptions(undefined, "production")).toThrow(
      /CORS abierto no permitido/,
    );
    expect(() => resolveCorsOptions(" , ", "production")).toThrow(
      /CORS abierto no permitido/,
    );
  });

  it("habilita credentials cuando la lista es explícita", () => {
    expect(
      resolveCorsOptions("https://app.taskmaster.app", "production"),
    ).toEqual({
      origin: ["https://app.taskmaster.app"],
      credentials: true,
    });
  });
});

describe("validateEnv: CORS en producción", () => {
  it("rechaza API_ORIGINS='*' en producción", () => {
    expect(() =>
      validateEnv({
        ...validSecrets,
        NODE_ENV: "production",
        API_ORIGINS: "*",
      }),
    ).toThrow(/no puede ser '\*' en producción/);
  });

  it("rechaza API_ORIGINS vacío en producción", () => {
    expect(() =>
      validateEnv({ ...validSecrets, NODE_ENV: "production", API_ORIGINS: "" }),
    ).toThrow(/API_ORIGINS es obligatoria en producción/);
  });

  it("rechaza origins sin https en producción", () => {
    expect(() =>
      validateEnv({
        ...validSecrets,
        NODE_ENV: "production",
        API_ORIGINS: "http://app.taskmaster.app",
      }),
    ).toThrow(/debe usar https en producción/);
  });

  it("acepta una lista https válida en producción", () => {
    const env = validateEnv({
      ...validSecrets,
      NODE_ENV: "production",
      API_ORIGINS: "https://app.taskmaster.app, https://www.taskmaster.app",
      TRUST_PROXY: "1",
    });
    expect(env.API_ORIGINS).toContain("https://app.taskmaster.app");
  });

  it("sigue permitiendo '*' fuera de producción", () => {
    const env = validateEnv({
      ...validSecrets,
      NODE_ENV: "development",
      API_ORIGINS: "*",
    });
    expect(env.API_ORIGINS).toBe("*");
  });

  it("exige TRUST_PROXY >= 1 en producción", () => {
    expect(() =>
      validateEnv({
        ...validSecrets,
        NODE_ENV: "production",
        API_ORIGINS: "https://app.taskmaster.app",
        TRUST_PROXY: "0",
      }),
    ).toThrow(/TRUST_PROXY debe ser >= 1 en producción/);
  });
});

describe("validateEnv: TRUST_PROXY", () => {
  it("por defecto no confía en ningún proxy", () => {
    const env = validateEnv({ ...validSecrets });
    expect(env.TRUST_PROXY).toBe(0);
  });

  it("acepta un número explícito de proxies", () => {
    const env = validateEnv({ ...validSecrets, TRUST_PROXY: "1" });
    expect(env.TRUST_PROXY).toBe(1);
  });
});
