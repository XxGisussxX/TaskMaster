import { WorkspaceRole, type WorkspaceMember } from "@taskmaster/contracts";

export const ROLE_LABELS: Record<WorkspaceRole, string> = {
  [WorkspaceRole.OWNER]: "Propietario",
  [WorkspaceRole.ADMIN]: "Administrador",
  [WorkspaceRole.MEMBER]: "Miembro",
  [WorkspaceRole.VIEWER]: "Observador",
};

export const ROLE_DESCRIPTIONS: Record<WorkspaceRole, string> = {
  [WorkspaceRole.OWNER]: "Control total del workspace",
  [WorkspaceRole.ADMIN]: "Gestiona miembros, roles e invitaciones",
  [WorkspaceRole.MEMBER]: "Crea y edita tareas del workspace",
  [WorkspaceRole.VIEWER]: "Solo lectura",
};

/** Roles que pueden escribir (crear/editar tareas). */
export const WRITE_ROLES: WorkspaceRole[] = [
  WorkspaceRole.OWNER,
  WorkspaceRole.ADMIN,
  WorkspaceRole.MEMBER,
];

export function canWrite(role: WorkspaceRole | null): boolean {
  return !!role && WRITE_ROLES.includes(role);
}

export function canManageMembers(role: WorkspaceRole | null): boolean {
  return role === WorkspaceRole.OWNER || role === WorkspaceRole.ADMIN;
}

/**
 * ¿Puede `actor` modificar el rol de `target`?
 * Espejo del guard del backend (`workspaces.service.ts`): nadie toca al
 * propietario; solo el propietario toca a un ADMIN.
 */
export function canChangeRoleOf(
  actor: WorkspaceRole | null,
  target: Pick<WorkspaceMember, "role">,
): boolean {
  if (!actor) return false;
  if (actor !== WorkspaceRole.OWNER && actor !== WorkspaceRole.ADMIN) {
    return false;
  }
  if (target.role === WorkspaceRole.OWNER) return false;
  if (target.role === WorkspaceRole.ADMIN) {
    return actor === WorkspaceRole.OWNER;
  }
  return true;
}

/**
 * ¿Puede `actor` eliminar a `target`? Espejo del backend: nadie se elimina a
 * sí mismo, nadie elimina al propietario, y solo el propietario a un ADMIN.
 */
export function canRemoveMember(
  actor: WorkspaceRole | null,
  target: Pick<WorkspaceMember, "role" | "userId">,
  currentUserId: string,
): boolean {
  if (!actor) return false;
  if (target.userId === currentUserId) return false;
  if (!canManageMembers(actor)) return false;
  if (target.role === WorkspaceRole.OWNER) return false;
  if (target.role === WorkspaceRole.ADMIN) {
    return actor === WorkspaceRole.OWNER;
  }
  return true;
}

/** Roles que `actor` puede asignarle a un miembro con el rol `targetRole`. */
export function roleOptionsFor(
  actor: WorkspaceRole | null,
  targetRole: WorkspaceRole,
): WorkspaceRole[] {
  if (!actor || !canChangeRoleOf(actor, { role: targetRole })) return [];
  if (actor === WorkspaceRole.OWNER) {
    return [
      WorkspaceRole.OWNER,
      WorkspaceRole.ADMIN,
      WorkspaceRole.MEMBER,
      WorkspaceRole.VIEWER,
    ];
  }
  return [WorkspaceRole.ADMIN, WorkspaceRole.MEMBER, WorkspaceRole.VIEWER];
}

function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Filtro por texto y rol usado en la tabla de miembros (insensible a acentos). */
export function filterMembers(
  members: WorkspaceMember[],
  query: { search?: string; role?: WorkspaceRole | "ALL" },
): WorkspaceMember[] {
  const q = fold(query.search ?? "");
  const role = query.role ?? "ALL";

  return members.filter((member) => {
    if (role !== "ALL" && member.role !== role) return false;
    if (!q) return true;
    const name = fold(member.user?.name ?? "");
    const email = fold(member.user?.email ?? "");
    return name.includes(q) || email.includes(q);
  });
}
