import type { Reminder } from "@taskmaster/contracts";
import { http } from "@/services/http";

export const remindersApi = {
  list: (workspaceId: string, params?: { from?: string; to?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.from) searchParams.set("from", params.from);
    if (params?.to) searchParams.set("to", params.to);
    const qs = searchParams.toString();
    return http.get<Reminder[]>(
      `/workspaces/${workspaceId}/reminders${qs ? `?${qs}` : ""}`,
    );
  },

  create: (workspaceId: string, input: Record<string, unknown>) =>
    http.post<Reminder>(`/workspaces/${workspaceId}/reminders`, input),

  update: (
    workspaceId: string,
    reminderId: string,
    input: Record<string, unknown>,
  ) =>
    http.patch<Reminder>(
      `/workspaces/${workspaceId}/reminders/${reminderId}`,
      input,
    ),

  remove: (workspaceId: string, reminderId: string) =>
    http.delete<void>(`/workspaces/${workspaceId}/reminders/${reminderId}`),
};
