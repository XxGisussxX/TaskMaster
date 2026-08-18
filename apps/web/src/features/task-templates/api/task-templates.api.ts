import type { TaskTemplate } from "@taskmaster/contracts";
import { http } from "@/services/http";

export const taskTemplatesApi = {
  list: (workspaceId: string) =>
    http.get<TaskTemplate[]>(`/workspaces/${workspaceId}/templates`),

  create: (workspaceId: string, input: Record<string, unknown>) =>
    http.post<TaskTemplate>(`/workspaces/${workspaceId}/templates`, input),

  update: (workspaceId: string, id: string, input: Record<string, unknown>) =>
    http.patch<TaskTemplate>(
      `/workspaces/${workspaceId}/templates/${id}`,
      input,
    ),

  remove: (workspaceId: string, id: string) =>
    http.delete<void>(`/workspaces/${workspaceId}/templates/${id}`),

  useTemplate: (workspaceId: string, id: string) =>
    http.post<TaskTemplate>(`/workspaces/${workspaceId}/templates/${id}/use`),
};
