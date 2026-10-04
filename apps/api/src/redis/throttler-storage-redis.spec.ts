import type { ConfigService } from "@nestjs/config";
import { Logger } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RedisService } from "./redis.service";
import { ThrottlerStorageRedis } from "./throttler-storage-redis";

/**
 * Estos tests fijan el *cableado* del storage: qué keys manda, en qué orden
 * manda los argumentos, cómo interpreta la respuesta del script y qué pasa
 * cuando Redis no está.
 *
 * La lógica del script Lua en sí no se prueba acá, y es a propósito: probarla
 * necesitaría un Redis real o una reimplementación en JS del script, que
 * probaría la copia y no el script. Eso vive en
 * `throttler-storage-redis.integration.spec.ts`.
 */

type CommandArgs = (string | number)[];

interface FakeRedis {
  service: RedisService;
  /** Argumentos de cada llamada al script, en orden. */
  calls: CommandArgs[];
  /** Body del script registrado, para inspeccionarlo desde el test. */
  registered: { numberOfKeys?: number | null; lua?: string } | undefined;
  /** Veces que se llamó a `defineCommand`. */
  defineCalls: number;
}

/**
 * RedisService real (para ejercitar su `withFallback` de verdad) con un cliente
 * falso detrás. `connection` es privado porque normalmente lo arma
 * `onModuleInit`, que en un test exigiría un Redis que no hay.
 */
function fakeRedis(respond: (args: CommandArgs) => unknown): FakeRedis {
  const service = new RedisService({
    get: (key: string) =>
      ({
        REDIS_HOST: "localhost",
        REDIS_PORT: 6379,
        REDIS_KEY_PREFIX: "taskmaster",
      })[key],
  } as unknown as ConfigService);

  const calls: CommandArgs[] = [];
  let registered: FakeRedis["registered"];
  let defineCalls = 0;

  const client = {
    defineCommand(name: string, definition: FakeRedis["registered"]) {
      defineCalls += 1;
      registered = definition;
      (this as unknown as Record<string, unknown>)[name] = (
        ...args: CommandArgs
      ) => {
        calls.push(args);
        return Promise.resolve(respond(args));
      };
    },
  };

  (service as unknown as { connection: unknown }).connection = client;

  return {
    service,
    calls,
    get registered() {
      return registered;
    },
    get defineCalls() {
      return defineCalls;
    },
  };
}

function build(fake: FakeRedis): ThrottlerStorageRedis {
  return new ThrottlerStorageRedis(fake.service);
}

describe("ThrottlerStorageRedis", () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    vi.spyOn(Logger.prototype, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("registro del script", () => {
    it("lo registra una sola vez con 2 keys", async () => {
      const fake = fakeRedis(() => [1, 60, 0, 0]);
      const storage = new ThrottlerStorageRedis(fake.service);

      await storage.increment("k", 60_000, 120, 60_000, "default");
      await storage.increment("k", 60_000, 120, 60_000, "default");
      await storage.increment("k", 60_000, 120, 60_000, "default");

      expect(fake.defineCalls).toBe(1);
      expect(fake.registered?.numberOfKeys).toBe(2);
      // El nombre del comando tiene que ser el que el storage invoca: si uno de
      // los dos cambia, la llamada falla en runtime con "not a function".
      expect(fake.registered?.lua).toContain("ZREMRANGEBYSCORE");
    });
  });

  describe("argumentos del script", () => {
    it("usa las keys con el prefijo y el hash tag del tracker", async () => {
      const fake = fakeRedis(() => [1, 60, 0, 0]);

      await build(fake).increment("abc123", 60_000, 120, 60_000, "default");

      const [hitsKey, blockKey] = fake.calls[0]!;
      expect(hitsKey).toBe("taskmaster:rl:{abc123:default}:hits");
      expect(blockKey).toBe("taskmaster:rl:{abc123:default}:block");
    });

    it("pasa ttl, limit y blockDuration en ese orden", async () => {
      const fake = fakeRedis(() => [1, 60, 0, 0]);

      await build(fake).increment("k", 60_000, 120, 300_000, "default");

      // Positions 2..4 del comando: las dos keys van primero.
      expect(fake.calls[0]!.slice(2, 5)).toEqual([60_000, 120, 300_000]);
    });

    it("trunca los valores fraccionarios que puede dar un decorador", async () => {
      const fake = fakeRedis(() => [1, 60, 0, 0]);

      await build(fake).increment("k", 1000.7, 5.9, 2000.2, "default");

      // Redis rechaza un PX fraccionario, y `@Throttle` acepta números.
      expect(fake.calls[0]!.slice(2, 5)).toEqual([1000, 5, 2000]);
    });

    it("genera un member distinto por hit", async () => {
      const fake = fakeRedis(() => [1, 60, 0, 0]);
      const storage = build(fake);

      await storage.increment("k", 60_000, 120, 60_000, "default");
      await storage.increment("k", 60_000, 120, 60_000, "default");
      await storage.increment("k", 60_000, 120, 60_000, "default");

      // Un member repetido hace que el segundo ZADD actualice el primero en vez
      // de agregar, y el contador queda permanentemente corto.
      const members = fake.calls.map((call) => call[5]);
      expect(new Set(members).size).toBe(3);
      expect(members.every((m) => typeof m === "string" && m.length > 0)).toBe(
        true,
      );
    });

    it("mantiene el member único entre dos instancias del storage", async () => {
      const fake = fakeRedis(() => [1, 60, 0, 0]);

      // Dos réplicas del proceso. El token aleatorio por instancia es lo que
      // evita que sus contadores de secuencia choquen en el ZSET compartido.
      await build(fake).increment("k", 60_000, 120, 60_000, "default");
      await build(fake).increment("k", 60_000, 120, 60_000, "default");

      const members = fake.calls.map((call) => String(call[5]));
      expect(new Set(members).size).toBe(2);
    });
  });

  describe("interpretación de la respuesta", () => {
    it("traduce la tupla del script al record del guard", async () => {
      const fake = fakeRedis(() => [7, 42, 1, 90]);

      const record = await build(fake).increment(
        "k",
        60_000,
        120,
        300_000,
        "default",
      );

      expect(record).toEqual({
        totalHits: 7,
        timeToExpire: 42,
        isBlocked: true,
        timeToBlockExpire: 90,
      });
    });

    it("acepta strings numéricos", async () => {
      // RESP puede devolver enteros como string según el comando y la versión.
      const fake = fakeRedis(() => ["3", "60", "0", "0"]);

      const record = await build(fake).increment(
        "k",
        60_000,
        120,
        60_000,
        "default",
      );

      expect(record.totalHits).toBe(3);
      expect(record.isBlocked).toBe(false);
    });

    it("cae al fallback si la respuesta no tiene la forma esperada", async () => {
      const fake = fakeRedis(() => null);

      // No se propaga: un deploy a medio terminar no puede terminar bloqueando
      // todo el tráfico de la API.
      const record = await build(fake).increment(
        "k",
        60_000,
        120,
        60_000,
        "default",
      );

      expect(record.totalHits).toBe(1);
      expect(record.isBlocked).toBe(false);
    });

    it("cae al fallback si un valor viene como NaN", async () => {
      const fake = fakeRedis(() => [1, "NaN", 0, 0]);

      const record = await build(fake).increment(
        "k",
        60_000,
        120,
        60_000,
        "default",
      );

      expect(record.totalHits).toBe(1);
    });
  });

  describe("fallback en memoria", () => {
    it("usa el servicio en memoria cuando Redis tira", async () => {
      const fake = fakeRedis(() => {
        throw new Error("Connection is closed.");
      });

      const storage = build(fake);
      const record = await storage.increment("k", 60_000, 2, 60_000, "default");

      expect(record.totalHits).toBe(1);
      expect(record.isBlocked).toBe(false);
    });

    it("respeta el mismo límite que el storage por defecto", async () => {
      const fake = fakeRedis(() => {
        throw new Error("Connection is closed.");
      });
      const storage = build(fake);

      const first = await storage.increment("k", 60_000, 2, 60_000, "default");
      const second = await storage.increment("k", 60_000, 2, 60_000, "default");
      const third = await storage.increment("k", 60_000, 2, 60_000, "default");

      // Mismo comportamiento que antes de la fase: dos hits pasan, el tercero
      // bloquea. Es el criterio de equivalencia de la degradación.
      expect([first.totalHits, second.totalHits, third.totalHits]).toEqual([
        1, 2, 3,
      ]);
      expect([first.isBlocked, second.isBlocked, third.isBlocked]).toEqual([
        false,
        false,
        true,
      ]);
    });

    it("marca la degradación en el RedisService", async () => {
      const fake = fakeRedis(() => {
        throw new Error("Connection is closed.");
      });
      const storage = build(fake);

      await storage.increment("k", 60_000, 120, 60_000, "default");

      expect(fake.service.status.healthy).toBe(false);
      expect(fake.service.status.lastError).toContain("Connection is closed");
    });

    it("deja salir los hits viejos de la ventana, como el storage original", async () => {
      vi.useFakeTimers();
      try {
        const fake = fakeRedis(() => {
          throw new Error("Connection is closed.");
        });
        const storage = build(fake);

        const first = await storage.increment(
          "k",
          60_000,
          120,
          60_000,
          "default",
        );
        expect(first.totalHits).toBe(1);

        vi.advanceTimersByTime(60_001);

        // El hit anterior cumplió la ventana, así que el contador vuelve a 1. Si
        // el timer del fallback no se hubiera disparado, daría 2: es la
        // diferencia entre ventana deslizante y ventana fija.
        const second = await storage.increment(
          "k",
          60_000,
          120,
          60_000,
          "default",
        );
        expect(second.totalHits).toBe(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it("limpia los timers del fallback al apagar", async () => {
      const cleared = vi.spyOn(globalThis, "clearTimeout");
      const fake = fakeRedis(() => {
        throw new Error("Connection is closed.");
      });
      const storage = build(fake);

      await storage.increment("k", 60_000, 120, 60_000, "default");

      // El fallback en memoria usa un setTimeout por hit para simular la
      // ventana. Sin limpiarlos, un proceso que degradó a Redis no puede bajar:
      // los handles abiertos no lo dejan salir.
      storage.onApplicationShutdown();

      expect(cleared).toHaveBeenCalled();
    });
  });
});
