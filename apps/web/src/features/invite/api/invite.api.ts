import type { InvitePreview, Workspace } from "@taskmaster/contracts";
import { http } from "@/services/http";

export const inviteApi = {
  preview: (token: string) =>
    http.get<InvitePreview>(`/workspaces/invites/${token}`),

  accept: (token: string) =>
    http.post<Workspace>("/workspaces/invites/accept", { token }),
};
