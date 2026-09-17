import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import { from, lastValueFrom, type Observable } from "rxjs";
import type { JwtPayload } from "../modules/auth/types";
import { WorkspaceAccessService } from "../modules/workspaces/workspace-access.service";
import { tenantContext } from "./tenant-context";

interface TenantRequest {
  params?: Record<string, string | undefined>;
  user?: JwtPayload;
}

/**
 * Establece el contexto de tenant para las rutas con `:workspaceId`.
 *
 * Valida la membresía (403/404) antes de ejecutar el handler y expone el rol
 * resuelto vía AsyncLocalStorage, de modo que los servicios no repitan la
 * consulta de autorización. Las rutas sin `:workspaceId` quedan sin contexto y,
 * por lo tanto, sin auto-scoping (admin, auth, notificaciones, cron, etc.).
 */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly access: WorkspaceAccessService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<TenantRequest>();
    const workspaceId = request.params?.workspaceId;
    const userId = request.user?.sub;
    if (!workspaceId || !userId) return next.handle();

    return from(
      this.access
        .assertMembership(workspaceId, userId)
        .then((member) =>
          tenantContext.run({ userId, workspaceId, role: member.role }, () =>
            lastValueFrom(next.handle()),
          ),
        ),
    );
  }
}
