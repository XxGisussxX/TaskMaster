import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { notesApi } from "../api/notes.api";
import { useCurrentWorkspaceId } from "@/features/tasks/hooks/useTasks";

export function useNotes(
  query: Record<string, string | boolean | number | undefined> = {},
  enabled = true,
) {
  const workspaceId = useCurrentWorkspaceId();
  return useQuery({
    queryKey: ["notes", workspaceId, query],
    queryFn: () => notesApi.list(workspaceId!, query),
    enabled: !!workspaceId && enabled,
  });
}

export function useCreateNote() {
  const workspaceId = useCurrentWorkspaceId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      notesApi.create(workspaceId!, input),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ["notes", workspaceId] }),
    onError: (error: Error) => {
      toast.error("No se pudo crear la nota", { description: error.message });
    },
  });
}

export function useUpdateNote() {
  const workspaceId = useCurrentWorkspaceId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: Record<string, unknown>;
    }) => notesApi.update(workspaceId!, id, input),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ["notes", workspaceId] }),
    onError: (error: Error) => {
      toast.error("No se pudo actualizar la nota", {
        description: error.message,
      });
    },
  });
}

export function useDeleteNote() {
  const workspaceId = useCurrentWorkspaceId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notesApi.remove(workspaceId!, id),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ["notes", workspaceId] }),
    onError: (error: Error) => {
      toast.error("No se pudo eliminar la nota", {
        description: error.message,
      });
    },
  });
}
