import type { Task, Paginated } from "@taskmaster/contracts";
import { http } from "@/services/http";
import {
  createLocalTask,
  isLocalWorkspace,
  listLocalTasks,
  removeLocalTask,
  updateLocalTask,
} from "../lib/localTasks";

export interface TaskQuery {
  workspaceId: string;
  status?: string;
  priority?: string;
  search?: string;
  onlyMine?: boolean;
  onlyOverdue?: boolean;
  page?: number;
  pageSize?: number;
}

function toQueryString(params: Record<string, unknown>) {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (
      value !== undefined &&
      value !== "" &&
      value !== "ALL" &&
      (typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean")
    ) {
      sp.set(key, String(value));
    }
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

export const tasksApi = {
  list: (workspaceId: string, query: Omit<TaskQuery, "workspaceId">) =>
    isLocalWorkspace(workspaceId)
      ? Promise.resolve(listLocalTasks(workspaceId))
      : http.get<Paginated<Task>>(
          `/workspaces/${workspaceId}/tasks${toQueryString(query)}`,
        ),
  get: (workspaceId: string, id: string) =>
    isLocalWorkspace(workspaceId)
      ? Promise.resolve(
          listLocalTasks(workspaceId).items.find(
            (task) => task.id === id,
          ) as Task,
        )
      : http.get<Task>(`/workspaces/${workspaceId}/tasks/${id}`),

  create: (workspaceId: string, input: Record<string, unknown>) =>
    isLocalWorkspace(workspaceId)
      ? Promise.resolve(createLocalTask(workspaceId, input))
      : http.post<Task>(`/workspaces/${workspaceId}/tasks`, input),

  update: (workspaceId: string, id: string, input: Record<string, unknown>) =>
    isLocalWorkspace(workspaceId)
      ? Promise.resolve(updateLocalTask(workspaceId, id, input))
      : http.patch<Task>(`/workspaces/${workspaceId}/tasks/${id}`, input),

  remove: (workspaceId: string, id: string) =>
    isLocalWorkspace(workspaceId)
      ? (removeLocalTask(workspaceId, id), Promise.resolve())
      : http.delete<void>(`/workspaces/${workspaceId}/tasks/${id}`),
};
