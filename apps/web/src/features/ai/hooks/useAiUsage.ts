import { useQuery } from "@tanstack/react-query";
import { aiApi } from "../api/ai.api";
import { useCurrentWorkspaceId } from "@/features/tasks/hooks/useTasks";

export function useAiUsage() {
  const workspaceId = useCurrentWorkspaceId();
  return useQuery({
    queryKey: ["ai-usage", workspaceId],
    queryFn: () => aiApi.getUsage(workspaceId!),
    enabled: !!workspaceId,
    refetchInterval: 60_000,
  });
}
