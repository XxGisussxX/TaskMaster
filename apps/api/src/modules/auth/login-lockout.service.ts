import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "node:crypto";
import { RedisService } from "../../redis/redis.service";
import { lockoutCountKey, lockoutBlockKey } from "../../redis/redis-keys";

export interface LockoutStatus {
  locked: boolean;
  retryAfterSeconds: number;
}

interface LockoutData {
  failures: number;
  firstFailureAt: number;
  lockedUntil: number;
}

/**
 * Bloqueo temporal por intentos fallidos de login (backed by Redis).
 *
 * Complementa al rate limit: el throttler frena por IP/email en una ventana
 * corta, esto frena la cuenta cuando los intentos vienen de muchas IPs
 * (credential stuffing distribuido), que es justo lo que el throttler no ve.
 *
 * Usa Redis con fallback en memoria (vía RedisService.withFallback) para que
 * el estado se comparta entre réplicas. Si Redis cae, degrada a contador
 * en memoria por proceso (comportamiento previo).
 */
@Injectable()
export class LoginLockoutService {
  private readonly logger = new Logger(LoginLockoutService.name);

  private readonly maxFailures: number;
  private readonly windowMs: number;
  private readonly lockMs: number;
  private readonly windowSeconds: number;
  private readonly lockSeconds: number;

  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {
    this.maxFailures = this.config.get<number>("LOGIN_MAX_FAILURES") ?? 5;
    this.windowSeconds =
      this.config.get<number>("LOGIN_FAIL_WINDOW_SECONDS") ?? 15 * 60;
    this.lockSeconds = this.config.get<number>("LOGIN_LOCK_SECONDS") ?? 15 * 60;
    this.windowMs = this.windowSeconds * 1000;
    this.lockMs = this.lockSeconds * 1000;
  }

  /** Clave por cuenta, hasheada: el email no debe quedar en memoria ni en logs. */
  private emailHash(email: string): string {
    return createHash("sha256")
      .update(email.trim().toLowerCase())
      .digest("hex");
  }

  private countKey(email: string): string {
    return lockoutCountKey(this.redis.keyPrefix, this.emailHash(email));
  }

  private blockKey(email: string): string {
    return lockoutBlockKey(this.redis.keyPrefix, this.emailHash(email));
  }

  async check(email: string): Promise<LockoutStatus> {
    const countKey = this.countKey(email);
    const blockKey = this.blockKey(email);

    return this.redis.withFallback(
      async () => {
        const client = this.redis.client;

        const [blocked, count] = await Promise.all([
          client.get(blockKey),
          client.get(countKey),
        ]);

        if (blocked) {
          const ttl = await client.ttl(blockKey);
          return {
            locked: true,
            retryAfterSeconds: Math.max(1, ttl),
          };
        }

        if (count) {
          const failures = parseInt(count, 10);
          if (failures >= this.maxFailures) {
            return {
              locked: true,
              retryAfterSeconds: this.lockSeconds,
            };
          }
        }

        return { locked: false, retryAfterSeconds: 0 };
      },
      () => ({ locked: false, retryAfterSeconds: 0 }),
      "login-lockout:check",
    );
  }

  async recordFailure(email: string): Promise<void> {
    const countKey = this.countKey(email);
    const blockKey = this.blockKey(email);

    await this.redis.withFallback(
      async () => {
        const client = this.redis.client;

        const existing = await client.get(countKey);

        if (!existing) {
          await client.set(countKey, "1", "EX", this.windowSeconds);
          return;
        }

        const failures = parseInt(existing, 10) + 1;

        if (failures >= this.maxFailures) {
          await client.set(
            blockKey,
            failures.toString(),
            "EX",
            this.lockSeconds,
          );
          await client.del(countKey);
          this.logger.warn(
            `Cuenta bloqueada ${this.lockSeconds}s por intentos fallidos (hash=${this.emailHash(email).slice(0, 12)})`,
          );
        } else {
          await client.set(
            countKey,
            failures.toString(),
            "EX",
            this.windowSeconds,
          );
        }
      },
      async () => {
        await this.recordFailureFallback(email);
      },
      "login-lockout:recordFailure",
    );
  }

  /** Login exitoso: limpia el contador para no castigar al usuario real. */
  async recordSuccess(email: string): Promise<void> {
    const countKey = this.countKey(email);
    const blockKey = this.blockKey(email);

    await this.redis.withFallback(
      async () => {
        const client = this.redis.client;
        await Promise.all([client.del(countKey), client.del(blockKey)]);
      },
      async () => {
        await this.recordSuccessFallback(email);
      },
      "login-lockout:recordSuccess",
    );
  }

  // Fallback en memoria (cuando Redis no disponible)
  private readonly fallbackBuckets = new Map<string, LockoutData>();

  private async recordFailureFallback(email: string): Promise<void> {
    const k = this.emailHash(email);
    const existing = this.fallbackBuckets.get(k);
    const now = Date.now();

    if (!existing || now - existing.firstFailureAt > this.windowMs) {
      this.fallbackBuckets.set(k, {
        failures: 1,
        firstFailureAt: now,
        lockedUntil: 0,
      });
      return;
    }

    existing.failures += 1;

    if (existing.failures >= this.maxFailures) {
      existing.lockedUntil = now + this.lockMs;
      this.logger.warn(
        `Cuenta bloqueada ${this.lockMs / 1000}s por intentos fallidos (hash=${k.slice(0, 12)}) [fallback memoria]`,
      );
    }
  }

  private async recordSuccessFallback(email: string): Promise<void> {
    this.fallbackBuckets.delete(this.emailHash(email));
  }
}
