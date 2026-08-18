import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { savedViewsApi } from "../api/saved-views.api";
import { useWorkspaceStore } from "@/store/workspace.store";

export function useCurrentWorkspaceId(): string | null {
  return useWorkspaceStore((s) => s.currentWorkspaceId);
}

export function useSavedViews() {
  const workspaceId = useCurrentWorkspaceId();
  return useQuery({
    queryKey: ["saved-views", workspaceId],
    queryFn: () => savedViewsApi.list(workspaceId!),
    enabled: !!workspaceId,
  });
}

export function useCreateSavedView() {
  const workspaceId = useCurrentWorkspaceId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => {
      if (!workspaceId) throw new Error("No hay workspace seleccionado");
      return savedViewsApi.create(workspaceId, input);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["saved-views", workspaceId] });
      toast.success("Vista guardada");
    },
    onError: (error: Error) => {
      toast.error("No se pudo guardar la vista", {
        description: error.message,
      });
    },
  });
}

export function useUpdateSavedView() {
  const workspaceId = useCurrentWorkspaceId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: Record<string, unknown>;
    }) => {
      if (!workspaceId) throw new Error("No hay workspace seleccionado");
      return savedViewsApi.update(workspaceId, id, input);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["saved-views", workspaceId] });
      toast.success("Vista actualizada");
    },
    onError: (error: Error) => {
      toast.error("No se pudo actualizar la vista", {
        description: error.message,
      });
    },
  });
}

export function useDeleteSavedView() {
  const workspaceId = useCurrentWorkspaceId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      if (!workspaceId) throw new Error("No hay workspace seleccionado");
      return savedViewsApi.remove(workspaceId, id);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["saved-views", workspaceId] });
      toast.success("Vista eliminada");
    },
    onError: (error: Error) => {
      toast.error("No se pudo eliminar la vista", {
        description: error.message,
      });
    },
  });
}
