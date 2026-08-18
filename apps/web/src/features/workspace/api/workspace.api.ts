import type { Workspace, WorkspaceMember } from "@taskmaster/contracts";
import { http } from "@/services/http";

export const workspacesApi = {
  list: () => http.get<Workspace[]>("/workspaces"),

  get: (id: string) => http.get<Workspace>(`/workspaces/${id}`),

  create: (input: { name: string; slug?: string; icon?: string }) =>
    http.post<Workspace>("/workspaces", input),

  update: (id: string, input: Record<string, unknown>) =>
    http.patch<Workspace>(`/workspaces/${id}`, input),

  delete: (id: string) => http.delete<void>(`/workspaces/${id}`),

  members: (id: string) =>
    http.get<WorkspaceMember[]>(`/workspaces/${id}/members`),

  invite: (id: string, input: { email: string; role: string }) =>
    http.post<unknown>(`/workspaces/${id}/invites`, input),

  updateMemberRole: (id: string, memberId: string, role: string) =>
    http.patch<WorkspaceMember>(`/workspaces/${id}/members/${memberId}`, {
      role,
    }),

  removeMember: (id: string, memberId: string) =>
    http.delete<void>(`/workspaces/${id}/members/${memberId}`),

  acceptInvite: (token: string) =>
    http.post<Workspace>("/workspaces/invites/accept", { token }),
};
