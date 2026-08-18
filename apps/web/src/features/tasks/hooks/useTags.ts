import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { tagsApi } from "../api/tags.api";
import { useCurrentWorkspaceId } from "./useTasks";

export function useTags() {
  const workspaceId = useCurrentWorkspaceId();
  return useQuery({
    queryKey: ["tags", workspaceId],
    queryFn: () => tagsApi.list(workspaceId!),
    enabled: !!workspaceId,
  });
}

export function useCreateTag() {
  const workspaceId = useCurrentWorkspaceId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; color?: string }) => {
      if (!workspaceId) throw new Error("No hay workspace seleccionado");
      return tagsApi.create(workspaceId, input);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tags", workspaceId] });
    },
    onError: (error: Error) => {
      toast.error("No se pudo crear la etiqueta", {
        description: error.message,
      });
    },
  });
}

export function useDeleteTag() {
  const workspaceId = useCurrentWorkspaceId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      if (!workspaceId) throw new Error("No hay workspace seleccionado");
      return tagsApi.remove(workspaceId, id);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tags", workspaceId] });
    },
    onError: (error: Error) => {
      toast.error("No se pudo eliminar la etiqueta", {
        description: error.message,
      });
    },
  });
}
