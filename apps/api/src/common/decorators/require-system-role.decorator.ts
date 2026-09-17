import { SetMetadata } from "@nestjs/common";
import { SystemRole } from "@taskmaster/contracts";

export const SYSTEM_ROLES_KEY = "system_roles";

/** Ruta protegida por rol de plataforma. El rol se valida contra la DB en cada request. */
export const RequireSystemRole = (...roles: SystemRole[]) =>
  SetMetadata(SYSTEM_ROLES_KEY, roles);
