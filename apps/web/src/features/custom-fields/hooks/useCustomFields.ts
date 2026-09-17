import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  CustomFieldDefinition,
  CustomFieldType,
  CustomFieldValue,
} from "@taskmaster/contracts";
import { customFieldsApi } from "../api/custom-fields.api";
import { useWorkspaceStore } from "@/store/workspace.store";

const MANY_CHUNK_SIZE = 50;

function useCurrentWorkspaceId(): string | null {
  return useWorkspaceStore((s) => s.currentWorkspaceId);
}

async function fetchValuesMany(
  workspaceId: string,
  entityType: string,
  entityIds: string[],
): Promise<Record<string, CustomFieldValue[]>> {
  const chunks: string[][] = [];
  for (let i = 0; i < entityIds.length; i += MANY_CHUNK_SIZE) {
    chunks.push(entityIds.slice(i, i + MANY_CHUNK_SIZE));
  }

  const results = await Promise.all(
    chunks.map((chunk) =>
      customFieldsApi.getValuesMany(workspaceId, entityType, chunk),
    ),
  );

  return Object.assign({}, ...results);
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

export function useReorderCustomFieldDefinitions() {
  const workspaceId = useCurrentWorkspaceId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: string[]) => {
      if (!workspaceId) throw new Error("No hay workspace seleccionado");
      return customFieldsApi.reorderDefinitions(workspaceId, orderedIds);
    },
    onMutate: async (orderedIds) => {
      const queryKey = ["customFieldDefinitions", workspaceId];
      await qc.cancelQueries({ queryKey });
      const previous = qc.getQueryData<CustomFieldDefinition[]>(queryKey) ?? [];
      const byId = new Map(previous.map((d) => [d.id, d]));
      const next = orderedIds
        .map((id, index) => {
          const def = byId.get(id);
          return def ? { ...def, order: index + 1 } : null;
        })
        .filter((d): d is CustomFieldDefinition => d !== null);
      qc.setQueryData(queryKey, next);
      return { previous };
    },
    onError: (error: Error, _variables, context) => {
      qc.setQueryData(
        ["customFieldDefinitions", workspaceId],
        context?.previous ?? [],
      );
      toast.error("No se pudo reordenar", { description: error.message });
    },
    onSettled: () => {
      void qc.invalidateQueries({
        queryKey: ["customFieldDefinitions", workspaceId],
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

export function useCustomFieldValuesMany(
  entityType: string,
  entityIds: string[],
) {
  const workspaceId = useCurrentWorkspaceId();
  const ids = [...new Set(entityIds)].sort();
  return useQuery({
    queryKey: ["customFieldValuesMany", workspaceId, entityType, ids],
    queryFn: () => fetchValuesMany(workspaceId!, entityType, ids),
    enabled: !!workspaceId && ids.length > 0,
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
      void qc.invalidateQueries({
        queryKey: ["customFieldValuesMany", workspaceId, variables.entityType],
      });
    },
    onError: (error: Error) => {
      toast.error("No se pudo guardar el valor", {
        description: error.message,
      });
    },
  });
}
