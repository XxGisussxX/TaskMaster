import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { categoriesApi } from "../api/categories.api";
import { useCurrentWorkspaceId } from "./useTasks";

export function useCategories() {
  const workspaceId = useCurrentWorkspaceId();
  return useQuery({
    queryKey: ["categories", workspaceId],
    queryFn: () => categoriesApi.list(workspaceId!),
    enabled: !!workspaceId,
  });
}

export function useCreateCategory() {
  const workspaceId = useCurrentWorkspaceId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; color?: string }) => {
      if (!workspaceId) throw new Error("No hay workspace seleccionado");
      return categoriesApi.create(workspaceId, input);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["categories", workspaceId] });
    },
    onError: (error: Error) => {
      toast.error("No se pudo crear la categoría", {
        description: error.message,
      });
    },
  });
}

export function useDeleteCategory() {
  const workspaceId = useCurrentWorkspaceId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      if (!workspaceId) throw new Error("No hay workspace seleccionado");
      return categoriesApi.remove(workspaceId, id);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["categories", workspaceId] });
    },
    onError: (error: Error) => {
      toast.error("No se pudo eliminar la categoría", {
        description: error.message,
      });
    },
  });
}
