import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

/**
 * Límite de IA por usuario y workspace, no por IP.
 *
 * El `ThrottlerGuard` global cuenta por IP, que para IA es el tracker
 * equivocado: una oficina detrás de NAT comparte una IP y sus miembros se
 * frenan entre sí, mientras que un mismo usuario evadiendo desde otra red no
 * arrastra su propio límite. Este guard corre a nivel de controlador (después
 * del `JwtAuthGuard` global, así que `req.user` ya está resuelto) y usa
 * `userId:workspaceId` como clave.
 *
 * No reemplaza al límite por IP: el guard global sigue aplicando el suyo, con
 * la misma metadata `@Throttle`. Son dos contadores independientes y el que
 * corta primero gana.
 */
@Injectable()
export class AiThrottleGuard extends ThrottlerGuard {
  override async getTracker(req: Record<string, any>): Promise<string> {
    const userId = req.user?.sub;
    if (typeof userId === "string" && userId.length > 0) {
      const workspaceId = req.params?.workspaceId ?? "";
      return `${userId}:${workspaceId}`;
    }
    // Sin sesión resuelta (no debería pasar en un endpoint autenticado): cae al
    // tracker por IP del guard padre.
    return super.getTracker(req);
  }
}
