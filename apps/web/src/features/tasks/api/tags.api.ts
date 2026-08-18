import type { Tag } from "@taskmaster/contracts";
import { http } from "@/services/http";

export const tagsApi = {
  list: (workspaceId: string) =>
    http.get<Tag[]>(`/workspaces/${workspaceId}/tags`),

  create: (workspaceId: string, input: { name: string; color?: string }) =>
    http.post<Tag>(`/workspaces/${workspaceId}/tags`, input),

  update: (workspaceId: string, id: string, input: Record<string, unknown>) =>
    http.patch<Tag>(`/workspaces/${workspaceId}/tags/${id}`, input),

  remove: (workspaceId: string, id: string) =>
    http.delete<void>(`/workspaces/${workspaceId}/tags/${id}`),
};
