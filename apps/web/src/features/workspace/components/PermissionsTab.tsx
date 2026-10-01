import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, UsersRound } from "lucide-react";
import { WorkspaceRole } from "@taskmaster/contracts";
import { useCurrentMembership } from "../hooks/useMembers";
import { ROLE_LABELS } from "../lib/teamPermissions";

const ROLES = [
  WorkspaceRole.OWNER,
  WorkspaceRole.ADMIN,
  WorkspaceRole.MEMBER,
  WorkspaceRole.VIEWER,
] as const;

interface Capability {
  label: string;
  roles: Record<WorkspaceRole, boolean>;
}

const CAPABILITIES: Capability[] = [
  {
    label: "Ver tareas y notas",
    roles: {
      [WorkspaceRole.OWNER]: true,
      [WorkspaceRole.ADMIN]: true,
      [WorkspaceRole.MEMBER]: true,
      [WorkspaceRole.VIEWER]: true,
    },
  },
  {
    label: "Crear y editar tareas",
    roles: {
      [WorkspaceRole.OWNER]: true,
      [WorkspaceRole.ADMIN]: true,
      [WorkspaceRole.MEMBER]: true,
      [WorkspaceRole.VIEWER]: false,
    },
  },
  {
    label: "Gestionar miembros e invitaciones",
    roles: {
      [WorkspaceRole.OWNER]: true,
      [WorkspaceRole.ADMIN]: true,
      [WorkspaceRole.MEMBER]: false,
      [WorkspaceRole.VIEWER]: false,
    },
  },
  {
    label: "Modificar roles de administradores",
    roles: {
      [WorkspaceRole.OWNER]: true,
      [WorkspaceRole.ADMIN]: false,
      [WorkspaceRole.MEMBER]: false,
      [WorkspaceRole.VIEWER]: false,
    },
  },
  {
    label: "Renombrar o configurar el workspace",
    roles: {
      [WorkspaceRole.OWNER]: true,
      [WorkspaceRole.ADMIN]: true,
      [WorkspaceRole.MEMBER]: false,
      [WorkspaceRole.VIEWER]: false,
    },
  },
  {
    label: "Eliminar el workspace",
    roles: {
      [WorkspaceRole.OWNER]: true,
      [WorkspaceRole.ADMIN]: false,
      [WorkspaceRole.MEMBER]: false,
      [WorkspaceRole.VIEWER]: false,
    },
  },
];

export function PermissionsTab() {
  const { role } = useCurrentMembership();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <span>
          Tu rol en este workspace:
          {role ? (
            <Badge variant="secondary" className="ml-2">
              {ROLE_LABELS[role]}
            </Badge>
          ) : (
            <span className="ml-2">indefinido</span>
          )}
        </span>
      </div>

      <p className="text-sm">
        Estas reglas coinciden con los permisos que valida el backend en cada
        operación: la interfaz solo ofrece las acciones que tu rol puede
        ejecutar.
      </p>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-3 py-2.5 font-medium">
                Capacidad
              </th>
              {ROLES.map((r) => (
                <th
                  key={r}
                  scope="col"
                  className="px-3 py-2.5 text-center font-medium"
                >
                  {ROLE_LABELS[r]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CAPABILITIES.map((capability) => (
              <tr
                key={capability.label}
                className="border-b last:border-0 hover:bg-muted/40"
              >
                <td className="px-3 py-2.5">{capability.label}</td>
                {ROLES.map((r) => (
                  <td key={r} className="px-3 py-2.5 text-center">
                    <span
                      className={
                        capability.roles[r]
                          ? "text-success"
                          : "text-muted-foreground/50"
                      }
                      aria-hidden="true"
                    >
                      {capability.roles[r] ? "✓" : "—"}
                    </span>
                    <span className="sr-only">
                      {capability.roles[r] ? "Sí" : "No"}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UsersRound className="h-4 w-4" /> Grupos de permisos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Los grupos personalizados aún no existen en el backend. Hasta que
            lleguen, la gestión de acceso se define por los 4 roles del
            workspace (Propietario, Administrador, Miembro y Observador).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
