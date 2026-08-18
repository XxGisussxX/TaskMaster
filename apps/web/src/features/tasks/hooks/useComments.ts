import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { commentsApi } from "../api/comments.api";
import { useCurrentWorkspaceId } from "./useTasks";

export function useComments(taskId: string | null) {
  const workspaceId = useCurrentWorkspaceId();
  return useQuery({
    queryKey: ["comments", workspaceId, taskId],
    queryFn: () => commentsApi.list(workspaceId!, taskId!),
    enabled: !!workspaceId && !!taskId,
  });
}

export function useCreateComment(taskId: string) {
  const workspaceId = useCurrentWorkspaceId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { body: string }) => {
      if (!workspaceId) throw new Error("No hay workspace seleccionado");
      return commentsApi.create(workspaceId, taskId, input);
    },
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ["comments", workspaceId, taskId],
      });
    },
    onError: (error: Error) => {
      toast.error("No se pudo agregar el comentario", {
        description: error.message,
      });
    },
  });
}

export function useUpdateComment(taskId: string) {
  const workspaceId = useCurrentWorkspaceId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, body }: { commentId: string; body: string }) => {
      if (!workspaceId) throw new Error("No hay workspace seleccionado");
      return commentsApi.update(workspaceId, taskId, commentId, { body });
    },
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ["comments", workspaceId, taskId],
      });
    },
    onError: (error: Error) => {
      toast.error("No se pudo editar el comentario", {
        description: error.message,
      });
    },
  });
}

export function useDeleteComment(taskId: string) {
  const workspaceId = useCurrentWorkspaceId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => {
      if (!workspaceId) throw new Error("No hay workspace seleccionado");
      return commentsApi.remove(workspaceId, taskId, commentId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ["comments", workspaceId, taskId],
      });
    },
    onError: (error: Error) => {
      toast.error("No se pudo eliminar el comentario", {
        description: error.message,
      });
    },
  });
}
