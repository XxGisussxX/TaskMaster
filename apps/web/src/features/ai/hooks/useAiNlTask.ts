import { useMutation } from "@tanstack/react-query";
import { aiApi } from "../api/ai.api";
import { useCurrentWorkspaceId } from "@/features/tasks/hooks/useTasks";

export function useAiNlTask() {
  const workspaceId = useCurrentWorkspaceId();
  return useMutation({
    mutationFn: (text: string) => {
      if (!workspaceId) throw new Error("No hay workspace seleccionado");
      return aiApi.generateTaskDraft(workspaceId, text);
    },
  });
}
