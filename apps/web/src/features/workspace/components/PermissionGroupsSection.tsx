import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2, UserPlus, UsersRound } from "lucide-react";
import {
  WorkspaceRole,
  type PermissionGroupWithMembers,
} from "@taskmaster/contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useMembers, useCurrentMembership } from "../hooks/useMembers";
import {
  useAssignPermissionGroupMembers,
  useCreatePermissionGroup,
  useDeletePermissionGroup,
  usePermissionGroups,
  useUpdatePermissionGroup,
} from "../hooks/usePermissionGroups";
import {
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  canManageMembers,
} from "../lib/teamPermissions";

const GROUP_COLORS = [
  "#6366f1",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
] as const;

const ROLES = [
  WorkspaceRole.ADMIN,
  WorkspaceRole.MEMBER,
  WorkspaceRole.VIEWER,
] as const;

interface GroupFormState {
  id?: string;
  name: string;
  description: string;
  color: string;
  role: WorkspaceRole;
}

const EMPTY_FORM: GroupFormState = {
  name: "",
  description: "",
  color: GROUP_COLORS[0],
  role: WorkspaceRole.MEMBER,
};

export function PermissionGroupsSection() {
  const {
    data: groups = [],
    isLoading,
    isError,
    refetch,
  } = usePermissionGroups();
  const { data: members = [] } = useMembers();
  const { role } = useCurrentMembership();
  const canManage = canManageMembers(role);

  const createGroup = useCreatePermissionGroup();
  const updateGroup = useUpdatePermissionGroup();
  const deleteGroup = useDeletePermissionGroup();
  const assignMembers = useAssignPermissionGroupMembers();

  const [form, setForm] = useState<GroupFormState | null>(null);
  const [memberTarget, setMemberTarget] =
    useState<PermissionGroupWithMembers | null>(null);
  const [memberSelection, setMemberSelection] = useState<string[]>([]);

  const memberOptions = useMemo(
    () =>
      members.map((m) => ({
        value: m.userId,
        label: m.user?.name ?? m.user?.email ?? m.userId,
      })),
    [members],
  );

  const openCreate = () => setForm({ ...EMPTY_FORM });
  const openEdit = (group: PermissionGroupWithMembers) =>
    setForm({
      id: group.id,
      name: group.name,
      description: group.description,
      color: group.color,
      role: group.role,
    });

  const openMembers = (group: PermissionGroupWithMembers) => {
    setMemberTarget(group);
    setMemberSelection(group.members.map((m) => m.userId));
  };

  const submitForm = () => {
    if (!form) return;
    const name = form.name.trim();
    if (name.length < 2) return;
    const input = {
      name,
      description: form.description.trim(),
      color: form.color,
      role: form.role,
    };
    if (form.id) {
      updateGroup.mutate(
        { groupId: form.id, input },
        { onSuccess: () => setForm(null) },
      );
    } else {
      createGroup.mutate(input, { onSuccess: () => setForm(null) });
    }
  };

  const submitMembers = () => {
    if (!memberTarget) return;
    assignMembers.mutate(
      { groupId: memberTarget.id, memberIds: memberSelection },
      { onSuccess: () => setMemberTarget(null) },
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Los grupos otorgan un rol adicional a sus miembros. El rol efectivo es
          el más alto entre el rol propio y el de sus grupos.
        </p>
        {canManage && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nuevo grupo
          </Button>
        )}
      </div>

      {isLoading && (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      )}

      {isError && (
        <ErrorState
          title="No se pudieron cargar los grupos"
          onRetry={() => void refetch()}
        />
      )}

      {!isLoading && !isError && groups.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-8 text-center">
          <UsersRound className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Todavía no hay grupos de permisos en este workspace.
          </p>
        </div>
      )}

      {groups.length > 0 && (
        <ul className="space-y-2">
          {groups.map((group) => (
            <li
              key={group.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: group.color }}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate text-sm font-medium">
                    {group.name}
                    <Badge variant="secondary">{ROLE_LABELS[group.role]}</Badge>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {group.description ||
                      `${group.members.length} miembro${group.members.length === 1 ? "" : "s"}`}
                  </p>
                </div>
              </div>
              {canManage && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openMembers(group)}
                  >
                    <UserPlus className="h-4 w-4" />
                    Miembros
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Editar ${group.name}`}
                    onClick={() => openEdit(group)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Eliminar ${group.name}`}
                    onClick={() => deleteGroup.mutate(group.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={!!form}
        onOpenChange={(open) => !open && setForm(null)}
        title={form?.id ? "Editar grupo" : "Nuevo grupo"}
      >
        {form && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="group-name">Nombre</Label>
              <Input
                id="group-name"
                value={form.name}
                maxLength={50}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="group-desc">Descripción</Label>
              <Input
                id="group-desc"
                value={form.description}
                maxLength={500}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="group-role">Rol del grupo</Label>
              <Select
                id="group-role"
                value={form.role}
                onChange={(e) =>
                  setForm({ ...form, role: e.target.value as WorkspaceRole })
                }
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-muted-foreground">
                {ROLE_DESCRIPTIONS[form.role]}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {GROUP_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Color ${color}`}
                    aria-pressed={form.color === color}
                    onClick={() => setForm({ ...form, color })}
                    className="h-7 w-7 rounded-full border-2"
                    style={{
                      backgroundColor: color,
                      borderColor:
                        form.color === color ? "currentColor" : "transparent",
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setForm(null)}>
                Cancelar
              </Button>
              <Button
                onClick={submitForm}
                disabled={
                  form.name.trim().length < 2 ||
                  createGroup.isPending ||
                  updateGroup.isPending
                }
              >
                Guardar
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog
        open={!!memberTarget}
        onOpenChange={(open) => !open && setMemberTarget(null)}
        title="Miembros del grupo"
        description={memberTarget?.name}
      >
        <div className="space-y-3">
          <MultiSelect
            options={memberOptions}
            selected={memberSelection}
            onChange={setMemberSelection}
            placeholder="Agregar miembros…"
          />
          <p className="text-xs text-muted-foreground">
            Al guardar se reemplaza la lista actual del grupo.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setMemberTarget(null)}>
              Cancelar
            </Button>
            <Button onClick={submitMembers} disabled={assignMembers.isPending}>
              Guardar
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
