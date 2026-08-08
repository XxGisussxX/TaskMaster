import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "../api/dashboard.api";
import { useCurrentWorkspaceId } from "@/features/tasks/hooks/useTasks";

export function useDashboardStats() {
  const workspaceId = useCurrentWorkspaceId();
  return useQuery({
    queryKey: ["dashboard", workspaceId],
    queryFn: () => dashboardApi.stats(workspaceId!),
    enabled: !!workspaceId,
  });
}
