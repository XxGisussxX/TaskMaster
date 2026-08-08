import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Task } from "@taskmaster/contracts";
import { tasksApi, type TaskQuery } from "../api/tasks.api";
import { useWorkspaceStore } from "@/store/workspace.store";
import { getLocalWorkspaceId } from "../lib/localTasks";

export function useCurrentWorkspaceId(): string | null {
  return (
    useWorkspaceStore((s) => s.currentWorkspaceId) ?? getLocalWorkspaceId()
  );
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
    mutationFn: (input: Record<string, unknown>) =>
      tasksApi.create(workspaceId!, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tasks", workspaceId] });
      void qc.invalidateQueries({ queryKey: ["dashboard", workspaceId] });
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
    }) => tasksApi.update(workspaceId!, id, input),
    onSuccess: (updated: Task) => {
      void qc.invalidateQueries({ queryKey: ["tasks", workspaceId] });
      void qc.setQueryData(["task", workspaceId, updated.id], updated);
      void qc.invalidateQueries({ queryKey: ["dashboard", workspaceId] });
    },
  });
}

export function useDeleteTask() {
  const workspaceId = useCurrentWorkspaceId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tasksApi.remove(workspaceId!, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tasks", workspaceId] });
      void qc.invalidateQueries({ queryKey: ["dashboard", workspaceId] });
    },
  });
}
