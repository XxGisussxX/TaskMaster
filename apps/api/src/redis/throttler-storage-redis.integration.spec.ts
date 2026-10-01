import "reflect-metadata";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ConfigService } from "@nestjs/config";
import { RedisService } from "./redis.service";
import { ThrottlerStorageRedis } from "./throttler-storage-redis";

/**
 * Test de integración real contra Redis del script Lua del rate limit.
 *
 * La lógica del script no se puede probar en unit tests:ría una reimplementación
 * en JS del script, que probaría la copia y no el script. Acá se ejecuta contra
 * el Redis de verdad, que es donde viven los bugs caros: un corte de ventana
 * off-by-one, un reset de bloqueo que no resetea, y sobre todo la propiedad que
 * justifica la fase, que es que **dos réplicas comparten el mismo contador**.
 *
 * Usa la DB 9 (la que se limpia al terminar) para no pisar el Redis de
 * desarrollo. Se saltea con `ctx.skip()` si no hay Redis, igual que
 * `tenant-isolation.integration.spec.ts` con Postgres.
 *
 * Ejecutar en local: `pnpm --filter @taskmaster/api test` con Redis levantado.
 */

function readEnvValue(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  try {
    const contents = readFileSync(join(process.cwd(), ".env"), "utf8");
    const match = contents.match(
      new RegExp(`^\\s*${name}\\s*=\\s*(.+?)\\s*$`, "m"),
    );
    return match?.[1]?.replace(/^["']|["']$/g, "");
  } catch {
    return undefined;
  }
}

const HOST = readEnvValue("REDIS_HOST") ?? "localhost";
const PORT = Number(readEnvValue("REDIS_PORT") ?? 6379);

/** Corto para que los tests de ventana y bloqueo no tarden segundos. */
const TTL = 2_000;
const LIMIT = 3;
const BLOCK = 1_500;

let redisUp = false;
let redis: RedisService;

function buildService(): RedisService {
  return new RedisService({
    get: (key: string) =>
      ({ REDIS_HOST: HOST, REDIS_PORT: PORT, REDIS_DB: 9 })[key],
  } as unknown as ConfigService);
}

async function buildStorage(
  service: RedisService,
): Promise<ThrottlerStorageRedis> {
  const storage = new ThrottlerStorageRedis(service);
  storage.onModuleInit();
  return storage;
}

let counter = 0;
const nextKey = () => `k${Date.now().toString(36)}-${++counter}`;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

beforeAll(async () => {
  redis = buildService();
  try {
    await redis.onModuleInit();
    redisUp = true;
  } catch {
    redisUp = false;
  }
});

afterAll(async () => {
  if (!redisUp) return;
  await redis.client.flushdb();
  await redis.onModuleDestroy();
});

describe("ThrottlerStorageRedis (integración Redis real)", () => {
  it("el probe de arranque distingue Redis disponible de ausente", (ctx) => {
    if (!redisUp) {
      console.warn(
        `[redis] no responde en ${HOST}:${PORT}, se saltean los tests del script Lua`,
      );
      return ctx.skip();
    }
    expect(redis.status.healthy).toBe(true);
  });

  describe("ventana deslizante", () => {
    it("cuenta en orden y bloquea al superar el límite", async (ctx) => {
      if (!redisUp) return ctx.skip();
      const storage = await buildStorage(redis);
      const key = nextKey();

      const results = [];
      for (let i = 0; i < LIMIT + 1; i++) {
        results.push(
          await storage.increment(key, TTL, LIMIT, BLOCK, "default"),
        );
      }

      expect(results.map((r) => r.totalHits)).toEqual([1, 2, 3, 4]);
      expect(results.map((r) => r.isBlocked)).toEqual([
        false,
        false,
        false,
        true,
      ]);
    });

    it("no cuenta hits mientras está bloqueado", async (ctx) => {
      if (!redisUp) return ctx.skip();
      const storage = await buildStorage(redis);
      const key = nextKey();

      for (let i = 0; i <= LIMIT; i++) {
        await storage.increment(key, TTL, LIMIT, BLOCK, "default");
      }

      const during = await storage.increment(key, TTL, LIMIT, BLOCK, "default");
      expect(during.isBlocked).toBe(true);
      // Congelado: el total no crece mientras dura el bloqueo. El ZSET ya se
      // borró al bloquear, así que el valor sale de la key de bloqueo.
      expect(during.totalHits).toBe(LIMIT + 1);
    });

    it("deja salir los hits viejos de la ventana", async (ctx) => {
      if (!redisUp) return ctx.skip();
      const storage = await buildStorage(redis);
      const key = nextKey();

      await storage.increment(key, TTL, LIMIT, BLOCK, "default");
      await storage.increment(key, TTL, LIMIT, BLOCK, "default");

      await wait(TTL + 300);

      // Los dos hits anteriores cumplieron la ventana. Con una ventana fija
      // esto daría 3 y bloquearía.
      const after = await storage.increment(key, TTL, LIMIT, BLOCK, "default");
      expect(after.totalHits).toBe(1);
      expect(after.isBlocked).toBe(false);
    });

    it("timeToExpire dice cuándo vuelve a haber cupo", async (ctx) => {
      if (!redisUp) return ctx.skip();
      const storage = await buildStorage(redis);
      const key = nextKey();

      const first = await storage.increment(key, TTL, LIMIT, BLOCK, "default");
      // Con un solo hit, el cupo vuelve cuando ese hit salga de la ventana.
      expect(first.timeToExpire).toBeGreaterThan(0);
      expect(first.timeToExpire).toBeLessThanOrEqual(Math.ceil(TTL / 1000));

      await wait(Math.floor(TTL / 2));
      const second = await storage.increment(key, TTL, LIMIT, BLOCK, "default");
      // El hit más viejo sigue mandando, así que el reset se acerca.
      expect(second.timeToExpire).toBeLessThanOrEqual(first.timeToExpire);
    });
  });

  describe("bloqueo", () => {
    it("arranca de cero después de que expire el bloqueo", async (ctx) => {
      if (!redisUp) return ctx.skip();
      const storage = await buildStorage(redis);
      const key = nextKey();

      for (let i = 0; i <= LIMIT; i++) {
        await storage.increment(key, TTL, LIMIT, BLOCK, "default");
      }
      expect(
        (await storage.increment(key, TTL, LIMIT, BLOCK, "default")).isBlocked,
      ).toBe(true);

      await wait(BLOCK + 300);

      // Equivale al resetBlockedRequest del storage en memoria: contador a cero
      // y el request que rompe el bloqueo cuenta como 1.
      const after = await storage.increment(key, TTL, LIMIT, BLOCK, "default");
      expect(after.isBlocked).toBe(false);
      expect(after.totalHits).toBe(1);
    });

    it("timeToBlockExpire sirve como Retry-After", async (ctx) => {
      if (!redisUp) return ctx.skip();
      const storage = await buildStorage(redis);
      const key = nextKey();

      for (let i = 0; i <= LIMIT; i++) {
        await storage.increment(key, TTL, LIMIT, BLOCK, "default");
      }
      const blocked = await storage.increment(
        key,
        TTL,
        LIMIT,
        BLOCK,
        "default",
      );

      expect(blocked.isBlocked).toBe(true);
      expect(blocked.timeToBlockExpire).toBeGreaterThan(0);
      expect(blocked.timeToBlockExpire).toBeLessThanOrEqual(
        Math.ceil(BLOCK / 1000),
      );
    });
  });

  describe("hits simultáneos", () => {
    it("no cuenta dos requests en paralelo como uno solo", async (ctx) => {
      if (!redisUp) return ctx.skip();
      const storage = await buildStorage(redis);
      const key = nextKey();

      // Si el member no fuera único, el segundo ZADD actualizaría el score del
      // primero en vez de agregar, y el contador quedaría en 1.
      const [a, b] = await Promise.all([
        storage.increment(key, TTL, LIMIT, BLOCK, "default"),
        storage.increment(key, TTL, LIMIT, BLOCK, "default"),
      ]);

      expect([a.totalHits, b.totalHits].sort()).toEqual([1, 2]);
    });
  });

  describe("compartido entre réplicas", () => {
    it("dos instancias cuentan sobre el mismo contador", async (ctx) => {
      if (!redisUp) return ctx.skip();
      const replica = buildService();
      await replica.onModuleInit();

      try {
        const a = await buildStorage(redis);
        const b = await buildStorage(replica);
        const key = nextKey();

        const primero = await a.increment(key, TTL, LIMIT, BLOCK, "default");
        const segundo = await b.increment(key, TTL, LIMIT, BLOCK, "default");

        // La segunda réplica ve el hit de la primera. Este es el objetivo de la
        // fase: sin esto cada proceso tendría su propio contador.
        expect(primero.totalHits).toBe(1);
        expect(segundo.totalHits).toBe(2);
      } finally {
        await replica.onModuleDestroy();
      }
    });

    it("una réplica puede bloquear a la otra", async (ctx) => {
      if (!redisUp) return ctx.skip();
      const replica = buildService();
      await replica.onModuleInit();

      try {
        const a = await buildStorage(redis);
        const b = await buildStorage(replica);
        const key = nextKey();

        for (let i = 0; i < LIMIT; i++) {
          await a.increment(key, TTL, LIMIT, BLOCK, "default");
        }
        const bloqueado = await b.increment(key, TTL, LIMIT, BLOCK, "default");

        expect(bloqueado.isBlocked).toBe(true);
        expect(bloqueado.totalHits).toBe(LIMIT + 1);
      } finally {
        await replica.onModuleDestroy();
      }
    });

    it("el bloqueo de una réplica expira para la otra", async (ctx) => {
      if (!redisUp) return ctx.skip();
      const replica = buildService();
      await replica.onModuleInit();

      try {
        const a = await buildStorage(redis);
        const b = await buildStorage(replica);
        const key = nextKey();

        for (let i = 0; i <= LIMIT; i++) {
          await a.increment(key, TTL, LIMIT, BLOCK, "default");
        }

        await wait(BLOCK + 300);

        // La expiración la maneja el TTL de Redis, no un timer de Node: por eso
        // no hace falta que la réplica que bloqueó siga viva.
        const after = await b.increment(key, TTL, LIMIT, BLOCK, "default");
        expect(after.isBlocked).toBe(false);
        expect(after.totalHits).toBe(1);
      } finally {
        await replica.onModuleDestroy();
      }
    });
  });
});
