import { describe, expect, it } from "vitest";
import {
  aiQuotaKey,
  lockoutBlockKey,
  lockoutCountKey,
  throttlerBlockKey,
  throttlerHitsKey,
} from "./redis-keys";

/**
 * El formato de las keys no es un detalle cosmético: son la frontera entre la
 * app y un store compartido. Una key mal formada no rompe nada visible hasta
 * que hay dos réplicas, y ahí el síntoma es "el rate limit no funciona" sin
 * ningún error que lo explique.
 */
describe("redis-keys", () => {
  describe("throttler", () => {
    it("agrupa hits y block en el mismo hash tag de Redis Cluster", () => {
      const hits = throttlerHitsKey("taskmaster", "abc123", "default");
      const block = throttlerBlockKey("taskmaster", "abc123", "default");

      // Un script Lua con varias keys exige que todas caigan en el mismo slot,
      // y el slot se determina por lo que hay entre las llaves.
      const slot = (key: string) =>
        key.slice(key.indexOf("{") + 1, key.indexOf("}"));
      expect(slot(hits)).toBe("abc123:default");
      expect(slot(block)).toBe(slot(hits));
    });

    it("separa limitadores distintos aunque coincida la key base", () => {
      const login = throttlerHitsKey("taskmaster", "abc123", "default");
      const ai = throttlerHitsKey("taskmaster", "abc123", "ai");

      expect(login).not.toBe(ai);
    });

    it("respeta el prefijo de entorno", () => {
      expect(throttlerHitsKey("staging", "abc123", "default")).toMatch(
        /^staging:rl:/,
      );
      expect(aiQuotaKey("staging", "u1", "2026-01-01")).toMatch(/^staging:ai:/);
    });
  });

  describe("lockout", () => {
    it("agrupa count y block en el mismo hash tag", () => {
      const count = lockoutCountKey("taskmaster", "deadbeef");
      const block = lockoutBlockKey("taskmaster", "deadbeef");

      const slot = (key: string) =>
        key.slice(key.indexOf("{") + 1, key.indexOf("}"));
      expect(slot(count)).toBe("deadbeef");
      expect(slot(block)).toBe(slot(count));
    });

    it("usa el hash del email, nunca el email en claro", () => {
      const email = "ana@example.com";
      const hash = "e3b0c44298fc1c149afbf4c8996fb924";

      expect(lockoutCountKey("taskmaster", hash)).toBe(
        `taskmaster:lockout:{${hash}}:count`,
      );
      expect(lockoutCountKey("taskmaster", hash)).not.toContain(email);
    });
  });

  describe("cuota diaria de IA", () => {
    it("incluye usuario y día local en la key", () => {
      expect(aiQuotaKey("taskmaster", "u1", "2026-01-31")).toBe(
        "taskmaster:ai:quota:u1:2026-01-31",
      );
    });

    it("distingue días distintos del mismo usuario", () => {
      expect(aiQuotaKey("taskmaster", "u1", "2026-01-31")).not.toBe(
        aiQuotaKey("taskmaster", "u1", "2026-02-01"),
      );
    });

    it("no lleva hash tag: el script solo toca una key", () => {
      expect(aiQuotaKey("taskmaster", "u1", "2026-01-31")).not.toContain("{");
    });
  });
});
