import type { DashboardStats, DashboardQuery } from "@taskmaster/contracts";
import { http } from "@/services/http";

function toQueryString(params: DashboardQuery): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) sp.set(key, String(value));
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

export const dashboardApi = {
  stats: (workspaceId: string, query: DashboardQuery = {}) =>
    http.get<DashboardStats>(
      `/workspaces/${workspaceId}/dashboard${toQueryString(query)}`,
    ),
};
