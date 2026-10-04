import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { workspacesApi } from "../api/workspace.api";
import { getLocalWorkspace } from "../lib/localWorkspace";
import { ApiError } from "@/services/http";
import { useWorkspaceStore } from "@/store/workspace.store";
import { useAuthStore } from "@/store/auth.store";

export function useWorkspaces() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ["workspaces"],
    // La habilitación se apoya en la sesión, no en el access token: este puede
    // estar vacío porque venció y `http` lo renueva solo contra la cookie. Si
    // esta query esperara al token, quedaría deshabilitada justo cuando más hace
    // falta (tras un refresh) y nadie podría corregir un `currentWorkspaceId`
    // que ya no existe en el servidor.
    enabled: !!user,
    queryFn: async () => {
      try {
        return await workspacesApi.list();
      } catch (err) {
        if (
          err instanceof ApiError &&
          (err.status === 401 || err.status === 403)
        ) {
          throw err;
        }
        console.warn("Workspaces API unavailable, using local fallback", err);
        return [getLocalWorkspace()];
      }
    },
  });
}

export function useCreateWorkspace() {
  const qc = useQueryClient();
  const setCurrentWorkspaceId = useWorkspaceStore(
    (s) => s.setCurrentWorkspaceId,
  );
  return useMutation({
    mutationFn: (input: { name: string; slug?: string; icon?: string }) =>
      workspacesApi.create(input),
    onSuccess: (workspace) => {
      toast.success("Workspace creado");
      setCurrentWorkspaceId(workspace.id);
      void qc.invalidateQueries({ queryKey: ["workspaces"] });
    },
    onError: (error: Error) => {
      toast.error("No se pudo crear el workspace", {
        description: error.message,
      });
    },
  });
}

export function useUpdateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: Record<string, unknown>;
    }) => workspacesApi.update(id, input),
    onSuccess: () => {
      toast.success("Workspace actualizado");
      void qc.invalidateQueries({ queryKey: ["workspaces"] });
    },
    onError: (error: Error) => {
      toast.error("No se pudo actualizar el workspace", {
        description: error.message,
      });
    },
  });
}

export function useDeleteWorkspace() {
  const qc = useQueryClient();
  const { currentWorkspaceId, clearCurrentWorkspaceId } = useWorkspaceStore();
  return useMutation({
    mutationFn: (id: string) => workspacesApi.delete(id),
    onSuccess: (_data, id) => {
      toast.success("Workspace eliminado");
      if (currentWorkspaceId === id) {
        clearCurrentWorkspaceId();
      }
      void qc.invalidateQueries({ queryKey: ["workspaces"] });
    },
    onError: (error: Error) => {
      toast.error("No se pudo eliminar el workspace", {
        description: error.message,
      });
    },
  });
}
