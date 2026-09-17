import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { inviteApi } from "../api/invite.api";
import { useWorkspaceStore } from "@/store/workspace.store";

export function useInvitePreview(token: string) {
  return useQuery({
    queryKey: ["invite-preview", token],
    queryFn: () => inviteApi.preview(token),
    enabled: Boolean(token),
    retry: false,
  });
}

export function useAcceptInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => inviteApi.accept(token),
    onSuccess: (workspace) => {
      toast.success(`Te uniste a ${workspace.name}`);
      useWorkspaceStore.getState().setCurrentWorkspaceId(workspace.id);
      void qc.invalidateQueries({ queryKey: ["workspaces"] });
      void qc.invalidateQueries({ queryKey: ["members", workspace.id] });
    },
    onError: (error: Error) => {
      toast.error("No se pudo aceptar la invitación", {
        description: error.message,
      });
    },
  });
}
