import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { taskTemplatesApi } from "../api/task-templates.api";
import { useWorkspaceStore } from "@/store/workspace.store";

export function useCurrentWorkspaceId(): string | null {
  return useWorkspaceStore((s) => s.currentWorkspaceId);
}

export function useTaskTemplates() {
  const workspaceId = useCurrentWorkspaceId();
  return useQuery({
    queryKey: ["task-templates", workspaceId],
    queryFn: () => taskTemplatesApi.list(workspaceId!),
    enabled: !!workspaceId,
  });
}

export function useCreateTaskTemplate() {
  const workspaceId = useCurrentWorkspaceId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => {
      if (!workspaceId) throw new Error("No hay workspace seleccionado");
      return taskTemplatesApi.create(workspaceId, input);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["task-templates", workspaceId] });
      toast.success("Plantilla creada");
    },
    onError: (error: Error) => {
      toast.error("No se pudo crear la plantilla", {
        description: error.message,
      });
    },
  });
}

export function useUpdateTaskTemplate() {
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
      return taskTemplatesApi.update(workspaceId, id, input);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["task-templates", workspaceId] });
      toast.success("Plantilla actualizada");
    },
    onError: (error: Error) => {
      toast.error("No se pudo actualizar la plantilla", {
        description: error.message,
      });
    },
  });
}

export function useDeleteTaskTemplate() {
  const workspaceId = useCurrentWorkspaceId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      if (!workspaceId) throw new Error("No hay workspace seleccionado");
      return taskTemplatesApi.remove(workspaceId, id);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["task-templates", workspaceId] });
      toast.success("Plantilla eliminada");
    },
    onError: (error: Error) => {
      toast.error("No se pudo eliminar la plantilla", {
        description: error.message,
      });
    },
  });
}
