import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import { createHash } from "node:crypto";

/**
 * Límite por identidad además del límite global por IP.
 *
 * El `ThrottlerGuard` global cuenta por IP, así que proteger solo eso deja una
 * vía de evasión trivial: con `trust proxy` mal configurado el visitante puede
 * rotar la entrada de X-Forwarded-For que la API toma como IP real y multiplicar
 * el límite. Y al revés, un atacante desde una IP fija (botnet, hosting) puede
 * probar muchos emails.
 *
 * Este guard cuenta por email hasheado, así el límite sigue valiendo aunque el
 * IP sea falsificable, y una campaña contra una cuenta queda contenida aunque
 * venga desde IPs distintas.
 *
 * El email se hashea porque la clave del limitador va a terminar en Redis
 * (Fase 2) y en logs: no queremos PII ahí.
 */
@Injectable()
export class EmailThrottleGuard extends ThrottlerGuard {
  override async getTracker(req: Record<string, any>): Promise<string> {
    const email = req.body?.email;
    if (typeof email !== "string" || email.length === 0) {
      // Sin email en el body (p.ej. refresh con token): cae al tracker por IP
      // del guard padre, que es lo que corresponde.
      return super.getTracker(req);
    }
    return createHash("sha256")
      .update(email.trim().toLowerCase())
      .digest("hex");
  }
}
