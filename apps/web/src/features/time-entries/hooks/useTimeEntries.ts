import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { timeEntriesApi } from "../api/time-entries.api";
import { useWorkspaceStore } from "@/store/workspace.store";

export function useCurrentWorkspaceId(): string | null {
  return useWorkspaceStore((s) => s.currentWorkspaceId);
}

export function useTimeEntries(filters?: {
  taskId?: string;
  userId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}) {
  const workspaceId = useCurrentWorkspaceId();
  return useQuery({
    queryKey: ["time-entries", workspaceId, filters],
    queryFn: () => timeEntriesApi.list(workspaceId!, filters),
    enabled: !!workspaceId,
  });
}

export function useCreateTimeEntry() {
  const workspaceId = useCurrentWorkspaceId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => {
      if (!workspaceId) throw new Error("No hay workspace seleccionado");
      return timeEntriesApi.create(workspaceId, input);
    },
    onSuccess: () => {
      toast.success("Entrada de tiempo creada");
      void qc.invalidateQueries({ queryKey: ["time-entries", workspaceId] });
    },
    onError: (error: Error) => {
      toast.error("No se pudo crear la entrada de tiempo", {
        description: error.message,
      });
    },
  });
}

export function useStopTimeEntry() {
  const workspaceId = useCurrentWorkspaceId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entryId: string) => {
      if (!workspaceId) throw new Error("No hay workspace seleccionado");
      return timeEntriesApi.stop(workspaceId, entryId);
    },
    onSuccess: () => {
      toast.success("Temporizador detenido");
      void qc.invalidateQueries({ queryKey: ["time-entries", workspaceId] });
    },
    onError: (error: Error) => {
      toast.error("No se pudo detener el temporizador", {
        description: error.message,
      });
    },
  });
}

export function useUpdateTimeEntry() {
  const workspaceId = useCurrentWorkspaceId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: Record<string, unknown>;
    }) => {
      if (!workspaceId) throw new Error("No hay workspace seleccionado");
      return timeEntriesApi.update(workspaceId, id, input);
    },
    onSuccess: () => {
      toast.success("Entrada de tiempo actualizada");
      void qc.invalidateQueries({ queryKey: ["time-entries", workspaceId] });
    },
    onError: (error: Error) => {
      toast.error("No se pudo actualizar la entrada de tiempo", {
        description: error.message,
      });
    },
  });
}

export function useDeleteTimeEntry() {
  const workspaceId = useCurrentWorkspaceId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entryId: string) => {
      if (!workspaceId) throw new Error("No hay workspace seleccionado");
      return timeEntriesApi.remove(workspaceId, entryId);
    },
    onSuccess: () => {
      toast.success("Entrada de tiempo eliminada");
      void qc.invalidateQueries({ queryKey: ["time-entries", workspaceId] });
    },
    onError: (error: Error) => {
      toast.error("No se pudo eliminar la entrada de tiempo", {
        description: error.message,
      });
    },
  });
}
