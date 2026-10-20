import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { DreamBoardDto } from "@taskmaster/contracts";
import { dreamBoardApi } from "../api/dream-board.api";
import { useCurrentWorkspaceId } from "@/features/tasks/hooks/useTasks";

const POSITION_KEYS = new Set(["positionX", "positionY"]);

/**
 * `true` si el patch solo mueve el pin (sin tocar título/imagen/vinculación).
 *
 * El arrastre emite un `PATCH` por cada `dragstop`; para esos movimientos no
 * queremos invalidar el tablero entero (un refetch completo por cada pin que se
 * mueve). Los cambios de contenido sí invalidan, porque el DTO puede cambiar de
 * forma (p. ej. `linkedTask` al re-vincular).
 */
function isPositionOnly(input: Record<string, unknown>): boolean {
  const keys = Object.keys(input);
  return keys.length > 0 && keys.every((key) => POSITION_KEYS.has(key));
}

export function useDreamBoard() {
  const workspaceId = useCurrentWorkspaceId();
  return useQuery({
    queryKey: ["dream-board", workspaceId],
    queryFn: () => dreamBoardApi.get(workspaceId!),
    enabled: !!workspaceId,
  });
}

export function useUpdateDreamBoard() {
  const workspaceId = useCurrentWorkspaceId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (title: string) =>
      dreamBoardApi.updateBoard(workspaceId!, title),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ["dream-board", workspaceId] }),
    onError: (error: Error) => {
      toast.error("No se pudo renombrar el tablero", {
        description: error.message,
      });
    },
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
  const queryKey = ["dream-board", workspaceId] as const;
  return useMutation({
    mutationFn: ({
      pinId,
      input,
    }: {
      pinId: string;
      input: Record<string, unknown>;
    }) => dreamBoardApi.updatePin(workspaceId!, pinId, input),
    onMutate: async ({ pinId, input }) => {
      if (!workspaceId) return;
      await qc.cancelQueries({ queryKey });
      const previous = qc.getQueryData<DreamBoardDto>(queryKey);
      if (previous) {
        qc.setQueryData<DreamBoardDto>(queryKey, {
          ...previous,
          pins: previous.pins.map((pin) =>
            pin.id === pinId
              ? {
                  ...pin,
                  ...(typeof input.positionX === "number"
                    ? { x: input.positionX }
                    : {}),
                  ...(typeof input.positionY === "number"
                    ? { y: input.positionY }
                    : {}),
                }
              : pin,
          ),
        });
      }
      return { previous };
    },
    onError: (error: Error, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(queryKey, context.previous);
      }
      toast.error("No se pudo actualizar el pin", {
        description: error.message,
      });
    },
    onSuccess: (_data, { input }) => {
      if (!isPositionOnly(input)) {
        void qc.invalidateQueries({ queryKey });
      }
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
