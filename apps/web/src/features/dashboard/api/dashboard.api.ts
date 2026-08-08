import type { DashboardStats } from "@taskmaster/contracts";
import { http } from "@/services/http";

export const dashboardApi = {
  stats: (workspaceId: string) =>
    http.get<DashboardStats>(`/workspaces/${workspaceId}/dashboard`),
};
