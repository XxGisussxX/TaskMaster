import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { WorkspaceRole } from "@taskmaster/contracts";
import { toast } from "sonner";
import { workspacesApi } from "../api/workspace.api";
import { showInviteDevToast } from "../components/InviteLinkToastContent";
import { useCurrentWorkspaceId } from "@/features/tasks/hooks/useTasks";
import { isLocalWorkspace } from "@/features/tasks/lib/localTasks";
import { useAuthStore } from "@/store/auth.store";

export function useMembers() {
  const workspaceId = useCurrentWorkspaceId();
  return useQuery({
    queryKey: ["members", workspaceId],
    queryFn: () => workspacesApi.members(workspaceId!),
    enabled: !!workspaceId && !isLocalWorkspace(workspaceId),
  });
}

const WRITE_ROLES: WorkspaceRole[] = ["OWNER", "ADMIN", "MEMBER"];

/**
 * Membresía del usuario actual en el workspace activo + derivados de permisos.
 * Reutiliza la query `members` ya existente (sin fetch extra por página).
 */
export function useCurrentMembership() {
  const workspaceId = useCurrentWorkspaceId();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const { data: members = [] } = useMembers();

  // En el workspace demo local no hay backend ni lista de miembros: el usuario
  // es dueño de sus propios datos (localStorage), así que se le concede
  // escritura. Sin esto todo el modo demo quedaba en solo lectura.
  if (workspaceId && isLocalWorkspace(workspaceId)) {
    return {
      membership: null,
      role: "OWNER" as WorkspaceRole,
      canWrite: true,
      isOwnerOrAdmin: true,
      hasWorkspace: true,
    };
  }

  const membership = members.find((m) => m.userId === currentUserId) ?? null;
  const role = membership?.role ?? null;
  const canWrite = !!role && WRITE_ROLES.includes(role);
  const isOwnerOrAdmin = !!role && (role === "OWNER" || role === "ADMIN");

  return {
    membership,
    role,
    canWrite,
    isOwnerOrAdmin,
    hasWorkspace: !!workspaceId,
  };
}

export function useInviteMember() {
  const workspaceId = useCurrentWorkspaceId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ email, role }: { email: string; role: string }) => {
      if (!workspaceId) throw new Error("No hay workspace seleccionado");
      return workspacesApi.invite(workspaceId, { email, role });
    },
    onSuccess: (data, variables) => {
      if (data.emailSent) {
        toast.success(`Invitación enviada a ${variables.email}`);
      } else if (data.inviteUrl) {
        showInviteDevToast(
          `Invitación creada para ${variables.email}`,
          data.inviteUrl,
        );
      } else {
        toast.success(`Invitación creada para ${variables.email}`);
      }
      void qc.invalidateQueries({ queryKey: ["members", workspaceId] });
      void qc.invalidateQueries({ queryKey: ["pending-invites", workspaceId] });
    },
    onError: (error: Error) => {
      toast.error("No se pudo enviar la invitación", {
        description: error.message,
      });
    },
  });
}

export function usePendingInvites() {
  const workspaceId = useCurrentWorkspaceId();
  return useQuery({
    queryKey: ["pending-invites", workspaceId],
    queryFn: () => workspacesApi.invites(workspaceId!),
    enabled: !!workspaceId && !isLocalWorkspace(workspaceId),
  });
}

export function useResendInvite() {
  const workspaceId = useCurrentWorkspaceId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) => {
      if (!workspaceId) throw new Error("No hay workspace seleccionado");
      return workspacesApi.resendInvite(workspaceId, inviteId);
    },
    onSuccess: (data) => {
      if (data.emailSent) {
        toast.success("Invitación reenviada");
      } else if (data.inviteUrl) {
        showInviteDevToast("Invitación regenerada", data.inviteUrl);
      } else {
        toast.success("Invitación regenerada");
      }
      void qc.invalidateQueries({ queryKey: ["pending-invites", workspaceId] });
    },
    onError: (error: Error) => {
      toast.error("No se pudo reenviar la invitación", {
        description: error.message,
      });
    },
  });
}

export function useRevokeInvite() {
  const workspaceId = useCurrentWorkspaceId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) => {
      if (!workspaceId) throw new Error("No hay workspace seleccionado");
      return workspacesApi.revokeInvite(workspaceId, inviteId);
    },
    onSuccess: () => {
      toast.success("Invitación revocada");
      void qc.invalidateQueries({ queryKey: ["pending-invites", workspaceId] });
    },
    onError: (error: Error) => {
      toast.error("No se pudo revocar la invitación", {
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
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
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
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error: Error) => {
      toast.error("No se pudo eliminar al miembro", {
        description: error.message,
      });
    },
  });
}
