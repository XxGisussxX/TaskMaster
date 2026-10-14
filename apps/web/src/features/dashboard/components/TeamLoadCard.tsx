import { CircleDot, ListChecks, Sparkles, Users } from "lucide-react";
import { WorkspaceRole, type DashboardTeamLoad } from "@taskmaster/contracts";
import { useCurrentMembership } from "@/features/workspace/hooks/useMembers";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";

const ROLE_LABELS: Record<WorkspaceRole, string> = {
  [WorkspaceRole.OWNER]: "Propietario",
  [WorkspaceRole.ADMIN]: "Administrador",
  [WorkspaceRole.MEMBER]: "Miembro",
  [WorkspaceRole.VIEWER]: "Lector",
};

/**
 * Carga real por miembro del workspace.
 *
 * Los totales y el desglose por persona llegan del endpoint del dashboard (una
 * sola query compartida), no de un `useTasks({ pageSize: 200 })` propio. El
 * desglose por persona es una métrica por persona: el backend solo lo devuelve
 * a ADMIN/OWNER (`teamLoad.members`), así que para otros roles se muestra el
 * agregado con una nota.
 */
export function TeamLoadCard({ teamLoad }: { teamLoad?: DashboardTeamLoad }) {
  const user = useAuthStore((s) => s.user);
  const { role, isOwnerOrAdmin } = useCurrentMembership();

  const members = (teamLoad?.members ?? []).map((member) => ({
    ...member,
    currentUser: member.userId === user?.id,
  }));

  const maxOpen = Math.max(1, ...members.map((m) => m.open));
  const canManage = isOwnerOrAdmin || role === WorkspaceRole.OWNER;

  return (
    <div className="space-y-4">
      <p className="rounded-lg border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <Sparkles className="mr-1 inline h-3.5 w-3.5 align-text-bottom" />
        <span className="font-medium text-foreground">Sprint de equipo</span>:
        requiere una entidad Sprint en el backend (nombre, fechas, progreso por
        miembro). Mientras tanto, este bloque muestra la{" "}
        <span className="font-medium text-foreground">
          carga real por miembro
        </span>{" "}
        calculada con las tareas y quienes integran el workspace.
      </p>

      {teamLoad && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-muted/60 px-2 py-1 text-xs font-medium">
            <CircleDot className="h-3.5 w-3.5 text-primary" />
            {teamLoad.totalOpen} abiertas
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-muted/60 px-2 py-1 text-xs font-medium">
            <ListChecks className="h-3.5 w-3.5 text-success" />
            {teamLoad.totalCompleted} completadas
          </span>
          {teamLoad.unassignedOpen > 0 && (
            <span className="text-xs text-muted-foreground">
              {teamLoad.unassignedOpen} sin asignar
            </span>
          )}
        </div>
      )}

      {!teamLoad ? (
        <p className="text-sm text-muted-foreground">
          No se pudo cargar la carga del equipo.
        </p>
      ) : !teamLoad.members ? (
        <p className="text-sm text-muted-foreground">
          El desglose por persona está disponible para administradores y
          propietarios.
        </p>
      ) : members.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Sin miembros aún. Invita personas desde Workspace &amp; Team.
        </p>
      ) : (
        <ul className="space-y-3">
          {members.map((member) => (
            <li key={member.userId} className="flex items-center gap-3">
              <Avatar
                name={member.name}
                src={member.avatarUrl}
                className="h-8 w-8 text-[10px]"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">
                    {member.name}
                    {member.currentUser && " (tú)"}
                  </p>
                  {member.role && (
                    <Badge variant="secondary">
                      {ROLE_LABELS[member.role as WorkspaceRole]}
                    </Badge>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        member.open > 0
                          ? "bg-primary"
                          : "bg-muted-foreground/40",
                      )}
                      style={{
                        width: `${Math.round((member.open / maxOpen) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {member.open} abiertas · {member.completed} completadas
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!canManage && (
        <p className="text-[11px] text-muted-foreground">
          Solo administradores pueden gestionar el equipo y el futuro sprint.
        </p>
      )}

      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Users className="h-3.5 w-3.5" />
        Distribución basada en asignaciones de tareas reales.
      </p>
    </div>
  );
}
