import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateTeamInput, UpdateTeamInput } from "@taskmaster/contracts";
import { toast } from "sonner";
import { teamsApi } from "../api/team.api";
import { useCurrentWorkspaceId } from "@/features/tasks/hooks/useTasks";
import { isLocalWorkspace } from "@/features/tasks/lib/localTasks";

function useEnabled() {
  const workspaceId = useCurrentWorkspaceId();
  return {
    workspaceId,
    enabled: !!workspaceId && !isLocalWorkspace(workspaceId),
  };
}

export function useTeams() {
  const { workspaceId, enabled } = useEnabled();
  return useQuery({
    queryKey: ["teams", workspaceId],
    queryFn: () => teamsApi.list(workspaceId!),
    enabled,
  });
}

export function useCreateTeam() {
  const { workspaceId } = useEnabled();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTeamInput) =>
      teamsApi.create(workspaceId!, input),
    onSuccess: () => {
      toast.success("Equipo creado");
      void qc.invalidateQueries({ queryKey: ["teams", workspaceId] });
    },
    onError: (error: Error) =>
      toast.error("No se pudo crear el equipo", { description: error.message }),
  });
}

export function useUpdateTeam() {
  const { workspaceId } = useEnabled();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      teamId,
      input,
    }: {
      teamId: string;
      input: UpdateTeamInput;
    }) => teamsApi.update(workspaceId!, teamId, input),
    onSuccess: () => {
      toast.success("Equipo actualizado");
      void qc.invalidateQueries({ queryKey: ["teams", workspaceId] });
    },
    onError: (error: Error) =>
      toast.error("No se pudo actualizar el equipo", {
        description: error.message,
      }),
  });
}

export function useDeleteTeam() {
  const { workspaceId } = useEnabled();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (teamId: string) => teamsApi.remove(workspaceId!, teamId),
    onSuccess: () => {
      toast.success("Equipo eliminado");
      void qc.invalidateQueries({ queryKey: ["teams", workspaceId] });
    },
    onError: (error: Error) =>
      toast.error("No se pudo eliminar el equipo", {
        description: error.message,
      }),
  });
}

export function useAssignTeamMembers() {
  const { workspaceId } = useEnabled();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      teamId,
      memberIds,
    }: {
      teamId: string;
      memberIds: string[];
    }) => teamsApi.assignMembers(workspaceId!, teamId, memberIds),
    onSuccess: () => {
      toast.success("Miembros del equipo actualizados");
      void qc.invalidateQueries({ queryKey: ["teams", workspaceId] });
    },
    onError: (error: Error) =>
      toast.error("No se pudieron asignar los miembros", {
        description: error.message,
      }),
  });
}
