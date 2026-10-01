import { useMemo } from "react";
import { CircleDot, ListChecks, Sparkles, Users } from "lucide-react";
import { WorkspaceRole } from "@taskmaster/contracts";
import { useTasks } from "@/features/tasks/hooks/useTasks";
import {
  useMembers,
  useCurrentMembership,
} from "@/features/workspace/hooks/useMembers";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import { computeTeamLoad } from "../lib/dashboardStats";

const ROLE_LABELS: Record<WorkspaceRole, string> = {
  [WorkspaceRole.OWNER]: "Propietario",
  [WorkspaceRole.ADMIN]: "Administrador",
  [WorkspaceRole.MEMBER]: "Miembro",
  [WorkspaceRole.VIEWER]: "Lector",
};

export function TeamLoadCard() {
  const user = useAuthStore((s) => s.user);
  const { data: tasksData } = useTasks({ pageSize: 200 });
  const { data: members = [] } = useMembers();
  const { role, isOwnerOrAdmin } = useCurrentMembership();

  const team = useMemo(
    () => computeTeamLoad(tasksData?.items ?? [], members, user?.id),
    [tasksData, members, user?.id],
  );

  const maxOpen = Math.max(1, ...team.members.map((m) => m.open));
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

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-muted/60 px-2 py-1 text-xs font-medium">
          <CircleDot className="h-3.5 w-3.5 text-primary" />
          {team.totalOpen} abiertas
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-md bg-muted/60 px-2 py-1 text-xs font-medium">
          <ListChecks className="h-3.5 w-3.5 text-success" />
          {team.totalCompleted} completadas
        </span>
        {team.unassignedOpen > 0 && (
          <span className="text-xs text-muted-foreground">
            {team.unassignedOpen} sin asignar
          </span>
        )}
      </div>

      {team.members.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Sin miembros aún. Invita personas desde Workspace &amp; Team.
        </p>
      ) : (
        <ul className="space-y-3">
          {team.members.map((member) => (
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
