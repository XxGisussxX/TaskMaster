import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { CustomFieldType } from "@taskmaster/contracts";
import { customFieldsApi } from "../api/custom-fields.api";
import { useWorkspaceStore } from "@/store/workspace.store";

function useCurrentWorkspaceId(): string | null {
  return useWorkspaceStore((s) => s.currentWorkspaceId);
}

export function useCustomFieldDefinitions() {
  const workspaceId = useCurrentWorkspaceId();
  return useQuery({
    queryKey: ["customFieldDefinitions", workspaceId],
    queryFn: () => customFieldsApi.listDefinitions(workspaceId!),
    enabled: !!workspaceId,
  });
}

export function useCreateCustomFieldDefinition() {
  const workspaceId = useCurrentWorkspaceId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      type: CustomFieldType;
      options?: string[];
      order?: number;
      required?: boolean;
    }) => {
      if (!workspaceId) throw new Error("No hay workspace seleccionado");
      return customFieldsApi.createDefinition(workspaceId, {
        ...input,
        order: input.order ?? 0,
        required: input.required ?? false,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ["customFieldDefinitions", workspaceId],
      });
      toast.success("Campo personalizado creado");
    },
    onError: (error: Error) => {
      toast.error("No se pudo crear el campo personalizado", {
        description: error.message,
      });
    },
  });
}

export function useUpdateCustomFieldDefinition() {
  const workspaceId = useCurrentWorkspaceId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      data: {
        name?: string;
        type?: CustomFieldType;
        options?: string[];
        order?: number;
        required?: boolean;
      };
    }) => {
      if (!workspaceId) throw new Error("No hay workspace seleccionado");
      return customFieldsApi.updateDefinition(
        workspaceId,
        input.id,
        input.data,
      );
    },
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ["customFieldDefinitions", workspaceId],
      });
      toast.success("Campo personalizado actualizado");
    },
    onError: (error: Error) => {
      toast.error("No se pudo actualizar el campo personalizado", {
        description: error.message,
      });
    },
  });
}

export function useDeleteCustomFieldDefinition() {
  const workspaceId = useCurrentWorkspaceId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      if (!workspaceId) throw new Error("No hay workspace seleccionado");
      return customFieldsApi.removeDefinition(workspaceId, id);
    },
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ["customFieldDefinitions", workspaceId],
      });
      toast.success("Campo personalizado eliminado");
    },
    onError: (error: Error) => {
      toast.error("No se pudo eliminar el campo personalizado", {
        description: error.message,
      });
    },
  });
}

export function useCustomFieldValues(entityType: string, entityId: string) {
  const workspaceId = useCurrentWorkspaceId();
  return useQuery({
    queryKey: ["customFieldValues", workspaceId, entityType, entityId],
    queryFn: () =>
      customFieldsApi.getValues(workspaceId!, entityType, entityId),
    enabled: !!workspaceId && !!entityId,
  });
}

export function useSetCustomFieldValue() {
  const workspaceId = useCurrentWorkspaceId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      definitionId: string;
      entityId: string;
      entityType: string;
      value: unknown;
    }) => {
      if (!workspaceId) throw new Error("No hay workspace seleccionado");
      return customFieldsApi.setValue(workspaceId, input);
    },
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: [
          "customFieldValues",
          workspaceId,
          variables.entityType,
          variables.entityId,
        ],
      });
    },
    onError: (error: Error) => {
      toast.error("No se pudo guardar el valor", {
        description: error.message,
      });
    },
  });
}
