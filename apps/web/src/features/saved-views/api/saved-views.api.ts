import type { SavedView } from "@taskmaster/contracts";
import { http } from "@/services/http";

export const savedViewsApi = {
  list: (workspaceId: string) =>
    http.get<SavedView[]>(`/workspaces/${workspaceId}/saved-views`),

  get: (workspaceId: string, id: string) =>
    http.get<SavedView>(`/workspaces/${workspaceId}/saved-views/${id}`),

  create: (workspaceId: string, input: Record<string, unknown>) =>
    http.post<SavedView>(`/workspaces/${workspaceId}/saved-views`, input),

  update: (workspaceId: string, id: string, input: Record<string, unknown>) =>
    http.patch<SavedView>(
      `/workspaces/${workspaceId}/saved-views/${id}`,
      input,
    ),

  remove: (workspaceId: string, id: string) =>
    http.delete<void>(`/workspaces/${workspaceId}/saved-views/${id}`),
};
