import { Injectable, type OnApplicationShutdown } from "@nestjs/common";
import {
  ThrottlerStorageService,
  type ThrottlerStorage,
} from "@nestjs/throttler";
import { randomBytes } from "node:crypto";
import type { Result } from "ioredis";
import { throttlerBlockKey, throttlerHitsKey } from "./redis-keys";
import { RedisService } from "./redis.service";

/**
 * Lo que el `ThrottlerGuard` espera de vuelta de `increment`.
 *
 * Se redeclara acá en vez de importarse porque `@nestjs/throttler` no re-exporta
 * `ThrottlerStorageRecord` desde su índice: está en un archivo interno al que
 * solo se llega por ruta profunda, que no es una API pública. Son cuatro campos
 * que el guard solo lee, y el compilador los valida igual contra la firma de
 * `ThrottlerStorage`.
 */
interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

/**
 * Rate limit por ventana deslizante, compartido entre réplicas.
 *
 * Un ZSET por limitador guarda un member por hit, con score = instante del
 * request. Contar es `ZREMRANGEBYSCORE` (lo que ya salió de la ventana) más
 * `ZCARD`. Da la ventana deslizante exacta que usa `ThrottlerStorageService`
 * implementando con un `setTimeout` por hit, que además no sobrevive al restart
 * ni se comparte entre procesos.
 *
 * Todo el cálculo va en un script Lua por dos razones: leer, decidir y escribir
 * tiene que ser atómico (dos requests simultáneos sobre `limit` no pueden ver
 * ambos `totalHits === limit` y dejar pasar al que ya pasó), y el reloj tiene que
 * ser el de Redis (con relojes de réplica desalineados, la ventana se cortaría
 * en un punto distinto en cada nodo).
 *
 * `EVALSHA` en vez de `EVAL` porque esto corre en *cada* request: mandar el
 * cuerpo del script entero en cada llamada suma ~1.5 KB por request. ioredis
 * resuelve solo el NOSCRIPT cuando Redis reinició y borró la caché de scripts.
 *
 * El script usa `TIME`, que es no determinista, y a continuación escribe. Eso
 * requiere *effect replication*, que es el modo por defecto desde Redis 5 y el
 * único soportado en Redis 7 (docker-compose usa `redis:7-alpine`). En un Redis
 * 5/6 configurado a mano con `lua-replicate-commands no` el script fallaría con
 * "Write commands not allowed after non deterministic commands"; en ese caso el
 * error cae al contador en memoria y la app sigue sirviendo, pero conviene
 * saber que el rate limit pasó a ser por proceso.
 */
const RATE_LIMIT_LUA = `
local hitsKey = KEYS[1]
local blockKey = KEYS[2]
local ttl = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local blockMs = tonumber(ARGV[3])
local member = ARGV[4]

-- Redis rechaza PX 0, y un TTL de 0 dejaría la ventana vacía para siempre.
if ttl < 1 then ttl = 1 end
if blockMs < 1 then blockMs = 1 end

local clock = redis.call('TIME')
local nowMs = (tonumber(clock[1]) * 1000) + math.floor(tonumber(clock[2]) / 1000)

-- 1) Sigue bloqueado. El valor es el totalHits congelado al bloquear, para no
--    reportar 0 hits en un tracker que en realidad está excedido.
local frozen = redis.call('GET', blockKey)
if frozen then
  local remaining = math.ceil(redis.call('PTTL', blockKey) / 1000)
  return { tonumber(frozen), remaining, 1, remaining }
end

-- 2) Poda: fuera los hits que ya cumplieron la ventana. El corte es inclusivo
--    porque un hit de hace exactamente 'ttl' ya no cuenta.
redis.call('ZREMRANGEBYSCORE', hitsKey, '-inf', nowMs - ttl)

-- 3) Cuenta el hit actual.
redis.call('ZADD', hitsKey, nowMs, member)
local totalHits = redis.call('ZCARD', hitsKey)

if totalHits > limit then
  redis.call('SET', blockKey, totalHits, 'PX', blockMs)
  -- El servicio en memoria hace resetBlockedRequest al desbloquear: borra el
  -- contador entero. Borrar el ZSET ahora deja el mismo estado final y libera la
  -- memoria en el acto en vez de esperar a que los members envejezcan.
  redis.call('DEL', hitsKey)
  return { totalHits, math.ceil(blockMs / 1000), 1, math.ceil(blockMs / 1000) }
end

-- 4) timeToExpire: cuándo vuelve a haber cupo, o sea cuando expira el hit más
--    viejo. En memoria este valor es el TTL del bucket, que no significa nada
--    útil; acá alimenta X-RateLimit-Reset con la respuesta correcta.
local oldest = redis.call('ZRANGE', hitsKey, 0, 0, 'WITHSCORES')
local timeToExpire = math.ceil(((tonumber(oldest[2]) + ttl) - nowMs) / 1000)

return { totalHits, timeToExpire, 0, 0 }
`;

declare module "ioredis" {
  interface RedisCommander<Context> {
    rateLimitIncrement(
      this: import("ioredis").Redis,
      ...args: (string | number)[]
    ): Result<unknown, Context>;
  }
}

/** Nombre con el que se registra el script en el cliente. */
const COMMAND = "rateLimitIncrement";

/**
 * Interpreta la respuesta del script.
 *
 * Una respuesta con otra forma significa que el script y el cliente no están de
 * acuerdo (un deploy a medio terminar, un Redis compatible que no devuelve lo
 * mismo). Lanza para que `withFallback` caiga al contador en memoria: bloquear
 * todo el tráfico por una desalineación de protocolo es peor que contar mal
 * durante un rato.
 */
function toRecord(raw: unknown): ThrottlerStorageRecord {
  if (!Array.isArray(raw) || raw.length < 4) {
    throw new Error(
      `Respuesta inesperada del script de rate limit: ${JSON.stringify(raw)}`,
    );
  }

  return {
    totalHits: toNumber(raw[0]),
    timeToExpire: toNumber(raw[1]),
    isBlocked: toNumber(raw[2]) === 1,
    timeToBlockExpire: toNumber(raw[3]),
  };
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(
      `Valor no numérico en la respuesta de rate limit: ${value}`,
    );
  }
  return parsed;
}

@Injectable()
export class ThrottlerStorageRedis
  implements ThrottlerStorage, OnApplicationShutdown
{
  /**
   * Contador en memoria con la misma semántica que el script, para cuando Redis
   * no está disponible. Es el comportamiento previo a esta fase: el límite pasa
   * a valer por proceso en vez de por cluster.
   */
  private readonly fallback = new ThrottlerStorageService();

  /**
   * Identificador único de este proceso dentro del member del ZSET.
   *
   * Los members de un ZSET tienen que ser únicos: si dos hits shared member, el
   * segundo `ZADD` actualiza el score del primero en vez de agregar, y el
   * contador subestima. Como el script corre atómicamente, la única chance de
   * colisión es que dos requests caigan en el mismo milisegundo.
   *
   * Un contador monotónico evita las colisiones dentro del proceso (el `++` es
   * síncrono en el event loop). Entre réplicas hace falta además el token
   * aleatorio, porque dos procesos distintos pueden tener el mismo número de
   * secuencia.
   */
  private readonly processToken = randomBytes(6).toString("hex");
  private sequence = 0;

  private commandRegistered = false;

  constructor(private readonly redis: RedisService) {}

  /**
   * Registra el script en el cliente compartido la primera vez que se usa.
   *
   * No puede hacerse en `onModuleInit`: este storage se instancia desde
   * `ThrottlerModule.forRootAsync` y Nest ejecuta los hooks en orden de módulos,
   * así que corría antes que `RedisService.onModuleInit`; esperar `whenReady()`
   * ahí colgaba el arranque y el event loop se vaciaba sin error. En `increment`
   * el cliente ya existe: la app no atiende requests hasta terminar el arranque.
   */
  private ensureCommand(): void {
    if (this.commandRegistered) return;
    this.redis.client.defineCommand(COMMAND, {
      numberOfKeys: 2,
      lua: RATE_LIMIT_LUA,
    });
    this.commandRegistered = true;
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const prefix = this.redis.keyPrefix;
    // El `key` que manda el throttler ya es un sha256 de
    // (clase-handler-nombre-tracker), así que no contiene PII y dos limitadores
    // distintos nunca colisionan.
    const hitsKey = throttlerHitsKey(prefix, key, throttlerName);
    const blockKey = throttlerBlockKey(prefix, key, throttlerName);

    return this.redis.withFallback(
      async () => {
        this.ensureCommand();
        const client = this.redis.client as RedisWithRateLimit;
        const raw = await client[COMMAND](
          hitsKey,
          blockKey,
          Math.trunc(ttl),
          Math.trunc(limit),
          Math.trunc(blockDuration),
          `${this.processToken}:${++this.sequence}`,
        );
        return toRecord(raw);
      },
      () =>
        this.fallback.increment(key, ttl, limit, blockDuration, throttlerName),
      "throttler",
    );
  }

  onApplicationShutdown(): void {
    // El fallback en memoria usa un `setTimeout` por hit para simular la ventana
    // deslizante. Esos timers son handles abiertos: sin limpiarlos, un arranque
    // que haya degrading a Redis deja el proceso sin poder bajar.
    this.fallback.onApplicationShutdown();
  }
}

type RedisWithRateLimit = import("ioredis").Redis & {
  [COMMAND]: (...args: (string | number)[]) => Promise<unknown>;
};
