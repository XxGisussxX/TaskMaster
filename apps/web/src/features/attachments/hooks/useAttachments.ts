import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { attachmentsApi } from "../api/attachments.api";
import { useWorkspaceStore } from "@/store/workspace.store";

export function useAttachments(context: { taskId?: string; noteId?: string }) {
  const workspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);
  return useQuery({
    queryKey: ["attachments", workspaceId, context],
    queryFn: () => attachmentsApi.list(workspaceId!, context),
    enabled: !!workspaceId && (!!context.taskId || !!context.noteId),
  });
}

export function useUploadAttachment(context: {
  taskId?: string;
  noteId?: string;
}) {
  const workspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      if (!workspaceId) throw new Error("No hay workspace seleccionado");
      return attachmentsApi.upload(workspaceId, file, context);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["attachments", workspaceId] });
      toast.success("Archivo subido correctamente");
    },
    onError: (err: Error) => {
      toast.error("No se pudo subir el archivo", {
        description: err.message,
      });
    },
  });
}

export function useDeleteAttachment() {
  const workspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: string) => {
      if (!workspaceId) throw new Error("No hay workspace seleccionado");
      return attachmentsApi.remove(workspaceId, attachmentId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["attachments", workspaceId] });
      toast.success("Archivo eliminado");
    },
    onError: (err: Error) => {
      toast.error("No se pudo eliminar el archivo", {
        description: err.message,
      });
    },
  });
}
