import { AsyncLocalStorage } from "node:async_hooks";
import type { WorkspaceRole } from "@taskmaster/contracts";

/**
 * Contexto del workspace activo para una request. Se establece en el
 * {@link TenantInterceptor} tras validar la membresía y se consume desde el
 * `$extends` de Prisma y desde `WorkspaceAccessService` para evitar consultas
 * de autorización repetidas por operación.
 */
export interface TenantContext {
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
}

const storage = new AsyncLocalStorage<TenantContext>();

export const tenantContext = {
  /** Ejecuta `fn` con el contexto de tenant indicado. */
  run<T>(context: TenantContext, fn: () => T): T {
    return storage.run(context, fn);
  },

  /** Devuelve el contexto de tenant activo, o `undefined` si no aplica. */
  get(): TenantContext | undefined {
    return storage.getStore();
  },
};
