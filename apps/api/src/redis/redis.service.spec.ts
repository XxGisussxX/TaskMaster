import { Logger } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RedisService } from "./redis.service";

/**
 * Estos tests cubren la política de degradación de Redis, que es la parte con
 * consecuencias reales de esta fase:
 *
 *  - Al arrancar, fail-closed: si Redis no responde, la API no levanta. Se
 *    prueba de verdad, contra un puerto donde no hay nadie escuchando, para no
 *    depender de que haya un Redis en la máquina.
 *  - En runtime, fail-open: la operación cae al fallback y el estado queda
 *    marcado como degradado para `/health`.
 *  - El log de degradación no se inunda: loguea el primer fallo y después uno
 *    por minuto. Un Redis caído llenaría el disco si se logueara por request.
 */
function configFor(overrides: Record<string, unknown> = {}): ConfigService {
  const values: Record<string, unknown> = {
    REDIS_HOST: "127.0.0.1",
    REDIS_PORT: 1, // Puerto cerrado: ECONNREFUSED inmediato, sin esperar timeout.
    REDIS_DB: 0,
    REDIS_KEY_PREFIX: "taskmaster",
    ...overrides,
  };
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe("RedisService", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  let log: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    log = vi.spyOn(Logger.prototype, "log").mockImplementation(() => {});
    error = vi.spyOn(Logger.prototype, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("arranque", () => {
    it("no levanta si Redis no responde", async () => {
      const service = new RedisService(configFor());

      await expect(service.onModuleInit()).rejects.toThrow();

      // El mensaje tiene que decir qué hacer: el síntoma real de este fallo es
      // que nadie corrió `docker compose up`.
      expect(error).toHaveBeenCalledWith(
        expect.stringContaining("docker compose up -d redis"),
      );
    });

    it("no deja ningún cliente a medio ciclo de reconexión", async () => {
      const service = new RedisService(configFor());

      await expect(service.onModuleInit()).rejects.toThrow();

      // El chequeo de arranque usa un cliente descartable con las reconexiones
      // desactivadas, así que tras el fallo no queda ningún cliente apuntando a
      // Redis: ni timers de reconexión colgados ni un estado a medio
      // inicializar que después hay que debuggear. El acceso a `client` lo dice.
      expect(() => service.client).toThrow(/Redis no inicializado/);
      // Y el shutdown de un arranque fallido no debe romper.
      await expect(service.onModuleDestroy()).resolves.toBeUndefined();
    });
  });

  describe("conFallback", () => {
    it("devuelve el resultado de Redis cuando la operación funciona", async () => {
      const service = new RedisService(configFor());

      const result = await service.withFallback(
        async () => 42,
        () => -1,
        "test",
      );

      expect(result).toBe(42);
      expect(service.status.healthy).toBe(true);
    });

    it("cae al fallback cuando Redis lanza, sin propagar el error", async () => {
      const service = new RedisService(configFor());

      const result = await service.withFallback(
        async () => {
          throw new Error(
            "READONLY You can't write against a read only replica",
          );
        },
        () => "memoria",
        "throttler",
      );

      expect(result).toBe("memoria");
      expect(service.status.healthy).toBe(false);
      expect(service.status.lastError).toContain("READONLY");
      expect(service.status.degradedOperations).toBe(1);
    });

    it("registra el primer fallo como advertencia, no como error", async () => {
      const service = new RedisService(configFor());

      await service.withFallback(
        async () => {
          throw new Error("connection lost");
        },
        () => 0,
        "lockout",
      );

      // `error` está reservado para el fallo de arranque. En runtime la API
      // sigue sirviendo, así que la severidad correcta es `warn`.
      expect(error).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("lockout"));
    });

    it("cuenta las operaciones degradadas sin loguear cada una", async () => {
      const service = new RedisService(configFor());
      const fail = async () => {
        throw new Error("connection lost");
      };

      for (let i = 0; i < 50; i++) {
        await service.withFallback(fail, () => 0, "throttler");
      }

      // 1 aviso inicial + 0 repetidos dentro de la ventana de agrupamiento.
      expect(warn).toHaveBeenCalledTimes(1);
      expect(service.status.degradedOperations).toBe(50);
    });

    it("vuelve a marcar sano y avisa una vez tras recuperarse", async () => {
      const service = new RedisService(configFor());

      await service.withFallback(
        async () => {
          throw new Error("connection lost");
        },
        () => 0,
        "ai",
      );
      expect(service.status.healthy).toBe(false);

      await service.withFallback(
        async () => "ok",
        () => "memoria",
        "ai",
      );

      expect(service.status.healthy).toBe(true);
      expect(service.status.degradedSince).toBeUndefined();
      expect(service.status.lastError).toBeUndefined();
      expect(log).toHaveBeenCalledWith(
        expect.stringContaining("Redis recuperada"),
      );
    });

    it("no vuelve a loguear la recuperación si ya estaba sano", async () => {
      const service = new RedisService(configFor());

      await service.withFallback(
        async () => 1,
        () => 0,
        "ai",
      );
      await service.withFallback(
        async () => 2,
        () => 0,
        "ai",
      );

      expect(log).not.toHaveBeenCalledWith(
        expect.stringContaining("Redis recuperada"),
      );
    });
  });

  describe("configuración", () => {
    it("expone el prefijo de keys con default si no está configurado", () => {
      const service = new RedisService(
        configFor({ REDIS_KEY_PREFIX: undefined }),
      );
      expect(service.keyPrefix).toBe("taskmaster");
    });

    it("respeta un prefijo configurado", () => {
      const service = new RedisService(
        configFor({ REDIS_KEY_PREFIX: "staging" }),
      );
      expect(service.keyPrefix).toBe("staging");
    });
  });
});
