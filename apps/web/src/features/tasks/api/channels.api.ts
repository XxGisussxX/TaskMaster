import type { Channel } from "@taskmaster/contracts";
import { http } from "@/services/http";

export const channelsApi = {
  list: (workspaceId: string) =>
    http.get<Channel[]>(`/workspaces/${workspaceId}/channels`),

  create: (workspaceId: string, input: { name: string; color?: string }) =>
    http.post<Channel>(`/workspaces/${workspaceId}/channels`, input),

  update: (workspaceId: string, id: string, input: Record<string, unknown>) =>
    http.patch<Channel>(`/workspaces/${workspaceId}/channels/${id}`, input),

  remove: (workspaceId: string, id: string) =>
    http.delete<void>(`/workspaces/${workspaceId}/channels/${id}`),
};
