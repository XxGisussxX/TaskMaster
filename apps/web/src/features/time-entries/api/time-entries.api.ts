import type { PaginatedTimeEntries, TimeEntry } from "@taskmaster/contracts";
import { http } from "@/services/http";

export const timeEntriesApi = {
  list: (
    workspaceId: string,
    params?: {
      taskId?: string;
      userId?: string;
      from?: string;
      to?: string;
      page?: number;
      pageSize?: number;
    },
  ) => {
    const searchParams = new URLSearchParams();
    if (params?.taskId) searchParams.set("taskId", params.taskId);
    if (params?.userId) searchParams.set("userId", params.userId);
    if (params?.from) searchParams.set("from", params.from);
    if (params?.to) searchParams.set("to", params.to);
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.pageSize) searchParams.set("pageSize", String(params.pageSize));
    const qs = searchParams.toString();
    return http.get<PaginatedTimeEntries>(
      `/workspaces/${workspaceId}/time-entries${qs ? `?${qs}` : ""}`,
    );
  },

  create: (workspaceId: string, input: Record<string, unknown>) =>
    http.post<TimeEntry>(`/workspaces/${workspaceId}/time-entries`, input),

  stop: (workspaceId: string, entryId: string) =>
    http.patch<TimeEntry>(
      `/workspaces/${workspaceId}/time-entries/${entryId}/stop`,
    ),

  update: (
    workspaceId: string,
    entryId: string,
    input: Record<string, unknown>,
  ) =>
    http.patch<TimeEntry>(
      `/workspaces/${workspaceId}/time-entries/${entryId}`,
      input,
    ),

  remove: (workspaceId: string, entryId: string) =>
    http.delete<void>(`/workspaces/${workspaceId}/time-entries/${entryId}`),
};
