import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { channelsApi } from "../api/channels.api";
import { useCurrentWorkspaceId } from "./useTasks";

export function useChannels() {
  const workspaceId = useCurrentWorkspaceId();
  return useQuery({
    queryKey: ["channels", workspaceId],
    queryFn: () => channelsApi.list(workspaceId!),
    enabled: !!workspaceId,
  });
}

export function useCreateChannel() {
  const workspaceId = useCurrentWorkspaceId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; color?: string }) => {
      if (!workspaceId) throw new Error("No hay workspace seleccionado");
      return channelsApi.create(workspaceId, input);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["channels", workspaceId] });
    },
    onError: (error: Error) => {
      toast.error("No se pudo crear el canal", {
        description: error.message,
      });
    },
  });
}

export function useDeleteChannel() {
  const workspaceId = useCurrentWorkspaceId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      if (!workspaceId) throw new Error("No hay workspace seleccionado");
      return channelsApi.remove(workspaceId, id);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["channels", workspaceId] });
    },
    onError: (error: Error) => {
      toast.error("No se pudo eliminar el canal", {
        description: error.message,
      });
    },
  });
}
