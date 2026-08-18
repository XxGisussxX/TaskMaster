import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { remindersApi } from "../api/reminders.api";
import { useCurrentWorkspaceId } from "@/features/tasks/hooks/useTasks";

export function useReminders(filters?: { from?: string; to?: string }) {
  const workspaceId = useCurrentWorkspaceId();
  return useQuery({
    queryKey: ["reminders", workspaceId, filters],
    queryFn: () => remindersApi.list(workspaceId!, filters),
    enabled: !!workspaceId,
  });
}

export function useCreateReminder() {
  const workspaceId = useCurrentWorkspaceId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => {
      if (!workspaceId) throw new Error("No hay workspace seleccionado");
      return remindersApi.create(workspaceId, input);
    },
    onSuccess: () => {
      toast.success("Recordatorio creado");
      void qc.invalidateQueries({ queryKey: ["reminders", workspaceId] });
    },
    onError: (error: Error) => {
      toast.error("No se pudo crear el recordatorio", {
        description: error.message,
      });
    },
  });
}

export function useUpdateReminder() {
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
      return remindersApi.update(workspaceId, id, input);
    },
    onSuccess: () => {
      toast.success("Recordatorio actualizado");
      void qc.invalidateQueries({ queryKey: ["reminders", workspaceId] });
    },
    onError: (error: Error) => {
      toast.error("No se pudo actualizar el recordatorio", {
        description: error.message,
      });
    },
  });
}

export function useDeleteReminder() {
  const workspaceId = useCurrentWorkspaceId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      if (!workspaceId) throw new Error("No hay workspace seleccionado");
      return remindersApi.remove(workspaceId, id);
    },
    onSuccess: () => {
      toast.success("Recordatorio eliminado");
      void qc.invalidateQueries({ queryKey: ["reminders", workspaceId] });
    },
    onError: (error: Error) => {
      toast.error("No se pudo eliminar el recordatorio", {
        description: error.message,
      });
    },
  });
}
