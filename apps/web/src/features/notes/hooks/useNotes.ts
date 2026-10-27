import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Note } from "@taskmaster/contracts";
import { notesApi } from "../api/notes.api";
import { useCurrentWorkspaceId } from "@/features/tasks/hooks/useTasks";

/** La lista y el detalle comparten el prefijo `["notes", workspaceId]`. */
function useInvalidateNotes() {
  const workspaceId = useCurrentWorkspaceId();
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: ["notes", workspaceId] });
}

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

export function useToggleNotePin() {
  const workspaceId = useCurrentWorkspaceId();
  const invalidate = useInvalidateNotes();
  return useMutation({
    mutationFn: (note: Note) =>
      note.pinned
        ? notesApi.unpin(workspaceId!, note.id)
        : notesApi.pin(workspaceId!, note.id),
    onSuccess: invalidate,
    onError: (error: Error) => {
      toast.error("No se pudo fijar la nota", { description: error.message });
    },
  });
}

export function useAddChecklistItem() {
  const workspaceId = useCurrentWorkspaceId();
  const invalidate = useInvalidateNotes();
  return useMutation({
    mutationFn: ({ noteId, text }: { noteId: string; text: string }) =>
      notesApi.addChecklistItem(workspaceId!, noteId, text),
    onSuccess: invalidate,
    onError: (error: Error) => {
      toast.error("No se pudo agregar el ítem", { description: error.message });
    },
  });
}

export function useToggleChecklistItem() {
  const workspaceId = useCurrentWorkspaceId();
  const invalidate = useInvalidateNotes();
  return useMutation({
    mutationFn: ({
      noteId,
      itemId,
      done,
    }: {
      noteId: string;
      itemId: string;
      done: boolean;
    }) => notesApi.toggleChecklistItem(workspaceId!, noteId, itemId, done),
    onSuccess: invalidate,
    onError: (error: Error) => {
      toast.error("No se pudo actualizar el ítem", {
        description: error.message,
      });
    },
  });
}

export function useRemoveChecklistItem() {
  const workspaceId = useCurrentWorkspaceId();
  const invalidate = useInvalidateNotes();
  return useMutation({
    mutationFn: ({ noteId, itemId }: { noteId: string; itemId: string }) =>
      notesApi.removeChecklistItem(workspaceId!, noteId, itemId),
    onSuccess: invalidate,
    onError: (error: Error) => {
      toast.error("No se pudo quitar el ítem", { description: error.message });
    },
  });
}
