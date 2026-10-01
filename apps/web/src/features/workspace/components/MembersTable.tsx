import { useMemo, useState } from "react";
import { AlertTriangle, Search, Trash2, UserRoundPlus } from "lucide-react";
import { WorkspaceRole, type WorkspaceMember } from "@taskmaster/contracts";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useAuthStore } from "@/store/auth.store";
import { useUpdateMemberRole, useRemoveMember } from "../hooks/useMembers";
import {
  canChangeRoleOf,
  canManageMembers,
  canRemoveMember,
  filterMembers,
  roleOptionsFor,
  ROLE_LABELS,
} from "../lib/teamPermissions";

function MemberSince({ createdAt }: { createdAt?: string }) {
  if (!createdAt) return <span className="text-muted-foreground">—</span>;
  const formatted = new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
  }).format(new Date(createdAt));
  return <span className="tabular-nums">{formatted}</span>;
}

export function MembersTable({
  members,
  isLoading,
  isError,
  onInvite,
}: {
  members: WorkspaceMember[];
  isLoading: boolean;
  isError: boolean;
  onInvite?: () => void;
}) {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<WorkspaceRole | "ALL">("ALL");

  const actorMember = members.find((m) => m.userId === currentUserId);
  const actorRole = actorMember?.role ?? null;
  const canManage = canManageMembers(actorRole);

  const filtered = useMemo(
    () => filterMembers(members, { search, role: roleFilter }),
    [members, search, roleFilter],
  );

  const updateRole = useUpdateMemberRole();
  const removeMember = useRemoveMember();
  const busy = updateRole.isPending || removeMember.isPending;

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="No se pudieron cargar los miembros"
        description="Verifica que el workspace esté disponible e inténtalo de nuevo."
      />
    );
  }

  if (members.length === 0) {
    return (
      <EmptyState
        icon={UserRoundPlus}
        title="Sin miembros todavía"
        description="Invita a tu equipo para empezar a trabajar juntos."
        action={
          onInvite ? (
            <Button onClick={onInvite}>
              <UserRoundPlus className="h-4 w-4" />
              Invitar miembro
            </Button>
          ) : undefined
        }
      />
    );
  }

  const handleRoleChange = (memberId: string, role: string) => {
    updateRole.mutate({ memberId, role });
  };

  const handleRemove = (member: WorkspaceMember) => {
    if (
      window.confirm(
        `¿Eliminar a ${member.user?.name ?? "este miembro"} del workspace?`,
      )
    ) {
      removeMember.mutate(member.id);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-64 flex-1 space-y-1">
          <Label htmlFor="members-search" className="text-xs">
            Buscar miembro
          </Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="members-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nombre o email..."
              className="pl-8"
            />
          </div>
        </div>
        <div className="w-44 space-y-1">
          <Label htmlFor="members-role-filter" className="text-xs">
            Rol
          </Label>
          <Select
            id="members-role-filter"
            value={roleFilter}
            onChange={(e) =>
              setRoleFilter(e.target.value as WorkspaceRole | "ALL")
            }
          >
            <option value="ALL">Todos los roles</option>
            {Object.values(WorkspaceRole).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-3 py-2.5 font-medium">
                Miembro
              </th>
              <th scope="col" className="px-3 py-2.5 font-medium">
                Rol
              </th>
              <th scope="col" className="px-3 py-2.5 font-medium">
                Miembro desde
              </th>
              {canManage && (
                <th scope="col" className="px-3 py-2.5 text-right font-medium">
                  Acciones
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.map((member) => {
              const isSelf = member.userId === currentUserId;
              const editable = canChangeRoleOf(actorRole, member);
              const removable = canRemoveMember(
                actorRole,
                member,
                currentUserId ?? "",
              );
              return (
                <tr
                  key={member.id}
                  className="border-b last:border-0 hover:bg-muted/40"
                >
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <Avatar
                        name={member.user?.name ?? "U"}
                        src={member.user?.avatarUrl}
                        className="h-8 w-8 text-[10px]"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {member.user?.name ?? "Usuario"}
                          {isSelf && (
                            <span className="ml-1 text-xs text-muted-foreground">
                              (tú)
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {member.user?.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    {editable ? (
                      <Select
                        value={member.role}
                        onChange={(e) =>
                          handleRoleChange(member.id, e.target.value)
                        }
                        className="w-40"
                        disabled={busy}
                        aria-label={`Rol de ${member.user?.name ?? "miembro"}`}
                      >
                        {roleOptionsFor(actorRole, member.role).map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <Badge variant="secondary">
                        {ROLE_LABELS[member.role]}
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    <MemberSince createdAt={member.createdAt} />
                  </td>
                  {canManage && (
                    <td className="px-3 py-2.5 text-right">
                      {removable && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title={`Eliminar a ${member.user?.name ?? "miembro"}`}
                          disabled={busy}
                          onClick={() => handleRemove(member)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <EmptyState
          icon={Search}
          title="Sin coincidencias"
          description="Ningún miembro coincide con la búsqueda o el filtro de rol."
        />
      )}

      {filtered.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          {filtered.length} de {members.length} miembros ·{" "}
          {canManage
            ? "Puedes cambiar roles y eliminar miembros según tus permisos."
            : "Solo administradores pueden modificar roles o eliminar miembros."}
        </p>
      )}

      <p className="rounded-md border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        El rol de propietario solo puede gestionarlo el propio propietario.
        Estas reglas se validan también en el backend.
      </p>
    </div>
  );
}
