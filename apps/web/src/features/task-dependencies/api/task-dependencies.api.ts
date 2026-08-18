import type { TaskDependency } from "@taskmaster/contracts";
import { http } from "@/services/http";

export const taskDependenciesApi = {
  create: (
    workspaceId: string,
    input: { fromTaskId: string; toTaskId: string },
  ) =>
    http.post<TaskDependency>(`/workspaces/${workspaceId}/dependencies`, input),

  listByTask: (workspaceId: string, taskId: string) =>
    http.get<TaskDependency[]>(
      `/workspaces/${workspaceId}/dependencies?taskId=${taskId}`,
    ),

  remove: (workspaceId: string, id: string) =>
    http.delete<{ id: string }>(
      `/workspaces/${workspaceId}/dependencies/${id}`,
    ),
};
