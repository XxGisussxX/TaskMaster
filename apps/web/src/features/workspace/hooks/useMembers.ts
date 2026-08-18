import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { workspacesApi } from "../api/workspace.api";
import { useCurrentWorkspaceId } from "@/features/tasks/hooks/useTasks";

export function useMembers() {
  const workspaceId = useCurrentWorkspaceId();
  return useQuery({
    queryKey: ["members", workspaceId],
    queryFn: () => workspacesApi.members(workspaceId!),
    enabled: !!workspaceId,
  });
}

export function useInviteMember() {
  const workspaceId = useCurrentWorkspaceId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ email, role }: { email: string; role: string }) => {
      if (!workspaceId) throw new Error("No hay workspace seleccionado");
      return workspacesApi.invite(workspaceId, { email, role });
    },
    onSuccess: () => {
      toast.success("Invitación enviada");
      void qc.invalidateQueries({ queryKey: ["members", workspaceId] });
    },
    onError: (error: Error) => {
      toast.error("No se pudo enviar la invitación", {
        description: error.message,
      });
    },
  });
}

export function useUpdateMemberRole() {
  const workspaceId = useCurrentWorkspaceId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: string }) => {
      if (!workspaceId) throw new Error("No hay workspace seleccionado");
      return workspacesApi.updateMemberRole(workspaceId, memberId, role);
    },
    onSuccess: () => {
      toast.success("Rol actualizado");
      void qc.invalidateQueries({ queryKey: ["members", workspaceId] });
    },
    onError: (error: Error) => {
      toast.error("No se pudo actualizar el rol", {
        description: error.message,
      });
    },
  });
}

export function useRemoveMember() {
  const workspaceId = useCurrentWorkspaceId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => {
      if (!workspaceId) throw new Error("No hay workspace seleccionado");
      return workspacesApi.removeMember(workspaceId, memberId);
    },
    onSuccess: () => {
      toast.success("Miembro eliminado");
      void qc.invalidateQueries({ queryKey: ["members", workspaceId] });
    },
    onError: (error: Error) => {
      toast.error("No se pudo eliminar al miembro", {
        description: error.message,
      });
    },
  });
}
