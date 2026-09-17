import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { WorkspacesModule } from "../modules/workspaces/workspaces.module";
import { TenantInterceptor } from "./tenant.interceptor";

/**
 * Registra el {@link TenantInterceptor} como interceptor global. Depende de
 * `WorkspacesModule` para reutilizar `WorkspaceAccessService` en la validación
 * de membresía previa a cada request con `:workspaceId`.
 */
@Module({
  imports: [WorkspacesModule],
  providers: [{ provide: APP_INTERCEPTOR, useClass: TenantInterceptor }],
})
export class TenantModule {}
