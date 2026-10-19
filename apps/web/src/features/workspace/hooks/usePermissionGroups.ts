import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreatePermissionGroupInput,
  UpdatePermissionGroupInput,
} from "@taskmaster/contracts";
import { toast } from "sonner";
import { permissionGroupsApi } from "../api/team.api";
import { useCurrentWorkspaceId } from "@/features/tasks/hooks/useTasks";
import { isLocalWorkspace } from "@/features/tasks/lib/localTasks";

function useEnabled() {
  const workspaceId = useCurrentWorkspaceId();
  return {
    workspaceId,
    enabled: !!workspaceId && !isLocalWorkspace(workspaceId),
  };
}

export function usePermissionGroups() {
  const { workspaceId, enabled } = useEnabled();
  return useQuery({
    queryKey: ["permission-groups", workspaceId],
    queryFn: () => permissionGroupsApi.list(workspaceId!),
    enabled,
  });
}

export function useCreatePermissionGroup() {
  const { workspaceId } = useEnabled();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePermissionGroupInput) =>
      permissionGroupsApi.create(workspaceId!, input),
    onSuccess: () => {
      toast.success("Grupo creado");
      void qc.invalidateQueries({
        queryKey: ["permission-groups", workspaceId],
      });
      // El rol efectivo puede cambiar: revalida miembros y permisos derivados.
      void qc.invalidateQueries({ queryKey: ["members", workspaceId] });
    },
    onError: (error: Error) =>
      toast.error("No se pudo crear el grupo", { description: error.message }),
  });
}

export function useUpdatePermissionGroup() {
  const { workspaceId } = useEnabled();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      groupId,
      input,
    }: {
      groupId: string;
      input: UpdatePermissionGroupInput;
    }) => permissionGroupsApi.update(workspaceId!, groupId, input),
    onSuccess: () => {
      toast.success("Grupo actualizado");
      void qc.invalidateQueries({
        queryKey: ["permission-groups", workspaceId],
      });
      void qc.invalidateQueries({ queryKey: ["members", workspaceId] });
    },
    onError: (error: Error) =>
      toast.error("No se pudo actualizar el grupo", {
        description: error.message,
      }),
  });
}

export function useDeletePermissionGroup() {
  const { workspaceId } = useEnabled();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) =>
      permissionGroupsApi.remove(workspaceId!, groupId),
    onSuccess: () => {
      toast.success("Grupo eliminado");
      void qc.invalidateQueries({
        queryKey: ["permission-groups", workspaceId],
      });
      void qc.invalidateQueries({ queryKey: ["members", workspaceId] });
    },
    onError: (error: Error) =>
      toast.error("No se pudo eliminar el grupo", {
        description: error.message,
      }),
  });
}

export function useAssignPermissionGroupMembers() {
  const { workspaceId } = useEnabled();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      groupId,
      memberIds,
    }: {
      groupId: string;
      memberIds: string[];
    }) =>
      permissionGroupsApi.assignMembers(workspaceId!, groupId, { memberIds }),
    onSuccess: () => {
      toast.success("Miembros del grupo actualizados");
      void qc.invalidateQueries({
        queryKey: ["permission-groups", workspaceId],
      });
      void qc.invalidateQueries({ queryKey: ["members", workspaceId] });
    },
    onError: (error: Error) =>
      toast.error("No se pudieron asignar los miembros", {
        description: error.message,
      }),
  });
}
