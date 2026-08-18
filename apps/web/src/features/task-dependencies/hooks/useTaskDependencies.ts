import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { taskDependenciesApi } from "../api/task-dependencies.api";
import { useCurrentWorkspaceId } from "@/features/tasks/hooks/useTasks";

export function useTaskDependencies(taskId: string | null) {
  const workspaceId = useCurrentWorkspaceId();
  return useQuery({
    queryKey: ["task-dependencies", workspaceId, taskId],
    queryFn: () => taskDependenciesApi.listByTask(workspaceId!, taskId!),
    enabled: !!workspaceId && !!taskId,
  });
}

export function useCreateTaskDependency() {
  const workspaceId = useCurrentWorkspaceId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { fromTaskId: string; toTaskId: string }) => {
      if (!workspaceId) throw new Error("No hay workspace seleccionado");
      return taskDependenciesApi.create(workspaceId, input);
    },
    onSuccess: () => {
      toast.success("Dependencia creada");
      void qc.invalidateQueries({
        queryKey: ["task-dependencies", workspaceId],
      });
    },
    onError: (error: Error) => {
      toast.error("No se pudo crear la dependencia", {
        description: error.message,
      });
    },
  });
}

export function useDeleteTaskDependency(taskId: string | null) {
  const workspaceId = useCurrentWorkspaceId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      if (!workspaceId) throw new Error("No hay workspace seleccionado");
      return taskDependenciesApi.remove(workspaceId, id);
    },
    onSuccess: () => {
      toast.success("Dependencia eliminada");
      void qc.invalidateQueries({
        queryKey: ["task-dependencies", workspaceId, taskId],
      });
    },
    onError: (error: Error) => {
      toast.error("No se pudo eliminar la dependencia", {
        description: error.message,
      });
    },
  });
}
