import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2, UserPlus, UsersRound } from "lucide-react";
import type { TeamWithMembers } from "@taskmaster/contracts";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select";
import { Spinner } from "@/components/ui/spinner";
import { useMembers, useCurrentMembership } from "../hooks/useMembers";
import {
  useAssignTeamMembers,
  useCreateTeam,
  useDeleteTeam,
  useTeams,
  useUpdateTeam,
} from "../hooks/useTeams";
import { canManageMembers } from "../lib/teamPermissions";

const TEAM_COLORS = [
  "#3b82f6",
  "#ef4444",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
] as const;

interface TeamFormState {
  id?: string;
  name: string;
  description: string;
  color: string;
}

const EMPTY_FORM: TeamFormState = {
  name: "",
  description: "",
  color: TEAM_COLORS[0],
};

export function TeamsTab() {
  const { data: teams = [], isLoading, isError, refetch } = useTeams();
  const { data: members = [] } = useMembers();
  const { role } = useCurrentMembership();
  const canManage = canManageMembers(role);

  const createTeam = useCreateTeam();
  const updateTeam = useUpdateTeam();
  const deleteTeam = useDeleteTeam();
  const assignMembers = useAssignTeamMembers();

  const [form, setForm] = useState<TeamFormState | null>(null);
  const [memberTarget, setMemberTarget] = useState<TeamWithMembers | null>(
    null,
  );
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
  const openEdit = (team: TeamWithMembers) =>
    setForm({
      id: team.id,
      name: team.name,
      description: team.description,
      color: team.color,
    });

  const openMembers = (team: TeamWithMembers) => {
    setMemberTarget(team);
    setMemberSelection(team.members.map((m) => m.userId));
  };

  const submitForm = () => {
    if (!form) return;
    const name = form.name.trim();
    if (name.length < 2) return;
    const input = {
      name,
      description: form.description.trim(),
      color: form.color,
    };
    if (form.id) {
      updateTeam.mutate(
        { teamId: form.id, input },
        { onSuccess: () => setForm(null) },
      );
    } else {
      createTeam.mutate(input, { onSuccess: () => setForm(null) });
    }
  };

  const submitMembers = () => {
    if (!memberTarget || memberSelection.length === 0) return;
    assignMembers.mutate(
      { teamId: memberTarget.id, memberIds: memberSelection },
      { onSuccess: () => setMemberTarget(null) },
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="No se pudieron cargar los equipos"
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Los equipos agrupan miembros del workspace para organizar el trabajo.
        </p>
        {canManage && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nuevo equipo
          </Button>
        )}
      </div>

      {teams.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
            <UsersRound className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Todavía no hay equipos en este workspace.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {teams.map((team) => (
            <li
              key={team.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: team.color }}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{team.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {team.description ||
                      `${team.members.length} miembro${team.members.length === 1 ? "" : "s"}`}
                  </p>
                </div>
              </div>
              {canManage && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openMembers(team)}
                  >
                    <UserPlus className="h-4 w-4" />
                    Miembros
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Editar ${team.name}`}
                    onClick={() => openEdit(team)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Eliminar ${team.name}`}
                    onClick={() => deleteTeam.mutate(team.id)}
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
        title={form?.id ? "Editar equipo" : "Nuevo equipo"}
      >
        {form && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="team-name">Nombre</Label>
              <Input
                id="team-name"
                value={form.name}
                maxLength={50}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="team-desc">Descripción</Label>
              <Input
                id="team-desc"
                value={form.description}
                maxLength={500}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {TEAM_COLORS.map((color) => (
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
                  createTeam.isPending ||
                  updateTeam.isPending
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
        title="Miembros del equipo"
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
            {memberSelection.length === 0
              ? "Selecciona al menos un miembro."
              : "Al guardar se reemplaza la lista actual del equipo."}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setMemberTarget(null)}>
              Cancelar
            </Button>
            <Button
              onClick={submitMembers}
              disabled={assignMembers.isPending || memberSelection.length === 0}
            >
              Guardar
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
