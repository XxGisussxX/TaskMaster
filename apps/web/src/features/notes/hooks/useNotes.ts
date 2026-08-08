import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notesApi } from "../api/notes.api";
import { useCurrentWorkspaceId } from "@/features/tasks/hooks/useTasks";

export function useNotes(
  query: Record<string, string | boolean | number | undefined> = {},
) {
  const workspaceId = useCurrentWorkspaceId();
  return useQuery({
    queryKey: ["notes", workspaceId, query],
    queryFn: () => notesApi.list(workspaceId!, query),
    enabled: !!workspaceId,
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
  });
}

export function useDeleteNote() {
  const workspaceId = useCurrentWorkspaceId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notesApi.remove(workspaceId!, id),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ["notes", workspaceId] }),
  });
}
