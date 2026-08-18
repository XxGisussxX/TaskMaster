import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Task, BulkActionResult } from "@taskmaster/contracts";
import { tasksApi, type TaskQuery } from "../api/tasks.api";
import { useWorkspaceStore } from "@/store/workspace.store";

export function useCurrentWorkspaceId(): string | null {
  return useWorkspaceStore((s) => s.currentWorkspaceId);
}

export function useTasks(query: Omit<TaskQuery, "workspaceId">) {
  const workspaceId = useCurrentWorkspaceId();
  return useQuery({
    queryKey: ["tasks", workspaceId, query],
    queryFn: () => tasksApi.list(workspaceId!, query),
    enabled: !!workspaceId,
  });
}

export function useCreateTask() {
  const workspaceId = useCurrentWorkspaceId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => {
      if (!workspaceId) throw new Error("No hay workspace seleccionado");
      return tasksApi.create(workspaceId, input);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tasks", workspaceId] });
      void qc.invalidateQueries({ queryKey: ["dashboard", workspaceId] });
    },
    onError: (error: Error) => {
      toast.error("No se pudo crear la tarea", { description: error.message });
    },
  });
}

export function useUpdateTask() {
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
      return tasksApi.update(workspaceId, id, input);
    },
    onSuccess: (updated: Task) => {
      void qc.invalidateQueries({ queryKey: ["tasks", workspaceId] });
      void qc.setQueryData(["task", workspaceId, updated.id], updated);
      void qc.invalidateQueries({ queryKey: ["dashboard", workspaceId] });
    },
    onError: (error: Error) => {
      toast.error("No se pudo actualizar la tarea", {
        description: error.message,
      });
    },
  });
}

export function useDeleteTask() {
  const workspaceId = useCurrentWorkspaceId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      if (!workspaceId) throw new Error("No hay workspace seleccionado");
      return tasksApi.remove(workspaceId, id);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tasks", workspaceId] });
      void qc.invalidateQueries({ queryKey: ["dashboard", workspaceId] });
    },
    onError: (error: Error) => {
      toast.error("No se pudo eliminar la tarea", {
        description: error.message,
      });
    },
  });
}

export function useBulkUpdateStatus() {
  const workspaceId = useCurrentWorkspaceId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: string }) => {
      if (!workspaceId) throw new Error("No hay workspace seleccionado");
      return tasksApi.bulkUpdateStatus(workspaceId, ids, status);
    },
    onSuccess: (result: BulkActionResult) => {
      void qc.invalidateQueries({ queryKey: ["tasks", workspaceId] });
      void qc.invalidateQueries({ queryKey: ["dashboard", workspaceId] });
      if (result.failed.length > 0) {
        toast.warning(
          `${result.succeeded.length} tareas actualizadas, ${result.failed.length} fallaron`,
        );
      } else {
        toast.success(`${result.succeeded.length} tareas actualizadas`);
      }
    },
    onError: (error: Error) => {
      toast.error("No se pudieron actualizar las tareas", {
        description: error.message,
      });
    },
  });
}

export function useBulkUpdatePriority() {
  const workspaceId = useCurrentWorkspaceId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, priority }: { ids: string[]; priority: string }) => {
      if (!workspaceId) throw new Error("No hay workspace seleccionado");
      return tasksApi.bulkUpdatePriority(workspaceId, ids, priority);
    },
    onSuccess: (result: BulkActionResult) => {
      void qc.invalidateQueries({ queryKey: ["tasks", workspaceId] });
      void qc.invalidateQueries({ queryKey: ["dashboard", workspaceId] });
      if (result.failed.length > 0) {
        toast.warning(
          `${result.succeeded.length} tareas actualizadas, ${result.failed.length} fallaron`,
        );
      } else {
        toast.success(`${result.succeeded.length} tareas actualizadas`);
      }
    },
    onError: (error: Error) => {
      toast.error("No se pudieron actualizar las tareas", {
        description: error.message,
      });
    },
  });
}

export function useBulkDeleteTasks() {
  const workspaceId = useCurrentWorkspaceId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => {
      if (!workspaceId) throw new Error("No hay workspace seleccionado");
      return tasksApi.bulkDelete(workspaceId, ids);
    },
    onSuccess: (result: BulkActionResult) => {
      void qc.invalidateQueries({ queryKey: ["tasks", workspaceId] });
      void qc.invalidateQueries({ queryKey: ["dashboard", workspaceId] });
      if (result.failed.length > 0) {
        toast.warning(
          `${result.succeeded.length} tareas eliminadas, ${result.failed.length} fallaron`,
        );
      } else {
        toast.success(`${result.succeeded.length} tareas eliminadas`);
      }
    },
    onError: (error: Error) => {
      toast.error("No se pudieron eliminar las tareas", {
        description: error.message,
      });
    },
  });
}
