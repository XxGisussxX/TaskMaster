import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron } from "@nestjs/schedule";
import { createHash } from "node:crypto";

interface Bucket {
  failures: number;
  firstFailureAt: number;
  lockedUntil: number;
}

export interface LockoutStatus {
  locked: boolean;
  retryAfterSeconds: number;
}

/**
 * Bloqueo temporal por intentos fallidos de login.
 *
 * Complementa al rate limit: el throttler frena por IP/email en una ventana
 * corta, esto frena la cuenta cuando los intentos vienen de muchas IPs
 * (credential stuffing distribuido), que es justo lo que el throttler no ve.
 *
 * Deliberadamente en memoria: el estado es de un solo proceso y se pierde al
 * reiniciar, que es el trade-off aceptable (un restart no debe abrir la puerta).
 * La Fas2 mueve el storage del throttler a Redis; este contador migra con él si
 * hace falta. Con una sola réplica (docker-compose de la Fas3) no hay divergencia.
 */
@Injectable()
export class LoginLockoutService {
  private readonly logger = new Logger(LoginLockoutService.name);
  private readonly buckets = new Map<string, Bucket>();

  private readonly maxFailures: number;
  private readonly windowMs: number;
  private readonly lockMs: number;

  constructor(private readonly config: ConfigService) {
    this.maxFailures = this.config.get<number>("LOGIN_MAX_FAILURES") ?? 5;
    this.windowMs =
      (this.config.get<number>("LOGIN_FAIL_WINDOW_SECONDS") ?? 15 * 60) * 1000;
    this.lockMs =
      (this.config.get<number>("LOGIN_LOCK_SECONDS") ?? 15 * 60) * 1000;
  }

  /** Clave por cuenta, hasheada: el email no debe quedar en memoria ni en logs. */
  private key(email: string): string {
    return createHash("sha256")
      .update(email.trim().toLowerCase())
      .digest("hex");
  }

  check(email: string): LockoutStatus {
    const bucket = this.buckets.get(this.key(email));
    if (!bucket) return { locked: false, retryAfterSeconds: 0 };

    if (bucket.lockedUntil > Date.now()) {
      return {
        locked: true,
        retryAfterSeconds: Math.ceil((bucket.lockedUntil - Date.now()) / 1000),
      };
    }

    // La ventana de conteo expiró y no hay bloqueo: el próximo fallo reinicia.
    if (Date.now() - bucket.firstFailureAt > this.windowMs) {
      this.buckets.delete(this.key(email));
    }

    return { locked: false, retryAfterSeconds: 0 };
  }

  recordFailure(email: string): void {
    const k = this.key(email);
    const now = Date.now();
    const existing = this.buckets.get(k);

    if (!existing || now - existing.firstFailureAt > this.windowMs) {
      this.buckets.set(k, { failures: 1, firstFailureAt: now, lockedUntil: 0 });
      return;
    }

    existing.failures += 1;

    if (existing.failures >= this.maxFailures) {
      existing.lockedUntil = now + this.lockMs;
      this.logger.warn(
        `Cuenta bloqueada ${this.lockMs / 1000}s por intentos fallidos (hash=${k.slice(0, 12)})`,
      );
    }
  }

  /** Login exitoso: limpia el contador para no castigar al usuario real. */
  recordSuccess(email: string): void {
    this.buckets.delete(this.key(email));
  }

  /** Purga periódica para que el Map no crezca sin límite. */
  @Cron("0 */10 * * * *")
  purgeExpired(): void {
    const removed = this.prune();
    if (removed > 0) {
      this.logger.debug(`Lockout: ${removed} buckets expirados purgados`);
    }
  }

  /** Purga buckets expirados. Devuelve cuántos eliminó. */
  prune(): number {
    const now = Date.now();
    let removed = 0;
    for (const [k, bucket] of this.buckets) {
      if (bucket.lockedUntil <= now && now - bucket.firstFailureAt > this.windowMs) {
        this.buckets.delete(k);
        removed += 1;
      }
    }
    return removed;
  }
}