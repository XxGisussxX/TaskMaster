import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { dreamBoardApi } from "../api/dream-board.api";
import { useCurrentWorkspaceId } from "@/features/tasks/hooks/useTasks";

export function useDreamBoard() {
  const workspaceId = useCurrentWorkspaceId();
  return useQuery({
    queryKey: ["dream-board", workspaceId],
    queryFn: () => dreamBoardApi.get(workspaceId!),
    enabled: !!workspaceId,
  });
}

export function useCreateDreamPin() {
  const workspaceId = useCurrentWorkspaceId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      dreamBoardApi.createPin(workspaceId!, input),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ["dream-board", workspaceId] }),
    onError: (error: Error) => {
      toast.error("No se pudo crear el pin", { description: error.message });
    },
  });
}

export function useUpdateDreamPin() {
  const workspaceId = useCurrentWorkspaceId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      pinId,
      input,
    }: {
      pinId: string;
      input: Record<string, unknown>;
    }) => dreamBoardApi.updatePin(workspaceId!, pinId, input),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ["dream-board", workspaceId] }),
    onError: (error: Error) => {
      toast.error("No se pudo actualizar el pin", {
        description: error.message,
      });
    },
  });
}

export function useDeleteDreamPin() {
  const workspaceId = useCurrentWorkspaceId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pinId: string) => dreamBoardApi.deletePin(workspaceId!, pinId),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ["dream-board", workspaceId] }),
    onError: (error: Error) => {
      toast.error("No se pudo eliminar el pin", {
        description: error.message,
      });
    },
  });
}
